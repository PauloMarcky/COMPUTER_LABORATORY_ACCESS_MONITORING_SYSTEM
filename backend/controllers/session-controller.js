const prisma = require('../config/db');
const { toId, getInstructorProfile, getStudentProfile } = require('../utils/helpers');
const { formatSchoolDate, formatSchoolTime, getAttendanceStatus } = require('../utils/schedule-match');

const include = {
  schedule: {
    include: {
      labRoom: true,
      term: true,
      instructor: { select: { firstName: true, lastName: true } },
    },
  },
};

async function startSession(req, res) {
  const scheduleId = toId(req.body?.scheduleId);
  if (!scheduleId) return res.status(400).json({ error: 'scheduleId is required.' });

  const schedule = await prisma.schedule.findUnique({ where: { scheduleId } });
  if (!schedule || !schedule.isActive) return res.status(404).json({ error: 'Schedule not found.' });

  if (req.user.role === 'INSTRUCTOR') {
    const profile = await getInstructorProfile(req.user.id);
    if (!profile || profile.id !== schedule.instructorId) {
      return res.status(403).json({ error: 'This is not your schedule.' });
    }
  }

  // One active session per schedule, and one per lab room.
  const running = await prisma.activeSession.findFirst({
    where: { status: 'ACTIVE', schedule: { OR: [{ scheduleId }, { labRoomId: schedule.labRoomId }] } },
  });
  if (running) return res.status(409).json({ error: 'A session is already active for this schedule or lab room.' });

  const session = await prisma.activeSession.create({ data: { scheduleId }, include });
  return res.status(201).json({ session });
}

async function endSession(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });

  const session = await prisma.activeSession.findUnique({ where: { id }, include });
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  if (session.status !== 'ACTIVE') return res.status(409).json({ error: 'Session already ended.' });

  if (req.user.role === 'INSTRUCTOR') {
    const profile = await getInstructorProfile(req.user.id);
    if (!profile || profile.id !== session.schedule.instructorId) {
      return res.status(403).json({ error: 'This is not your session.' });
    }
  }

  const now = new Date();
  const [ended] = await prisma.$transaction([
    prisma.activeSession.update({ where: { id }, data: { status: 'ENDED', endTime: now }, include }),
    // Close any open attendance and PC claims.
    prisma.attendanceLog.updateMany({ where: { activeSessionId: id, timeOut: null }, data: { timeOut: now } }),
    prisma.pcOccupancy.updateMany({ where: { activeSessionId: id, timeReleased: null }, data: { timeReleased: now } }),
  ]);
  return res.json({ session: ended });
}

async function listSessions(req, res) {
  const where = {};
  if (req.query.status) where.status = String(req.query.status).toUpperCase();
  if (req.query.scheduleId) where.scheduleId = toId(req.query.scheduleId) || -1;

  if (req.user.role === 'INSTRUCTOR') {
    const profile = await getInstructorProfile(req.user.id);
    where.schedule = { instructorId: profile ? profile.id : -1 };
  }
  const sessions = await prisma.activeSession.findMany({ where, include, orderBy: { startTime: 'desc' } });
  return res.json({ sessions });
}

// Active sessions for classes the student is enrolled in.
async function listMyActiveSessions(req, res) {
  const sessions = await prisma.activeSession.findMany({
    where: {
      status: 'ACTIVE',
      schedule: { classEnrollments: { some: { studentProfile: { studentId: req.user.id } } } },
    },
    include,
  });
  return res.json({ sessions });
}

async function getSession(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });
  const session = await prisma.activeSession.findUnique({ where: { id }, include });
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  if (req.user.role === 'INSTRUCTOR') {
    const profile = await getInstructorProfile(req.user.id);
    if (!profile || profile.id !== session.schedule.instructorId) return res.status(403).json({ error: 'This is not your session.' });
  }
  if (req.user.role === 'STUDENT') {
    const profile = await getStudentProfile(req.user.id);
    const enrollment = profile && await prisma.classEnrollment.findFirst({
      where: { studentProfileId: profile.id, scheduleId: session.scheduleId },
      select: { id: true },
    });
    if (!enrollment) return res.status(403).json({ error: 'You are not enrolled in this session.' });
  }
  return res.json({ session });
}

async function listReports(req, res) {
  const sessions = await prisma.activeSession.findMany({
    where: { status: 'ENDED' },
    include: {
      schedule: {
        include: {
          labRoom: true,
          term: true,
          instructor: { select: { firstName: true, lastName: true } },
          classEnrollments: { select: { id: true } },
        },
      },
      attendanceLogs: {
        include: {
          studentProfile: {
            include: { user: { select: { schoolId: true } } },
          },
        },
        orderBy: { timeIn: 'asc' },
      },
      pcOccupancies: { select: { studentProfileId: true, pcNumber: true, timeClaimed: true, timeReleased: true } },
    },
    orderBy: { endTime: 'desc' },
  });
  const subjectCodes = [...new Set(sessions.map((session) => session.schedule.subjectCode))];
  const subjects = await prisma.subject.findMany({
    where: { code: { in: subjectCodes } },
    select: { code: true, title: true },
  });
  const subjectTitles = new Map(subjects.map((subject) => [subject.code, subject.title]));

  return res.json({
    reports: sessions.map((session) => ({
      id: String(session.id),
      date: formatSchoolDate(session.sessionDate),
      subjectCode: session.schedule.subjectCode,
      subjectName: subjectTitles.get(session.schedule.subjectCode) || session.schedule.subjectCode,
      section: session.schedule.section,
      yearLevel: session.schedule.yearLevel,
      instructor: `${session.schedule.instructor.firstName} ${session.schedule.instructor.lastName}`,
      labRoom: session.schedule.labRoom.roomName,
      sessionTime: `${formatSchoolTime(session.startTime)} - ${formatSchoolTime(session.endTime || session.startTime)}`,
      semester: session.schedule.term
        ? `${session.schedule.term.academicYear} ${session.schedule.term.semester}`
        : '',
      academicYear: session.schedule.term?.academicYear || '',
      termSemester: session.schedule.term?.semester || '',
      studentsPresent: session.attendanceLogs.length,
      studentsTotal: session.schedule.classEnrollments.length,
      status: session.reportStatus === 'APPROVED' ? 'Approved' : session.reportStatus === 'REJECTED' ? 'Rejected' : 'Pending',
      remarks: session.reportRemarks,
      attendanceList: session.attendanceLogs.map((attendance) => {
        const student = attendance.studentProfile;
        const occupancy = session.pcOccupancies
          .filter((item) => item.studentProfileId === student.id)
          .sort((left, right) => right.timeClaimed - left.timeClaimed)[0];
        return {
          id: String(attendance.id),
          timeIn: attendance.timeIn.toISOString(),
          timeOut: attendance.timeOut?.toISOString() || null,
          studentId: student.user.schoolId,
          name: `${student.firstName} ${student.lastName}`,
          formalName: `${student.lastName}, ${student.firstName}`,
          pcNumber: occupancy?.pcNumber || 'None',
          pcHistory: session.pcOccupancies
            .filter((item) => item.studentProfileId === student.id)
            .sort((left, right) => left.timeClaimed - right.timeClaimed)
            .map((claim) => ({
              pcNumber: claim.pcNumber,
              claimedAt: claim.timeClaimed.toISOString(),
              releasedAt: claim.timeReleased ? claim.timeReleased.toISOString() : null,
            })),
          status: getAttendanceStatus(attendance.timeIn, session.schedule),
        };
      }),
    })),
  });
}

module.exports = { startSession, endSession, listSessions, listMyActiveSessions, getSession, listReports };
