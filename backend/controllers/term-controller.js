const prisma = require('../config/db');
const { toId } = require('../utils/helpers');
const { findScheduleConflict } = require('../utils/schedule-conflicts');

async function listTerms(req, res) {
  const terms = await prisma.term.findMany({
    orderBy: [{ academicYear: 'desc' }, { semester: 'asc' }],
  });
  return res.json({ terms });
}

// POST /api/terms
// body: { academicYear, semester, startDate, endDate, makeActive?, copyFromTermId? }
async function createTerm(req, res) {
  const { academicYear, semester, startDate, endDate, makeActive, copyFromTermId } = req.body || {};
  if (typeof academicYear !== 'string' || !academicYear.trim() || typeof semester !== 'string' || !semester.trim()) {
    return res.status(400).json({ error: 'academicYear and semester are required.' });
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return res.status(400).json({ error: 'Valid startDate and endDate are required.' });
  }
  const sourceId = copyFromTermId != null ? toId(copyFromTermId) : null;
  if (copyFromTermId != null && !sourceId) {
    return res.status(400).json({ error: 'Invalid copyFromTermId.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (makeActive) await tx.term.updateMany({ data: { isActive: false } });
      const term = await tx.term.create({
        data: {
          academicYear: academicYear.trim(),
          semester: semester.trim().toUpperCase(),
          startDate: start,
          endDate: end,
          isActive: Boolean(makeActive),
        },
      });

      let copied = 0;
      let skipped = 0;
      if (sourceId) {
        const source = await tx.schedule.findMany({ where: { termId: sourceId, isActive: true } });
        const created = [];
        for (const s of source) {
          const data = {
            termId: term.id,
            instructorId: s.instructorId,
            labRoomId: s.labRoomId,
            subjectCode: s.subjectCode,
            section: s.section,
            yearLevel: s.yearLevel,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          };
          if (findScheduleConflict(created, data)) {
            skipped += 1;
            continue;
          }
          const row = await tx.schedule.create({ data });
          created.push(row);
          copied += 1;
        }
      }
      return { term, copied, skipped };
    });
    return res.status(201).json(result);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'That term already exists.' });
    throw e;
  }
}

// PATCH /api/terms/:id/activate
async function activateTerm(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });
  const existing = await prisma.term.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Term not found.' });

  await prisma.$transaction([
    prisma.term.updateMany({ data: { isActive: false } }),
    prisma.term.update({ where: { id }, data: { isActive: true } }),
  ]);
  return res.json({ activated: true });
}

// DELETE /api/terms/:id
// Refuses if the term is active or has schedules — protects history and
// prevents orphaned schedule records.
async function deleteTerm(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });

  const term = await prisma.term.findUnique({ where: { id } });
  if (!term) return res.status(404).json({ error: 'Term not found.' });

  if (term.isActive) {
    return res.status(409).json({
      error: 'This term is active. Activate a different term first, then delete this one.',
    });
  }

  const scheduleCount = await prisma.schedule.count({ where: { termId: id } });
  if (scheduleCount > 0) {
    return res.status(409).json({
      error: `Cannot delete: ${scheduleCount} schedule${scheduleCount === 1 ? '' : 's'} reference this term. Remove those schedules first.`,
    });
  }

  await prisma.term.delete({ where: { id } });
  return res.status(204).send();
}

module.exports = { listTerms, createTerm, activateTerm, deleteTerm };