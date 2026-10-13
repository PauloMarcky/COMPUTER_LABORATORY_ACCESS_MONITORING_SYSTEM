const prisma = require('../config/db');
const { toId, parseTime, getInstructorProfile, getStudentProfile, DAYS } = require('../utils/helpers');
const { findScheduleConflict, getScheduleConflictMessage } = require('../utils/schedule-conflicts');

const include = {
  labRoom: true,
  instructor: { select: { id: true, firstName: true, lastName: true } },
  term: true,
};

// Normalize a Prisma schedule row into the shape the frontend expects.
// Prisma names the PK "scheduleId"; the frontend expects "id".
function toApiSchedule(s) {
  if (!s) return s;
  return {
    id: s.scheduleId,
    instructorId: s.instructorId,
    labRoomId: s.labRoomId,
    subjectCode: s.subjectCode,
    section: s.section,
    yearLevel: s.yearLevel,
    termId: s.termId,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    instructor: s.instructor,
    labRoom: s.labRoom,
    term: s.term,
  };
}

function normalizeScheduleEnd(start, end) {
  const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
  const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes();
  if (startMinutes === endMinutes) return null;

  const normalizedEnd = new Date(start);
  normalizedEnd.setUTCHours(end.getUTCHours(), end.getUTCMinutes(), 0, 0);
  if (endMinutes < startMinutes) normalizedEnd.setUTCDate(normalizedEnd.getUTCDate() + 1);
  return normalizedEnd;
}

async function createSchedule(req, res) {
  const {
    instructorId, labRoomId, subjectCode, dayOfWeek,
    startTime, endTime, termId, section, yearLevel,
  } = req.body || {};

  const start = parseTime(startTime);
  const end = parseTime(endTime);

  if (!toId(instructorId) || !toId(labRoomId) || typeof subjectCode !== 'string' || !subjectCode.trim()) {
    return res.status(400).json({ error: 'instructorId, labRoomId and subjectCode are required.' });
  }
  if (!DAYS.includes(String(dayOfWeek).toUpperCase())) {
    return res.status(400).json({ error: `dayOfWeek must be one of ${DAYS.join(', ')}.` });
  }
  if (!start || !end) {
    return res.status(400).json({ error: 'Valid startTime and endTime are required.' });
  }
  const normalizedEnd = normalizeScheduleEnd(start, end);
  if (!normalizedEnd) return res.status(400).json({ error: 'Start and end times cannot be the same.' });

  const day = String(dayOfWeek).toUpperCase();
  const data = {
    instructorId: Number(instructorId),
    labRoomId: Number(labRoomId),
    subjectCode: subjectCode.trim(),
    dayOfWeek: day,
    startTime: start,
    endTime: normalizedEnd,
    termId: toId(termId) || null,
    section: typeof section === 'string' && section.trim() ? section.trim() : 'A',
    yearLevel: yearLevel != null ? Number(yearLevel) : 1,
  };

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const candidates = await tx.schedule.findMany({
        where: {
          dayOfWeek: { in: [DAYS[(DAYS.indexOf(day) + DAYS.length - 1) % DAYS.length], day, DAYS[(DAYS.indexOf(day) + 1) % DAYS.length]] },
          termId: data.termId, isActive: true,
          OR: [{ labRoomId: data.labRoomId }, { instructorId: data.instructorId }],
        },
        select: { scheduleId: true, dayOfWeek: true, termId: true, startTime: true, endTime: true, labRoomId: true, instructorId: true },
      });
      const conflict = findScheduleConflict(candidates, data);
      if (conflict) return { conflict };
      return { schedule: await tx.schedule.create({ data, include }) };
    }, { isolationLevel: 'Serializable' });
    if (outcome.conflict) {
      return res.status(409).json({ error: getScheduleConflictMessage(outcome.conflict, data) });
    }
    return res.status(201).json({ schedule: toApiSchedule(outcome.schedule) });
  } catch (error) {
    if (error.code === 'P2034') return res.status(409).json({ error: 'Schedule changed concurrently. Check for conflicts and try again.' });
    throw error;
  }
}

async function listSchedules(req, res) {
  const where = { isActive: true };
  if (req.query.labRoomId) where.labRoomId = toId(req.query.labRoomId) || -1;
  if (req.query.dayOfWeek) where.dayOfWeek = String(req.query.dayOfWeek).toUpperCase();
  if (req.query.termId) where.termId = toId(req.query.termId) || -1;

  if (req.user.role === 'INSTRUCTOR') {
    const profile = await getInstructorProfile(req.user.id);
    where.instructorId = profile ? profile.id : -1;
  } else if (req.query.instructorId) {
    where.instructorId = toId(req.query.instructorId) || -1;
  }

  const schedules = await prisma.schedule.findMany({
    where, include, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  return res.json({ schedules: schedules.map(toApiSchedule) });
}

async function listMySchedules(req, res) {
  const enrollments = await prisma.classEnrollment.findMany({
    where: { studentProfile: { studentId: req.user.id }, schedule: { isActive: true } },
    include: { schedule: { include } },
  });
  return res.json({ schedules: enrollments.map((e) => toApiSchedule(e.schedule)) });
}

async function getSchedule(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });
  const schedule = await prisma.schedule.findUnique({ where: { scheduleId: id }, include });
  if (!schedule) return res.status(404).json({ error: 'Schedule not found.' });
  if (req.user.role === 'INSTRUCTOR') {
    const profile = await getInstructorProfile(req.user.id);
    if (!profile || profile.id !== schedule.instructorId) return res.status(403).json({ error: 'This is not your schedule.' });
  }
  if (req.user.role === 'STUDENT') {
    const profile = await getStudentProfile(req.user.id);
    const enrollment = profile && await prisma.classEnrollment.findFirst({
      where: { studentProfileId: profile.id, scheduleId: id },
      select: { id: true },
    });
    if (!enrollment) return res.status(403).json({ error: 'You are not enrolled in this schedule.' });
  }
  return res.json({ schedule: toApiSchedule(schedule) });
}

