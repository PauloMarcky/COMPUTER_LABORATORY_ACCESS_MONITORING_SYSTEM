const prisma = require('../config/db');
const { toId } = require('../utils/helpers');

async function createLabRoom(req, res) {
  const { roomName, capacity, description } = req.body || {};
  if (typeof roomName !== 'string' || !roomName.trim()) {
    return res.status(400).json({ error: 'roomName is required.' });
  }

  const parsedCapacity = Number(capacity);
  if (!Number.isInteger(parsedCapacity) || parsedCapacity < 0 || parsedCapacity > 200) {
    return res.status(400).json({ error: 'capacity must be a whole number between 0 and 200.' });
  }

  const labRoom = await prisma.$transaction(async (tx) => {
    const room = await tx.labRoom.create({
      data: {
        roomName: roomName.trim(),
        capacity: parsedCapacity,
        description: typeof description === 'string' && description.trim() ? description.trim() : null,
      },
    });

    if (parsedCapacity > 0) {
      await tx.pc.createMany({
        data: Array.from({ length: parsedCapacity }, (_, index) => ({
          labRoomId: room.id,
          pcNumber: `PC-${index + 1}`,
          status: 'AVAILABLE',
        })),
      });
    }

    return room;
  });

  return res.status(201).json({ labRoom });
}

async function listLabRooms(req, res) {
  const labRooms = await prisma.labRoom.findMany({ orderBy: { roomName: 'asc' } });
  return res.json({ labRooms });
}

async function getLabRoom(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });
  const labRoom = await prisma.labRoom.findUnique({ where: { id } });
  if (!labRoom) return res.status(404).json({ error: 'Lab room not found.' });
  return res.json({ labRoom });
}

async function updateLabRoom(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });

  const { roomName, capacity, description } = req.body || {};
  const data = {};

  if (roomName !== undefined) {
    if (typeof roomName !== 'string' || !roomName.trim()) {
      return res.status(400).json({ error: 'roomName cannot be empty.' });
    }
    data.roomName = roomName.trim();
  }

  if (capacity !== undefined) {
    const parsed = Number(capacity);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 200) {
      return res.status(400).json({ error: 'capacity must be a whole number between 0 and 200.' });
    }
    data.capacity = parsed;
  }

  if (description !== undefined) {
    if (description !== null && typeof description !== 'string') {
      return res.status(400).json({ error: 'description must be text.' });
    }
    data.description = description === null ? null : description.trim() || null;
  }

  const labRoom = await prisma.$transaction(async (tx) => {
    const current = await tx.labRoom.findUnique({
      where: { id },
      include: { pcs: { select: { id: true, pcNumber: true, status: true } } },
    });
    if (!current) return null;

    const updated = await tx.labRoom.update({ where: { id }, data });
    if (data.capacity === undefined) return updated;

    const targetCapacity = data.capacity;
    const byNumber = new Map(current.pcs.map((pc) => [pc.pcNumber, pc]));

    // Grow: ensure PC-1..PC-{targetCapacity} all exist and are clickable again.
    for (let i = 1; i <= targetCapacity; i += 1) {
      const pcNumber = `PC-${i}`;
      const existing = byNumber.get(pcNumber);
      if (!existing) {
        await tx.pc.create({
          data: { labRoomId: id, pcNumber, status: 'AVAILABLE' },
        });
      } else if (existing.status === 'RETIRED') {
        await tx.pc.update({ where: { id: existing.id }, data: { status: 'AVAILABLE' } });
      }
      // BROKEN / UNDER_REPAIR are left as-is on growth.
    }

    // Shrink: PCs beyond capacity go RETIRED. Leave explicit damage states alone.
    for (let i = targetCapacity + 1; i <= current.pcs.length + targetCapacity; i += 1) {
      const pcNumber = `PC-${i}`;
      const existing = byNumber.get(pcNumber);
      if (!existing) continue;
      if (existing.status === 'AVAILABLE' || existing.status === 'RETIRED') {
        if (existing.status !== 'RETIRED') {
          await tx.pc.update({ where: { id: existing.id }, data: { status: 'RETIRED' } });
        }
      }
      // BROKEN / UNDER_REPAIR are preserved even above the new capacity.
    }

    return updated;
  });

  if (!labRoom) return res.status(404).json({ error: 'Lab room not found.' });
  return res.json({ labRoom });
}

