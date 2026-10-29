// Usage:
//   node scripts/purge-records-before.js 2026-10-28            (dry run, counts only)
//   node scripts/purge-records-before.js 2026-10-28 --confirm  (actually deletes)
//
// Deletes class sessions that started before the given date (00:00 Asia/Manila).
// Attendance logs, PC occupancy and PC issue reports cascade from the session.
const prisma = require('../config/db');

async function main() {
  const dateArg = process.argv[2];
  const confirm = process.argv.includes('--confirm');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateArg || '')) {
    console.error('Provide a date like 2026-10-28');
    process.exit(1);
  }
  const cutoff = new Date(`${dateArg}T00:00:00+08:00`);
  const sessionWhere = { sessionDate: { lt: cutoff } };

  const [sessions, attendance, occupancy, issues] = await Promise.all([
    prisma.activeSession.count({ where: sessionWhere }),
    prisma.attendanceLog.count({ where: { activeSession: sessionWhere } }),
    prisma.pcOccupancy.count({ where: { activeSession: sessionWhere } }),
    prisma.pcIssueReport.count({ where: { activeSession: sessionWhere } }),
  ]);

  console.log(`Cutoff: ${cutoff.toISOString()}`);
  console.log(`Sessions: ${sessions}, attendance logs: ${attendance}, PC occupancy: ${occupancy}, PC issue reports: ${issues}`);

  if (!confirm) {
    console.log('Dry run only. Nothing deleted. Add --confirm to delete.');
    return;
  }
  const result = await prisma.activeSession.deleteMany({ where: sessionWhere });
  console.log(`Deleted ${result.count} sessions (and their cascaded records).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());