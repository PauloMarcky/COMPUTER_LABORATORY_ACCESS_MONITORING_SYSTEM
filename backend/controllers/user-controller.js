const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { toId } = require('../utils/helpers');
const { normalizeStudentYearLevel, validateStudentImportRows } = require('../utils/student-import');

const creatableRoles = new Set(['STUDENT', 'INSTRUCTOR', 'CUSTODIAN']);
// Compared against when a school ID does not exist, so response time does not reveal valid IDs.
const DUMMY_HASH = bcrypt.hashSync('invalid-password-placeholder', 12);

function toPublicUser(user) {
  const profile = user.role === 'STUDENT'
    ? user.studentProfile
    : user.role === 'INSTRUCTOR'
      ? user.instructorProfile
      : user.role === 'CUSTODIAN'  // ← ADD THIS
        ? user.custodianProfile
        : null;
  return {
    id: user.id,
    schoolId: user.schoolId,
    role: user.role,
    firstName: profile?.firstName || null,
    lastName: profile?.lastName || null,
    fullName: profile ? `${profile.firstName} ${profile.lastName}` : null,
    createdAt: user.createdAt,
  };
}


async function login(req, res) {
  const { schoolId, password } = req.body || {};

  if (typeof schoolId !== 'string' || !schoolId.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'schoolId and password are required.' });
  }

  if (password.length > 128) return res.status(401).json({ error: 'Invalid credentials.' });
  const user = await prisma.user.findUnique({ where: { schoolId: schoolId.trim() } });
  if (!user) await bcrypt.compare(password, DUMMY_HASH);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const hasBcryptHash = /^\$2[aby]\$\d{2}\$/.test(user.password);
  const isPasswordValid = hasBcryptHash
    ? await bcrypt.compare(password, user.password)
    : process.env.NODE_ENV !== 'production' && password === user.password;
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Authentication is not configured.' });
  }

  if (!hasBcryptHash) {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(password, 12) },
    });
  }

  const token = jwt.sign({ tokenVersion: user.tokenVersion }, secret, {
    subject: String(user.id),
    issuer: 'clams-api',
    audience: 'clams-client',
    algorithm: 'HS256',
    expiresIn: '8h',
  });

  return res.json({
    token,
    user: {
      id: user.id,
      schoolId: user.schoolId,
      role: user.role,
    },
  });
}

async function listUsers(req, res) {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      schoolId: true,
      role: true,
      createdAt: true,
      studentProfile: { select: { firstName: true, lastName: true } },
      instructorProfile: { select: { firstName: true, lastName: true } },
      custodianProfile: { select: { firstName: true, lastName: true } }, // ← ADD THIS
    },
    orderBy: { id: 'asc' },
  });
  return res.json({
    users: users.map((user) => ({
      ...toPublicUser(user),
      isCurrentUser: user.id === req.user.id,
    })),
  });
}

async function deleteUser(req, res) {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user ID.' });
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account.' });

  const outcome = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) return { status: 404, error: 'User not found.' };

    if (target.role === 'ADMIN') {
      const adminCount = await tx.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) return { status: 409, error: 'The last administrator account cannot be deleted.' };
    }

    await tx.user.delete({ where: { id } });
    return { status: 204 };
  }, { isolationLevel: 'Serializable' });

  if (outcome.error) return res.status(outcome.status).json({ error: outcome.error });
  return res.status(204).send();
}


async function createUser(req, res) {
  const { schoolId, password, role, firstName, lastName, course, yearLevel, department } = req.body || {};
  if (typeof schoolId !== 'string' || !schoolId.trim() || typeof password !== 'string') {
    return res.status(400).json({ error: 'schoolId and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (!creatableRoles.has(role)) {
    return res.status(400).json({ error: 'Only student, instructor, and custodian accounts can be created.' });
  }
  if ([firstName, lastName].some((value) => typeof value !== 'string' || !value.trim())) {
    return res.status(400).json({ error: 'firstName and lastName are required.' });
  }

  if (role === 'STUDENT') {
    const normalizedYearLevel = normalizeStudentYearLevel(yearLevel);
    if (normalizedYearLevel === null) {
      return res.status(400).json({ error: 'yearLevel is required and must be between 1 and 4 for student accounts.' });
    }
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  try {
    let user;
    if (role === 'STUDENT') {
      const profile = await prisma.studentProfile.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          course: typeof course === 'string' && course.trim() ? course.trim() : null,
          yearLevel: normalizeStudentYearLevel(yearLevel),
          user: {
            create: { schoolId: schoolId.trim(), password: hashedPassword, role },
          },
        },
        include: { user: { select: { id: true, schoolId: true, role: true, createdAt: true } } },
      });
      user = { ...profile.user, studentProfile: profile };
    } else if (role === 'INSTRUCTOR') {
      const profile = await prisma.instructorProfile.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          department: typeof department === 'string' && department.trim() ? department.trim() : null,
          user: {
            create: { schoolId: schoolId.trim(), password: hashedPassword, role },
          },
        },
        include: { user: { select: { id: true, schoolId: true, role: true, createdAt: true } } },
      });
      user = { ...profile.user, instructorProfile: profile };
    } else if (role === 'CUSTODIAN') { // ← ADD THIS BLOCK
      const profile = await prisma.custodianProfile.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          user: {
            create: { schoolId: schoolId.trim(), password: hashedPassword, role },
          },
        },
        include: { user: { select: { id: true, schoolId: true, role: true, createdAt: true } } },
      });
      user = { ...profile.user, custodianProfile: profile };
    } else {
      user = await prisma.user.create({
        data: { schoolId: schoolId.trim(), password: hashedPassword, role },
        select: { id: true, schoolId: true, role: true, createdAt: true },
      });
    }
    return res.status(201).json({ user: toPublicUser(user) });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A user with this school ID already exists.' });
    }
    throw error;
  }
}

