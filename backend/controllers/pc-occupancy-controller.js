const prisma = require('../config/db');
const { toId, getStudentProfile, getInstructorProfile } = require('../utils/helpers');

const OPEN_ISSUE_STATUSES = ['PENDING', 'IN_PROGRESS'];
const normalizePcNumber = (value) => String(value ?? '').trim().replace(/^PC-/i, '').toUpperCase();

const PENDING_BLOCK_HOURS = 24;
const blockingReportWhere = () => ({
  OR: [
    { status: 'IN_PROGRESS' },
    { status: 'PENDING', reportedAt: { gte: new Date(Date.now() - PENDING_BLOCK_HOURS * 60 * 60 * 1000) } },
  ],
});

async function claimPc(req, res) {
  const activeSessionId = toId(req.body?.activeSessionId);
  const pcNumber = String(req.body?.pcNumber ?? '').trim();
  if (!activeSessionId || !pcNumber) {
    return res.status(400).json({ error: 'activeSessionId and pcNumber are required.' });
  }

  const student = await getStudentProfile(req.user.id);
  if (!student) return res.status(404).json({ error: 'Student profile not found.' });

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const session = await tx.activeSession.findUnique({
        where: { id: activeSessionId },
        include: { schedule: true },
      });
      if (!session || session.status !== 'ACTIVE') return { status: 400, error: 'Session is not active.' };

      const timedIn = await tx.attendanceLog.findFirst({
        where: { studentProfileId: student.id, activeSessionId, timeOut: null },
      });
      if (!timedIn) return { status: 403, error: 'Time in before claiming a PC.' };

      const mine = await tx.pcOccupancy.findFirst({
        where: { studentProfileId: student.id, activeSessionId, timeReleased: null },
      });
      if (mine) return { status: 409, error: `You already occupy PC ${mine.pcNumber}. Release it first.` };

      // The PC-change limit is enforced in releasePc.

      const pc = await tx.pc.findUnique({
        where: { labRoomId_pcNumber: { labRoomId: session.schedule.labRoomId, pcNumber } },
        select: { status: true },
      });
      if (!pc) return { status: 404, error: 'That PC does not exist in this room.' };
      if (pc.status !== 'AVAILABLE') {
        const label = pc.status === 'UNDER_REPAIR' ? 'under repair'
          : pc.status === 'BROKEN' ? 'marked as broken'
          : 'out of service';
        return { status: 409, error: `That PC is ${label} and cannot be claimed.` };
      }

      const openReports = await tx.pcIssueReport.findMany({
        where: {
          ...blockingReportWhere(),
          activeSession: { schedule: { labRoomId: session.schedule.labRoomId } },
        },
        select: { pcNumber: true },
      });
      if (openReports.some((report) => normalizePcNumber(report.pcNumber) === normalizePcNumber(pcNumber))) {
        return { status: 409, error: 'That PC has an unresolved issue report and cannot be claimed.' };
      }

      const taken = await tx.pcOccupancy.findFirst({
        where: {
          pcNumber,
          timeReleased: null,
          activeSession: { status: 'ACTIVE', schedule: { labRoomId: session.schedule.labRoomId } },
        },
      });
      if (taken) return { status: 409, error: 'That PC is already occupied.' };

      return {
        status: 201,
        occupancy: await tx.pcOccupancy.create({
          data: { activeSessionId, studentProfileId: student.id, pcNumber },
        }),
      };
    }, { isolationLevel: 'Serializable' });
    if (outcome.error) return res.status(outcome.status).json({ error: outcome.error });
    return res.status(201).json({ occupancy: outcome.occupancy });
  } catch (error) {
    if (error.code === 'P2034') return res.status(409).json({ error: 'PC availability changed. Refresh and choose another station.' });
    throw error;
  }
}

