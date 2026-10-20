const MAX_STUDENT_IMPORT_ROWS = Infinity;

function normalizeStudentYearLevel(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) return null;
  return parsed;
}

function validateStudentImportRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { students: [], errors: ['The spreadsheet has no student rows.'] };
  }
  if (rows.length > MAX_STUDENT_IMPORT_ROWS) {
    return { students: [], errors: [`Import no more than ${MAX_STUDENT_IMPORT_ROWS} students at a time.`] };
  }

  const students = [];
  const errors = [];
  const schoolIds = new Set();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      errors.push(`Row ${rowNumber}: invalid row data.`);
      return;
    }

    const schoolId = typeof row.schoolId === 'string' ? row.schoolId.trim() : '';
    const firstName = typeof row.firstName === 'string' ? row.firstName.trim() : '';
    const lastName = typeof row.lastName === 'string' ? row.lastName.trim() : '';
    const password = typeof row.password === 'string' ? row.password : '';
    const course = typeof row.course === 'string' ? row.course.trim() : '';
    const yearLevelValue = normalizeStudentYearLevel(row.yearLevel);
    const rowErrors = [];

    if (!schoolId) rowErrors.push('School ID is required');
    if (!firstName) rowErrors.push('first name is required');
    if (!lastName) rowErrors.push('last name is required');
    if (password.length < 8) rowErrors.push('initial password must be at least 8 characters');
    if (!course) rowErrors.push('course is required');
    if (yearLevelValue === null) rowErrors.push('year level is required');
    else if (!Number.isInteger(yearLevelValue) || yearLevelValue < 1 || yearLevelValue > 4) {
      rowErrors.push('year level must be from 1 to 4');
    }

    const normalizedSchoolId = schoolId.toLowerCase();
    if (normalizedSchoolId && schoolIds.has(normalizedSchoolId)) {
      rowErrors.push('school ID is duplicated in this file');
    }
    if (normalizedSchoolId) schoolIds.add(normalizedSchoolId);

    if (rowErrors.length) {
      errors.push(`Row ${rowNumber}: ${rowErrors.join(', ')}.`);
      return;
    }

    students.push({ schoolId, firstName, lastName, password, course, yearLevel: yearLevelValue });
  });

  return errors.length ? { students: [], errors } : { students, errors: [] };
}

module.exports = { MAX_STUDENT_IMPORT_ROWS, normalizeStudentYearLevel, validateStudentImportRows };