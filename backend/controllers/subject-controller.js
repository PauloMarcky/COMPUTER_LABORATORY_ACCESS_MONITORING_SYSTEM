const prisma = require('../config/db');
const { toId } = require('../utils/helpers');

// GET /api/subjects?includeArchived=true
async function listSubjects(req, res) {
  // All subjects are listed; archiving no longer exists.
  const subjects = await prisma.subject.findMany({
    where: {},
    orderBy: { code: 'asc' },
  });
  return res.json({ subjects });
}

// GET /api/subjects/:id/usage
async function getSubjectUsage(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });

  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) return res.status(404).json({ error: 'Subject not found.' });

  const [scheduleCount, instructorCount] = await Promise.all([
    prisma.schedule.count({ where: { subjectCode: subject.code } }),
    prisma.instructorSubject.count({ where: { subjectId: id } }),
  ]);

  return res.json({ scheduleCount, instructorCount });
}

async function createSubject(req, res) {
  const { code, title, yearLevel } = req.body || {};
  if (typeof code !== 'string' || !code.trim() || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'code and title are required.' });
  }
  try {
    const subject = await prisma.subject.create({
      data: {
        code: code.trim().toUpperCase(),
        title: title.trim(),
        yearLevel: yearLevel != null ? Number(yearLevel) : null,
      },
    });
    return res.status(201).json({ subject });
  } catch (e) {
    if (e.code === 'P2002') {
      const existing = await prisma.subject.findUnique({
        where: { code: code.trim().toUpperCase() },
      });
      if (false) {
        return res.status(409).json({
          error: 'That subject code already exists (archived). Restore it instead of creating a new one.',
        });
      }
      return res.status(409).json({ error: 'That subject code already exists.' });
    }
    throw e;
  }
}

async function updateSubject(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });
  const { code, title, yearLevel } = req.body || {};
  const data = {};
  if (code !== undefined) data.code = String(code).trim().toUpperCase();
  if (title !== undefined) data.title = String(title).trim();
  if (yearLevel !== undefined) data.yearLevel = yearLevel != null ? Number(yearLevel) : null;
  const subject = await prisma.subject.update({ where: { id }, data });
  return res.json({ subject });
}

// DELETE /api/subjects/:id
//
// Deletes the subject row. With ?withRecords=true it also deletes its schedules.
// Deleting a schedule cascades to enrollments, sessions, attendance, PC records.
async function deleteSubject(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });

  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) return res.status(404).json({ error: 'Subject not found.' });

  const result = await prisma.$transaction(async (tx) => {
    const deleted = req.query.withRecords !== 'true' ? await tx.schedule.updateMany({ where: { subjectCode: subject.code }, data: { isActive: false } }) : await tx.schedule.deleteMany({
      where: { subjectCode: subject.code },
    });
    await tx.subject.delete({
      where: { id },
      // subject row is removed for real
    });
    return { deletedSchedules: req.query.withRecords === 'true' ? deleted.count : 0 };
  });

  return res.json({
    deleted: true,
    withRecords: req.query.withRecords === 'true',
    deletedSchedules: result.deletedSchedules,
  });
}

// PATCH /api/subjects/:id/restore
async function restoreSubject(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });

  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) return res.status(404).json({ error: 'Subject not found.' });
  if (subject.isActive) return res.status(400).json({ error: 'Subject is already active.' });

  await prisma.subject.update({
    where: { id },
    data: { isActive: true },
  });

  return res.json({ restored: true });
}

module.exports = {
  listSubjects,
  getSubjectUsage,
  createSubject,
  updateSubject,
  deleteSubject,

};