async function releasePc(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });

  const occupancy = await prisma.pcOccupancy.findUnique({
    where: { id },
    include: { studentProfile: true, activeSession: { include: { schedule: true } } },
  });
  if (!occupancy) return res.status(404).json({ error: 'Record not found.' });

  const isOwner = occupancy.studentProfile.studentId === req.user.id;
  if (!isOwner && !['ADMIN', 'INSTRUCTOR'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You cannot release this PC.' });
  }
  if (!isOwner && req.user.role === 'INSTRUCTOR') {
    const profile = await getInstructorProfile(req.user.id);
    if (!profile || profile.id !== occupancy.activeSession.schedule.instructorId) {
      return res.status(403).json({ error: 'You can only release PCs in your own sessions.' });
    }
  }
  if (occupancy.timeReleased) return res.status(409).json({ error: 'PC already released.' });

  if (isOwner) {
    const MAX_FREE_PC_CHANGES = 2;
    const releasedCount = await prisma.pcOccupancy.count({
      where: {
        activeSessionId: occupancy.activeSessionId,
        studentProfileId: occupancy.studentProfileId,
        timeReleased: { not: null },
      },
    });
    if (releasedCount >= MAX_FREE_PC_CHANGES) {
      const normPc = (value) => String(value ?? '').trim().replace(/^PC-/i, '').toUpperCase();
      const reports = await prisma.pcIssueReport.findMany({
        where: { activeSessionId: occupancy.activeSessionId, studentProfileId: occupancy.studentProfileId },
        select: { pcNumber: true },
      });
      const reportedThisPc = reports.some((report) => normPc(report.pcNumber) === normPc(occupancy.pcNumber));
      if (!reportedThisPc) {
        return res.status(409).json({
          error: `You already changed PCs ${MAX_FREE_PC_CHANGES} times. You can't release ${occupancy.pcNumber} again without reporting an issue on it first.`,
        });
      }
    }
  }

  const released = await prisma.pcOccupancy.updateMany({ where: { id, timeReleased: null }, data: { timeReleased: new Date() } });
  if (released.count === 0) return res.status(409).json({ error: 'PC already released.' });
  const updated = await prisma.pcOccupancy.findUnique({ where: { id } });
  return res.json({ occupancy: updated });
}

async function listBySession(req, res) {
  const activeSessionId = toId(req.params.sessionId);
  if (!activeSessionId) return res.status(400).json({ error: 'Invalid sessionId.' });
  const where = { activeSessionId };
  if (req.query.occupied === 'true') where.timeReleased = null;

  if (req.user.role === 'INSTRUCTOR') {
    const profile = await getInstructorProfile(req.user.id);
    const session = await prisma.activeSession.findUnique({
      where: { id: activeSessionId },
      include: { schedule: true },
    });
    if (!session || !profile || session.schedule.instructorId !== profile.id) {
      return res.status(403).json({ error: 'This is not your session.' });
    }
  }

  const occupancies = await prisma.pcOccupancy.findMany({
    where,
    include: { studentProfile: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { pcNumber: 'asc' },
  });
  occupancies.sort((x, y) => new Date(x.timeClaimed).getTime() - new Date(y.timeClaimed).getTime());
  return res.json({ occupancies });
}

async function getMyOccupancy(req, res) {
  const activeSessionId = toId(req.params.sessionId);
  if (!activeSessionId) return res.status(400).json({ error: 'Invalid sessionId.' });

  const student = await getStudentProfile(req.user.id);
  if (!student) return res.status(404).json({ error: 'Student profile not found.' });
  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      studentProfileId: student.id,
      schedule: { activeSessions: { some: { id: activeSessionId } } },
    },
  });
  if (!enrollment) return res.status(403).json({ error: 'You are not enrolled in this session.' });

  const occupancy = await prisma.pcOccupancy.findFirst({
    where: { activeSessionId, studentProfileId: student.id, timeReleased: null },
  });
  return res.json({ occupancy });
}

async function listAvailability(req, res) {
  const activeSessionId = toId(req.params.sessionId);
  if (!activeSessionId) return res.status(400).json({ error: 'Invalid sessionId.' });
  const student = await getStudentProfile(req.user.id);
  if (!student) return res.status(404).json({ error: 'Student profile not found.' });
  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      studentProfileId: student.id,
      schedule: { activeSessions: { some: { id: activeSessionId, status: 'ACTIVE' } } },
    },
    include: { schedule: { select: { labRoomId: true } } },
  });
  if (!enrollment) return res.status(403).json({ error: 'You are not enrolled in this active session.' });

  const [occupancies, roomPcs] = await Promise.all([
    prisma.pcOccupancy.findMany({
      where: { activeSessionId, timeReleased: null },
      select: { pcNumber: true },
    }),
    prisma.pc.findMany({
      where: { labRoomId: enrollment.schedule.labRoomId },
      select: { pcNumber: true, status: true, notes: true },
      orderBy: { pcNumber: 'asc' },
    }),
  ]);

  const openReports = await prisma.pcIssueReport.findMany({
    where: {
      ...blockingReportWhere(),
      activeSession: { schedule: { labRoomId: enrollment.schedule.labRoomId } },
    },
    select: { pcNumber: true },
  });
  const flagged = new Set(openReports.map((report) => normalizePcNumber(report.pcNumber)));
  const pcs = roomPcs.map((pc) => (
    pc.status === 'AVAILABLE' && flagged.has(normalizePcNumber(pc.pcNumber))
      ? { ...pc, status: 'UNDER_REPAIR' }
      : pc
  ));

  return res.json({ occupancies, pcs });
}

module.exports = { claimPc, releasePc, listBySession, getMyOccupancy, listAvailability };
