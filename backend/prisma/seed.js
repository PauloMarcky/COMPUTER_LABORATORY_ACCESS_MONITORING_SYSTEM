const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs'); // change to 'bcrypt' if that's what your auth code uses

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed accounts are disabled in production.');
  }

  // ---- 1. Admin ----
  const adminPassword = 'admin123';
  const admin = await prisma.user.upsert({
    where: { schoolId: 'ADMIN-001' },
    update: {},
    create: {
      schoolId: 'ADMIN-001',
      password: await bcrypt.hash(adminPassword, 10),
      role: 'ADMIN',
    },
  });
  console.log('✔ Admin seeded:', admin.schoolId, '(password: admin123)');

  // ---- 2. Instructor ----
  const instructorUser = await prisma.user.upsert({
    where: { schoolId: 'INST-001' },
    update: {},
    create: {
      schoolId: 'INST-001',
      password: await bcrypt.hash('instructor123', 10),
      role: 'INSTRUCTOR',
      instructorProfile: {
        create: {
          firstName: 'Juan',
          lastName: 'Cruz',
          department: 'BSIT',
        },
      },
    },
  });
  console.log('✔ Instructor seeded:', instructorUser.schoolId, '(password: instructor123)');

  // ---- 3. Student ----
  const studentUser = await prisma.user.upsert({
    where: { schoolId: '2023-00123' },
    update: {},
    create: {
      schoolId: '2023-00123',
      password: await bcrypt.hash('student123', 10),
      role: 'STUDENT',
      studentProfile: {
        create: {
          firstName: 'Maria',
          lastName: 'Santos',
          yearLevel: 1,
        },
      },
    },
  });
  console.log('✔ Student seeded:', studentUser.schoolId, '(password: student123)');

  // ---- 4. Lab room ----
  let labRoom = await prisma.labRoom.findFirst({ where: { roomName: 'Lab 1' } });
  if (!labRoom) {
    labRoom = await prisma.labRoom.create({
      data: {
        roomName: 'Lab 1',
        capacity: 40,
        description: 'Main computer lab',
      },
    });
    console.log('✔ Lab room seeded:', labRoom.roomName);
  } else {
    console.log('• Lab room already exists:', labRoom.roomName);
  }

  // ---- 5. Terms (this system only supports 1st and 2nd semester) ----
  const termData = [
    {
      academicYear: '2024-2025',
      semester: '1ST',
      startDate: new Date('2024-08-01'),
      endDate: new Date('2024-12-15'),
      isActive: true,
    },
    {
      academicYear: '2024-2025',
      semester: '2ND',
      startDate: new Date('2025-01-06'),
      endDate: new Date('2025-05-31'),
      isActive: false,
    },
  ];
  for (const t of termData) {
    const existing = await prisma.term.findFirst({
      where: { academicYear: t.academicYear, semester: t.semester },
    });
    if (existing) {
      console.log('Term already exists:', existing.academicYear, existing.semester);
    } else {
      const created = await prisma.term.create({ data: t });
      console.log('Term seeded:', created.academicYear, created.semester);
    }
  }

  // ---- 5b. Legacy single-term check (kept as a no-op if already seeded) ----
  let term = await prisma.term.findFirst({
    where: { academicYear: '2024-2025', semester: '1ST' },
  });
  if (!term) {
    term = await prisma.term.create({
      data: {
        academicYear: '2024-2025',
        semester: '1ST',
        startDate: new Date('2024-08-01'),
        endDate: new Date('2024-12-15'),
        isActive: true,
      },
    });
    console.log('✔ Term seeded:', term.academicYear, term.semester);
  } else {
    console.log('• Term already exists:', term.academicYear, term.semester);
  }

  // ---- 6. Subjects ----
  const subjectData = [
    { code: 'IT101', title: 'Introduction to Computing', yearLevel: 1 },
    { code: 'IT102', title: 'Computer Programming 1', yearLevel: 1 },
    { code: 'IT201', title: 'Data Structures', yearLevel: 2 },
    { code: 'IT202', title: 'Object-Oriented Programming', yearLevel: 2 },
  ];
  for (const s of subjectData) {
    await prisma.subject.upsert({
      where: { code: s.code },
      update: {},
      create: s,
    });
  }
  console.log('✔ Subjects seeded:', subjectData.length);

  // ---- 3b. Custodian ----
  const custodianUser = await prisma.user.upsert({
    where: { schoolId: 'CUST-001' },
    update: {},
    create: {
      schoolId: 'CUST-001',
      password: await bcrypt.hash('custodian123', 10),
      role: 'CUSTODIAN',
      custodianProfile: {
        create: {
          firstName: 'Carlos',
          lastName: 'Mendoza',
        },
      },
    },
  });
  console.log('✔ Custodian seeded:', custodianUser.schoolId, '(password: custodian123)');

  console.log('\nSeed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });