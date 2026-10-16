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
  if (status !== undefined) {
    const s = String(status).toUpperCase();
    if (!STATUSES.includes(s)) return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}.` });
    const current = await prisma.pcIssueReport.findUnique({ where: { id }, select: { status: true } });
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

  const report = await prisma.pcIssueReport.update({ where: { id }, data, include });
  return res.json({ report });
}

module.exports = { reportIssue, listIssues, listMyIssues, getIssue, updateIssue };