async function updateSchedule(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });

  const current = await prisma.schedule.findUnique({ where: { scheduleId: id } });
  if (!current) return res.status(404).json({ error: 'Schedule not found.' });

  const {
    instructorId, labRoomId, subjectCode, dayOfWeek,
    startTime, endTime, termId, section, yearLevel,
  } = req.body || {};
  const data = {};

  if (instructorId !== undefined) {
    data.instructorId = toId(instructorId);
    if (!data.instructorId) return res.status(400).json({ error: 'Invalid instructorId.' });
  }
  if (labRoomId !== undefined) {
    data.labRoomId = toId(labRoomId);
    if (!data.labRoomId) return res.status(400).json({ error: 'Invalid labRoomId.' });
  }
  if (subjectCode !== undefined) {
    if (typeof subjectCode !== 'string' || !subjectCode.trim()) return res.status(400).json({ error: 'subjectCode cannot be empty.' });
    data.subjectCode = subjectCode.trim();
  }

  if (dayOfWeek !== undefined) {
    if (!DAYS.includes(String(dayOfWeek).toUpperCase())) return res.status(400).json({ error: 'Invalid dayOfWeek.' });
    data.dayOfWeek = String(dayOfWeek).toUpperCase();
  }
  if (startTime !== undefined) {
    data.startTime = parseTime(startTime);
    if (!data.startTime) return res.status(400).json({ error: 'Invalid startTime.' });
  }
  if (endTime !== undefined) {
    data.endTime = parseTime(endTime);
    if (!data.endTime) return res.status(400).json({ error: 'Invalid endTime.' });
  }
  if (termId !== undefined) {
    data.termId = termId === null ? null : toId(termId);
    if (termId !== null && !data.termId) return res.status(400).json({ error: 'Invalid termId.' });
  }
  if (section !== undefined) {
    if (typeof section !== 'string' || !section.trim()) return res.status(400).json({ error: 'section cannot be empty.' });
    data.section = section.trim();
  }
  if (yearLevel !== undefined) {
    data.yearLevel = Number(yearLevel);
    if (!Number.isInteger(data.yearLevel) || data.yearLevel < 1) return res.status(400).json({ error: 'yearLevel must be a positive integer.' });
  }

  const candidate = { ...current, ...data };
  const normalizedEnd = normalizeScheduleEnd(candidate.startTime, candidate.endTime);
  if (!normalizedEnd) return res.status(400).json({ error: 'Start and end times cannot be the same.' });
  candidate.endTime = normalizedEnd;
  if (startTime !== undefined || endTime !== undefined) data.endTime = normalizedEnd;
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const candidates = await tx.schedule.findMany({
        where: {
          scheduleId: { not: id },
          dayOfWeek: { in: [DAYS[(DAYS.indexOf(candidate.dayOfWeek) + DAYS.length - 1) % DAYS.length], candidate.dayOfWeek, DAYS[(DAYS.indexOf(candidate.dayOfWeek) + 1) % DAYS.length]] },
          termId: candidate.termId, isActive: true,
          OR: [{ labRoomId: candidate.labRoomId }, { instructorId: candidate.instructorId }],
        },
        select: { scheduleId: true, dayOfWeek: true, termId: true, startTime: true, endTime: true, labRoomId: true, instructorId: true },
      });
      const conflict = findScheduleConflict(candidates, candidate);
      if (conflict) return { conflict };
      return { schedule: await tx.schedule.update({ where: { scheduleId: id }, data, include }) };
    }, { isolationLevel: 'Serializable' });
    if (outcome.conflict) {
      return res.status(409).json({ error: getScheduleConflictMessage(outcome.conflict, candidate) });
    }
    return res.json({ schedule: toApiSchedule(outcome.schedule) });
  } catch (error) {
    if (error.code === 'P2034') return res.status(409).json({ error: 'Schedule changed concurrently. Check for conflicts and try again.' });
    throw error;
  }
}

async function deleteSchedule(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });
  const sessionCount = await prisma.activeSession.count({ where: { scheduleId: id } });
  if (sessionCount > 0 && req.query.withRecords !== 'true') {
    await prisma.schedule.update({ where: { scheduleId: id }, data: { isActive: false } });
    return res.status(204).send();
  }
  await prisma.schedule.delete({ where: { scheduleId: id } });
  return res.status(204).send();
}

async function deleteAllSchedules(req, res) {
  const sessionCount = await prisma.activeSession.count();
  if (sessionCount > 0) return res.status(409).json({ error: 'Schedules cannot be bulk deleted while session records exist.' });
  const result = await prisma.schedule.deleteMany({});
  return res.json({ deletedCount: result.count });
}

module.exports = { createSchedule, listSchedules, listMySchedules, getSchedule, updateSchedule, deleteSchedule, deleteAllSchedules };