async function importStudents(req, res) {
  const validation = validateStudentImportRows(req.body?.students);
  if (validation.errors.length) {
    return res.status(400).json({ error: 'The student import contains invalid rows.', details: validation.errors });
  }

  const schoolIds = validation.students.map((student) => student.schoolId);
  const findExisting = (client) => client.user.findMany({
    where: { schoolId: { in: schoolIds } },
    select: { schoolId: true },
  });
  const existing = await findExisting(prisma);
  if (existing.length) {
    return res.status(409).json({
      error: 'Some school IDs already exist.',
      schoolIds: existing.map((user) => user.schoolId),
    });
  }

  const studentsWithHashedPasswords = await Promise.all(
    validation.students.map(async (student) => ({
      ...student,
      password: await bcrypt.hash(student.password, 12),
    }))
  );

  try {
    const result = await prisma.$transaction(async (tx) => {
      const duplicates = await findExisting(tx);
      if (duplicates.length) return { duplicates: duplicates.map((user) => user.schoolId) };

      for (const student of studentsWithHashedPasswords) {
        await tx.studentProfile.create({
          data: {
            firstName: student.firstName,
            lastName: student.lastName,
            course: student.course,
            yearLevel: student.yearLevel,
            user: {
              create: {
                schoolId: student.schoolId,
                password: student.password,
                role: 'STUDENT',
              },
            },
          },
        });
      }

      return { created: studentsWithHashedPasswords.length };
    }, { isolationLevel: 'Serializable', timeout: 30000 });

    if (result.duplicates) {
      return res.status(409).json({ error: 'Some school IDs already exist.', schoolIds: result.duplicates });
    }
    return res.status(201).json({ created: result.created });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A school ID already exists; no students were imported.' });
    }
    throw error;
  }
}

async function updatePassword(req, res) {
  const id = toId(req.params.id);
  const { newPassword } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Invalid user ID.' });
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        password: await bcrypt.hash(newPassword, 12),
        tokenVersion: { increment: 1 },
      },
    });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'User not found.' });
    throw error;
  }
  return res.json({ message: 'Password updated.' });
}

async function updateUserName(req, res) {
  const id = toId(req.params.id);
  const firstName = typeof req.body?.firstName === 'string' ? req.body.firstName.trim() : '';
  const lastName = typeof req.body?.lastName === 'string' ? req.body.lastName.trim() : '';
  if (!id) return res.status(400).json({ error: 'Invalid user ID.' });
  if (id === req.user.id) return res.status(403).json({ error: 'You cannot edit your own name here.' });
  if (!firstName || !lastName || firstName.length > 191 || lastName.length > 191) {
    return res.status(400).json({ error: 'First and last names are required and must be 191 characters or fewer.' });
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const profileRelations = {
    STUDENT: { model: prisma.studentProfile, foreignKey: 'studentId' },
    INSTRUCTOR: { model: prisma.instructorProfile, foreignKey: 'instructorId' },
    CUSTODIAN: { model: prisma.custodianProfile, foreignKey: 'custodianId' },
  };
  const profile = profileRelations[user.role];
  if (!profile) return res.status(409).json({ error: 'Administrator names cannot be edited from User Management.' });

  try {
    await profile.model.update({
      where: { [profile.foreignKey]: id },
      data: { firstName, lastName },
    });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'User profile not found.' });
    throw error;
  }

  return res.json({ user: { id, firstName, lastName, fullName: `${firstName} ${lastName}` } });
}

async function updateSchoolId(req, res) {
  const id = toId(req.params.id);
  const schoolId = typeof req.body?.schoolId === 'string' ? req.body.schoolId.trim() : '';
  if (!id) return res.status(400).json({ error: 'Invalid user ID.' });
  if (!schoolId || schoolId.length > 191) {
    return res.status(400).json({ error: 'School ID is required and must be 191 characters or fewer.' });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { schoolId },
      select: { id: true, schoolId: true },
    });
    return res.json({ user });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'User not found.' });
    if (error.code === 'P2002') return res.status(409).json({ error: 'A user with this school ID already exists.' });
    throw error;
  }
}

async function deleteUsers(req, res) {
  const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const ids = [...new Set(rawIds.map((value) => toId(String(value))).filter(Boolean))];
  if (!ids.length) return res.status(400).json({ error: 'Select at least one user to delete.' });
  if (ids.length > 500) return res.status(400).json({ error: 'You can delete at most 500 users at a time.' });
  if (ids.includes(req.user.id)) return res.status(400).json({ error: 'You cannot delete your own account.' });

  const outcome = await prisma.$transaction(async (tx) => {
    const targets = await tx.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, role: true },
    });
    if (!targets.length) return { status: 404, error: 'No matching users found.' };

    const adminTargets = targets.filter((target) => target.role === 'ADMIN').length;
    if (adminTargets) {
      const adminCount = await tx.user.count({ where: { role: 'ADMIN' } });
      if (adminCount - adminTargets < 1) {
        return { status: 409, error: 'The last administrator account cannot be deleted.' };
      }
    }

    const result = await tx.user.deleteMany({
      where: { id: { in: targets.map((target) => target.id) } },
    });
    return { status: 200, deleted: result.count };
  }, { isolationLevel: 'Serializable', timeout: 30000 });

  if (outcome.error) return res.status(outcome.status).json({ error: outcome.error });
  return res.json({ deleted: outcome.deleted });
}

module.exports = { login, listUsers, createUser, importStudents, updatePassword, updateUserName, updateSchoolId, deleteUser, deleteUsers };