async function deleteLabRoom(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id.' });

  const scheduleCount = await prisma.schedule.count({ where: { labRoomId: id } });
  if (scheduleCount > 0) {
    return res.status(409).json({
      error: `This room is referenced by ${scheduleCount} schedule(s). Remove those schedules first, or set the room's PCs to RETIRED instead.`,
    });
  }

  await prisma.labRoom.delete({ where: { id } });
  return res.status(204).send();
}

// GET /api/lab-rooms/status
// Live status of every lab room: available/in-use, current class, PC counts.
async function getLabRoomStatus(req, res) {
  const [rooms, activeSessions] = await Promise.all([
    prisma.labRoom.findMany({ orderBy: { roomName: 'asc' } }),
    prisma.activeSession.findMany({
      where: { status: 'ACTIVE' },
      include: {
        schedule: {
          include: {
            instructor: { select: { firstName: true, lastName: true } },
          },
        },
        pcOccupancies: {
          where: { timeReleased: null },
          select: { id: true },
        },
      },
    }),
  ]);

  // Index active sessions by labRoomId
  const sessionByRoomId = new Map();
  for (const s of activeSessions) {
    sessionByRoomId.set(s.schedule.labRoomId, s);
  }

  const formatTime = (date) => {
    const d = new Date(date);
    const hour = d.getUTCHours();
    const minute = String(d.getUTCMinutes()).padStart(2, '0');
    const period = hour >= 12 ? 'PM' : 'AM';
    return `${String(hour % 12 || 12).padStart(2, '0')}:${minute} ${period}`;
  };

  const result = rooms.map((room) => {
    const session = sessionByRoomId.get(room.id);
    const totalPcs = room.capacity ?? 0;
    const occupiedPcs = session ? session.pcOccupancies.length : 0;

    return {
      id: String(room.id),
      name: room.roomName,
      location: room.description ?? '',
      status: session ? 'IN USE' : 'AVAILABLE',
      subject: session?.schedule.subjectCode ?? undefined,
      instructor: session
        ? `${session.schedule.instructor.firstName} ${session.schedule.instructor.lastName}`
        : undefined,
      section: session?.schedule.section ?? undefined,
      timeslot: session
        ? `${formatTime(session.schedule.startTime)} - ${formatTime(session.schedule.endTime)}`
        : undefined,
      availablePcs: Math.max(0, totalPcs - occupiedPcs),
      occupiedPcs,
      totalPcs,
    };
  });

  return res.json({ rooms: result });
}

const PC_STATUSES = ['AVAILABLE', 'UNDER_REPAIR', 'BROKEN', 'RETIRED'];

async function getPcs(req, res) {
  const labRoomId = toId(req.params.id);
  if (!labRoomId) return res.status(400).json({ error: 'Invalid id.' });

  const room = await prisma.labRoom.findUnique({ where: { id: labRoomId }, select: { id: true } });
  if (!room) return res.status(404).json({ error: 'Lab room not found.' });

  const pcs = await prisma.pc.findMany({
    where: { labRoomId },
    orderBy: { pcNumber: 'asc' },
  });
  return res.json({ pcs });
}

async function updatePc(req, res) {
  const pcId = toId(req.params.pcId);
  if (!pcId) return res.status(400).json({ error: 'Invalid pcId.' });

  const { status, notes } = req.body || {};
  const data = {};

  if (status !== undefined) {
    if (typeof status !== 'string' || !PC_STATUSES.includes(status.toUpperCase())) {
      return res.status(400).json({ error: `status must be one of ${PC_STATUSES.join(', ')}.` });
    }
    data.status = status.toUpperCase();
  }

  if (notes !== undefined) {
    if (notes !== null && typeof notes !== 'string') {
      return res.status(400).json({ error: 'notes must be text.' });
    }
    data.notes = notes === null ? null : notes.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Provide status or notes to update.' });
  }

  try {
    const pc = await prisma.pc.update({ where: { id: pcId }, data });
    return res.json({ pc });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'PC not found.' });
    throw error;
  }
}

module.exports = {
  createLabRoom,
  listLabRooms,
  getLabRoom,
  updateLabRoom,
  deleteLabRoom,
  getLabRoomStatus,
  getPcs,
  updatePc,
};