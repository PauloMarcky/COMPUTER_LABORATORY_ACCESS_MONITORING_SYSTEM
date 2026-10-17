const prisma = require('../config/db');

// Returns a positive integer or null.
function toId(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// Accepts "HH:MM" or an ISO date string. Returns a Date or null.
function parseTime(value) {
  if (typeof value !== 'string') return null;
  const v = /^\d{2}:\d{2}$/.test(value) ? `1970-01-01T${value}:00.000Z` : value;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const getStudentProfile = (userId) => prisma.studentProfile.findUnique({ where: { studentId: userId } });
const getInstructorProfile = (userId) => prisma.instructorProfile.findUnique({ where: { instructorId: userId } });

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

module.exports = { toId, parseTime, getStudentProfile, getInstructorProfile, DAYS };
