// One-shot backfill: ensures every LabRoom has PC rows for its full capacity.
// Idempotent — safe to run multiple times. Existing PC rows are left untouched
// (so a PC you've marked BROKEN stays BROKEN).
//
//   node scripts/backfill-pcs.js

const prisma = require('../config/db');

async function main() {
  const rooms = await prisma.labRoom.findMany({
    include: { pcs: { select: { pcNumber: true } } },
  });

  let created = 0;
  for (const room of rooms) {
    const capacity = Math.max(0, Number(room.capacity) || 0);
    if (capacity === 0) {
      console.log(`• ${room.roomName}: capacity is 0, skipping`);
      continue;
    }

    const existing = new Set(room.pcs.map((pc) => pc.pcNumber));
    const missing = [];
    for (let i = 1; i <= capacity; i += 1) {
      const pcNumber = `PC-${i}`;
      if (!existing.has(pcNumber)) missing.push(pcNumber);
    }

    if (missing.length === 0) {
      console.log(`• ${room.roomName}: already has ${capacity} PCs`);
      continue;
    }

    for (const pcNumber of missing) {
      await prisma.pc.create({
        data: { labRoomId: room.id, pcNumber, status: 'AVAILABLE' },
      });
      created += 1;
    }
    console.log(`✔ ${room.roomName}: created ${missing.length} PCs (total now ${capacity})`);
  }

  console.log(`\nBackfill complete. ${created} PC rows created across ${rooms.length} room(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });