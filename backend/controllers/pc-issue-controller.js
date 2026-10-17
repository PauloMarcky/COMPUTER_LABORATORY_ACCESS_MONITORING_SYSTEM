const prisma = require('../config/db');
const { toId, getStudentProfile } = require('../utils/helpers');
const { uploadImage } = require('../services/r2-client');

const { STATUSES, canTransitionIssueStatus } = require('../utils/pc-issue-status');
const CATEGORIES = ['Mouse / Keyboard', 'Monitor', 'No Power', 'No Network', 'Software', 'Other'];

const include = {
  studentProfile: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      user: { select: { schoolId: true } },
    },
  },
  activeSession: { include: { schedule: { include: { labRoom: true } } } },
  handledBy: { select: { id: true, schoolId: true } },
  images: { orderBy: { sortOrder: 'asc' } },
};

async function reportIssue(req, res) {
  const activeSessionId = toId(req.body?.activeSessionId);
  const { pcNumber, category, issueDescription } = req.body || {};
  if (!activeSessionId || !pcNumber || typeof issueDescription !== 'string' || !issueDescription.trim()) {
    return res.status(400).json({ error: 'activeSessionId, pcNumber and issueDescription are required.' });
  }
  if (category !== undefined && !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of ${CATEGORIES.join(', ')}.` });
  }

  const student = await getStudentProfile(req.user.id);
  if (!student) return res.status(404).json({ error: 'Student profile not found.' });

  const attended = await prisma.attendanceLog.findFirst({ where: { studentProfileId: student.id, activeSessionId } });
  if (!attended) return res.status(403).json({ error: 'You did not attend this session.' });

  const normPc = (value) => String(value ?? '').trim().replace(/^PC-/i, '').toUpperCase();
  const usedPcs = await prisma.pcOccupancy.findMany({
    where: { activeSessionId, studentProfileId: student.id },
    select: { pcNumber: true },
  });
  if (!usedPcs.some((used) => normPc(used.pcNumber) === normPc(pcNumber))) {
    return res.status(403).json({ error: 'You can only report a PC you used in this session.' });
  }
  const openOwnReports = await prisma.pcIssueReport.findMany({
    where: { activeSessionId, studentProfileId: student.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    select: { pcNumber: true },
  });
  if (openOwnReports.some((open) => normPc(open.pcNumber) === normPc(pcNumber))) {
    return res.status(409).json({ error: 'You already have an open report for this PC.' });
  }

  const files = Array.isArray(req.files) ? req.files : [];
  let uploadedImages = [];
  try {
    uploadedImages = await Promise.all(
      files.map((file, index) =>
        uploadImage(file.buffer, file.mimetype).then(({ url }) => ({
          imageUrl: url,
          sortOrder: index,
        })),
      ),
    );
  } catch (uploadError) {
    console.error('Image upload failed:', uploadError.message);
    return res.status(502).json({ error: 'Unable to upload one or more images. Please try again.' });
  }

  const report = await prisma.pcIssueReport.create({
    data: {
      activeSessionId,
      studentProfileId: student.id,
      pcNumber: String(pcNumber).trim(),
      category: category || 'Other',
      issueDescription: issueDescription.trim(),
      images: uploadedImages.length > 0 ? { create: uploadedImages } : undefined,
    },
    include,
  });
  return res.status(201).json({ report });
}

async function listIssues(req, res) {
  const where = {};
  if (req.query.status && STATUSES.includes(String(req.query.status).toUpperCase())) {
    where.status = String(req.query.status).toUpperCase();
  }
  if (req.query.pcNumber) where.pcNumber = String(req.query.pcNumber);
  const reports = await prisma.pcIssueReport.findMany({ where, include, orderBy: { reportedAt: 'desc' } });
  return res.json({ reports });
}

async function listMyIssues(req, res) {
  const reports = await prisma.pcIssueReport.findMany({
    where: { studentProfile: { studentId: req.user.id } },
    include,
    orderBy: { reportedAt: 'desc' },
  });
  return res.json({ reports });
}

async function getIssue(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });
  const report = await prisma.pcIssueReport.findUnique({ where: { id }, include });
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  return res.json({ report });
}

// Custodian/admin updates status and notes; the handler is recorded automatically.
async function updateIssue(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });
  const { status, staffNotes } = req.body || {};

  const data = { handledById: req.user.id };
  let current = null;
  if (status !== undefined) {
    const s = String(status).toUpperCase();
    if (!STATUSES.includes(s)) return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}.` });
    current = await prisma.pcIssueReport.findUnique({
      where: { id },
      select: {
        status: true,
        pcNumber: true,
        activeSession: { select: { schedule: { select: { labRoomId: true } } } },
      },
    });
    if (!current) return res.status(404).json({ error: 'Report not found.' });
    if (!canTransitionIssueStatus(current.status, s)) {
      return res.status(409).json({ error: `Cannot change issue status from ${current.status} to ${s}.` });
    }
    data.status = s;
  }
  if (staffNotes !== undefined) {
    if (typeof staffNotes !== 'string') return res.status(400).json({ error: 'staffNotes must be a string.' });
    data.staffNotes = staffNotes.trim();
  }

  const statusChanged = Boolean(current && data.status && data.status !== current.status);
  const report = await prisma.$transaction(async (tx) => {
    const updated = await tx.pcIssueReport.update({ where: { id }, data, include });
    if (!statusChanged) return updated;

    const labRoomId = current.activeSession.schedule.labRoomId;
    const raw = String(current.pcNumber).trim();
    const pcNumbers = raw.toUpperCase().startsWith('PC-') ? [raw] : [raw, `PC-${raw}`];

    if (data.status === 'IN_PROGRESS') {
      await tx.pc.updateMany({
        where: { labRoomId, pcNumber: { in: pcNumbers }, status: { in: ['AVAILABLE', 'BROKEN'] } },
        data: { status: 'UNDER_REPAIR' },
      });
    } else if (data.status === 'RESOLVED' || (data.status === 'REJECTED' && current.status === 'IN_PROGRESS')) {
      const otherRepairs = await tx.pcIssueReport.count({
        where: {
          id: { not: id },
          status: 'IN_PROGRESS',
          pcNumber: { in: pcNumbers },
          activeSession: { schedule: { labRoomId } },
        },
      });
      if (otherRepairs === 0) {
        const room = await tx.labRoom.findUnique({ where: { id: labRoomId }, select: { capacity: true } });
        const pcIndex = parseInt(raw.replace(/^PC-/i, ''), 10);
        const aboveCapacity = Number.isInteger(pcIndex) && room && room.capacity != null && pcIndex > room.capacity;
        await tx.pc.updateMany({
          where: { labRoomId, pcNumber: { in: pcNumbers }, status: 'UNDER_REPAIR' },
          data: { status: aboveCapacity ? 'RETIRED' : 'AVAILABLE' },
        });
      }
    }
    return updated;
  });
  return res.json({ report });
}

module.exports = { reportIssue, listIssues, listMyIssues, getIssue, updateIssue };
