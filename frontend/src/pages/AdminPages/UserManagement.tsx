import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, FileSpreadsheet, KeyRound, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { readSheet } from 'read-excel-file/browser';
import { ClamsHeader } from '../../components/ClamsHeader';
import { AdminSubNav } from '../../components/AdminComponents/AdminSubNav';
import { API_BASE_URL, readApiResponse } from '../../api';
import type { ManagedUser, ManagedUserRole, UserRole, WireframeScreenId } from '../../types';

interface UserManagementProps {
  onLogout: () => void;
  adminToken: string;
  onNavigate: (screen: WireframeScreenId) => void;
}

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  STUDENT: 'Student',
  INSTRUCTOR: 'Instructor',
  CUSTODIAN: 'Custodian',
};


interface StudentImportRow {
  schoolId: string;
  firstName: string;
  lastName: string;
  password: string;
  course: string;
  yearLevel: number | null;
  rowNumber: number;
  errors: string[];
}

type NoticeType = 'success' | 'error' | 'delete';

const MAX_STUDENT_IMPORT_ROWS = Infinity;
const normalizeHeader = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const cellText = (value: unknown) => value == null ? '' : String(value).trim();

// Shared blue primary button style
const PRIMARY_BTN =
  'inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-600/30 transition-all hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60';

// Smaller variant for inline Save buttons
const PRIMARY_BTN_SM =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#2563eb] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-amber-600/30 transition-all hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60';

export const UserManagement: React.FC<UserManagementProps> = ({ adminToken, onNavigate, onLogout }) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [password, setPassword] = useState('');
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [department, setDepartment] = useState('');
  const [studentYearLevel, setStudentYearLevel] = useState<number | ''>('');
  const [role, setRole] = useState<ManagedUserRole>('STUDENT');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingPasswordId, setEditingPasswordId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPasswordId, setSavingPasswordId] = useState<number | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<ManagedUser | null>(null);
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [savingNameId, setSavingNameId] = useState<number | null>(null);
  const [editSchoolId, setEditSchoolId] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [formMode, setFormMode] = useState<'manual' | 'import'>('manual');
  const [importFileName, setImportFileName] = useState('');
  const [importRows, setImportRows] = useState<StudentImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importInputKey, setImportInputKey] = useState(0);

  // Toast
  const [successNotice, setSuccessNotice] = useState('');
  const [noticeType, setNoticeType] = useState<NoticeType>('success');
  const [modalError, setModalError] = useState('');

  const showNotice = (message: string, type: NoticeType = 'success') => {
    setNoticeType(type);
    setSuccessNotice(message);
  };

  const clearNotice = () => setSuccessNotice('');

  useEffect(() => {
    if (!successNotice) return;
    const timer = window.setTimeout(() => setSuccessNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [successNotice]);

  useEffect(() => {
    if (!showInitialPassword) return;
    const timeoutId = window.setTimeout(() => setShowInitialPassword(false), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [showInitialPassword]);

  const loadUsersFromDatabase = async () => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const result = await readApiResponse<{ error?: string; users: ManagedUser[] }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to load users.');
    return result.users;
  };

  useEffect(() => {
    let active = true;
    const loadUsers = async () => {
      setIsLoading(true);
      try {
        const databaseUsers = await loadUsersFromDatabase();
        if (active) setUsers(databaseUsers);
      } catch (loadError) {
        if (active) {
          showNotice(loadError instanceof Error ? loadError.message : 'Unable to load users.', 'error');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadUsers();
    return () => { active = false; };
  }, [adminToken]);

  const resetManualForm = () => {
    setFirstName('');
    setLastName('');
    setSchoolId('');
    setPassword('');
    setShowInitialPassword(false);
    setDepartment('');
    setStudentYearLevel('');
    setRole('STUDENT');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedSchoolId = schoolId.trim();
    if (users.some((user) => user.schoolId.toLowerCase() === normalizedSchoolId.toLowerCase())) {
      showNotice('A user with this school ID already exists.', 'error');
      return;
    }
    if (role === 'STUDENT' && (!studentYearLevel || Number(studentYearLevel) < 1 || Number(studentYearLevel) > 4)) {
      showNotice('Student year level is required and must be between 1 and 4.', 'error');
      return;
    }
    setIsAdding(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          schoolId: normalizedSchoolId,
          password,
          role,
          firstName,
          lastName,
          department,
          yearLevel: role === 'STUDENT' ? Number(studentYearLevel) : undefined,
        }),
      });
      const result = await readApiResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || 'Unable to add user.');
      showNotice(`${roleLabels[role]} account created successfully.`);
      resetManualForm();
      try {
        setUsers(await loadUsersFromDatabase());
      } catch {
        showNotice('Account saved, but user list could not refresh. Reload this page.', 'error');
      }
    } catch (createError) {
      showNotice(createError instanceof Error ? createError.message : 'Unable to add user.', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    setImportFileName(file.name);
    setImportRows([]);
    setImportErrors([]);
    setIsParsingImport(true);

    try {
      const sheet = await readSheet(file);
      if (sheet.length < 2) {
        setImportErrors(['The workbook needs a header row and at least one student row.']);
        return;
      }

      const headers = sheet[0].map(normalizeHeader);
      const findColumn = (...names: string[]) => headers.findIndex((header) => names.includes(header));
      const columns = {
        schoolId: findColumn('schoolid', 'studentid'),
        firstName: findColumn('firstname', 'givenname'),
        lastName: findColumn('lastname', 'familyname'),
        password: findColumn('initialpassword', 'password'),
        course: findColumn('course', 'program'),
        yearLevel: findColumn('yearlevel', 'year'),
      };
      const requiredColumns = ['schoolId', 'firstName', 'lastName', 'password', 'course', 'yearLevel'] as const;
      const missingColumns = requiredColumns.filter((column) => columns[column] < 0);
      if (missingColumns.length) {
        setImportErrors([`Missing required columns: ${missingColumns.join(', ')}.`]);
        return;
      }

      const dataRows = sheet.slice(1).filter((row) => row.some((cell) => cellText(cell) !== ''));
      if (!dataRows.length) {
        setImportErrors(['The spreadsheet has no student rows.']);
        return;
      }
      if (dataRows.length > MAX_STUDENT_IMPORT_ROWS) {
        setImportErrors([`Import no more than ${MAX_STUDENT_IMPORT_ROWS} students at a time.`]);
        return;
      }

      const knownSchoolIds = new Set(users.map((user) => user.schoolId.toLowerCase()));
      const seenSchoolIds = new Set<string>();
      const preview = dataRows.map((row, index): StudentImportRow => {
        const sid = cellText(row[columns.schoolId]);
        const fn = cellText(row[columns.firstName]);
        const ln = cellText(row[columns.lastName]);
        const pw = cellText(row[columns.password]);
        const course = columns.course < 0 ? '' : cellText(row[columns.course]);
        const yearText = columns.yearLevel < 0 ? '' : cellText(row[columns.yearLevel]);
        const yearLevel = yearText ? Number(yearText) : null;
        const errors: string[] = [];
        const normalizedId = sid.toLowerCase();

        if (!sid) errors.push('Missing school ID');
        else if (knownSchoolIds.has(normalizedId)) errors.push('School ID already exists');
        else if (seenSchoolIds.has(normalizedId)) errors.push('Duplicate school ID in file');
        if (!fn) errors.push('Missing first name');
        if (!ln) errors.push('Missing last name');
        if (pw.length < 8) errors.push('Password must be at least 8 characters');
        if (!course) errors.push('Missing course');
        if (!yearText) errors.push('Missing year level');
        else if (!Number.isInteger(yearLevel) || yearLevel! < 1 || yearLevel! > 4) {
          errors.push('Year level must be 1 to 4');
        }
        if (normalizedId) seenSchoolIds.add(normalizedId);

        return { schoolId: sid, firstName: fn, lastName: ln, password: pw, course, yearLevel, rowNumber: index + 2, errors };
      });
      setImportRows(preview);
    } catch (parseError) {
      setImportErrors([parseError instanceof Error ? parseError.message : 'Unable to read this Excel file.']);
    } finally {
      setIsParsingImport(false);
    }
  };

  const handleImportSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const readyRows = importRows.filter((row) => !row.errors.length);
    if (!readyRows.length) return;
    setIsImporting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users/import/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          students: readyRows.map(({ schoolId, firstName, lastName, password, course, yearLevel }) => ({
            schoolId, firstName, lastName, password, course, yearLevel,
          })),
        }),
      });
      const result = await readApiResponse<{
        error?: string;
        details?: string[];
        schoolIds?: string[];
        created?: number;
      }>(response);
      if (!response.ok) {
        const details = result.details?.join(' ') || result.schoolIds?.join(', ');
        throw new Error(details ? `${result.error} ${details}` : result.error || 'Unable to import students.');
      }

      setImportRows([]);
      setImportFileName('');
      setImportInputKey((key) => key + 1);
      const skippedCount = importRows.length - readyRows.length;
      showNotice(
        `${result.created ?? 0} student accounts imported.${skippedCount ? ` ${skippedCount} row${skippedCount === 1 ? '' : 's'} skipped due to errors.` : ''}`,
      );
      setUsers(await loadUsersFromDatabase());
    } catch (importError) {
      showNotice(importError instanceof Error ? importError.message : 'Unable to import students.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handlePasswordUpdate = async (userId: number) => {
    if (newPassword.length < 8) {
      showNotice('Password must be at least 8 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotice('The passwords do not match.', 'error');
      return;
    }
    setSavingPasswordId(userId);
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ newPassword }),
      });
      const result = await readApiResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || 'Unable to update password.');
      const updatedUser = users.find((user) => user.id === userId);
      const name = updatedUser?.fullName || updatedUser?.schoolId || 'user';
      showNotice(`Password updated for ${name}.`);
      setEditingPasswordId(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (updateError) {
      showNotice(updateError instanceof Error ? updateError.message : 'Unable to update password.', 'error');
    } finally {
      setSavingPasswordId(null);
    }
  };

  const handleDeleteUser = async (user: ManagedUser) => {
    setDeletingUserId(user.id);
    setModalError('');
    try {
      const response = await fetch(`${API_BASE_URL}/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!response.ok) {
        const result = await readApiResponse<{ error?: string }>(response);
        throw new Error(result.error || 'Unable to delete user.');
      }
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setSelectedUserIds((current) => current.filter((id) => id !== user.id));
      if (editingPasswordId === user.id) {
        setEditingPasswordId(null);
        setNewPassword('');
        setConfirmPassword('');
      }
      setPendingDeleteUser(null);
      showNotice(`${roleLabels[user.role]} account ${user.schoolId} deleted.`, 'delete');
    } catch (deleteError) {
      setModalError(deleteError instanceof Error ? deleteError.message : 'Unable to delete user.');
    } finally {
      setDeletingUserId(null);
    }
  };

  const beginNameEdit = (user: ManagedUser) => {
    setEditingNameId(user.id);
    setEditFirstName(user.firstName || '');
    setEditLastName(user.lastName || '');
    setEditSchoolId(user.schoolId);
    setEditingPasswordId(null);
  };

  const cancelNameEdit = () => {
    setEditingNameId(null);
    setEditFirstName('');
    setEditLastName('');
    setEditSchoolId('');
  };

  const handleNameUpdate = async (userId: number) => {
    const first = editFirstName.trim();
    const last = editLastName.trim();
    if (!first || !last) {
      showNotice('First and last names are required.', 'error');
      return;
    }
    setSavingNameId(userId);
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ firstName: first, lastName: last }),
      });
      const result = await readApiResponse<{
        error?: string;
        user: { firstName: string; lastName: string; fullName: string };
      }>(response);
      if (!response.ok) throw new Error(result.error || 'Unable to update user name.');
      setUsers((current) => current.map((user) => user.id === userId ? { ...user, ...result.user } : user));
      showNotice(`Name updated successfully.`);
      cancelNameEdit();
    } catch (updateError) {
      showNotice(updateError instanceof Error ? updateError.message : 'Unable to update user name.', 'error');
    } finally {
      setSavingNameId(null);
    }
  };

  const selectableUsers = users.filter((user) => !user.isCurrentUser);
  const allSelected = selectableUsers.length > 0 && selectableUsers.every((user) => selectedUserIds.includes(user.id));
  const someSelected = selectedUserIds.length > 0 && !allSelected;

  const toggleUserSelected = (userId: number) => {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const toggleSelectAll = () => {
    setSelectedUserIds(allSelected ? [] : selectableUsers.map((user) => user.id));
  };

  const handleBulkDelete = async () => {
    if (!selectedUserIds.length) return;
    setIsBulkDeleting(true);
    setModalError('');
    try {
      const response = await fetch(`${API_BASE_URL}/users/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ ids: selectedUserIds }),
      });
      const result = await readApiResponse<{ error?: string; deleted?: number }>(response);
      if (!response.ok) throw new Error(result.error || 'Unable to delete users.');

      const deletedIds = new Set(selectedUserIds);
      setUsers((current) => current.filter((item) => !deletedIds.has(item.id)));
      if (editingPasswordId !== null && deletedIds.has(editingPasswordId)) {
        setEditingPasswordId(null);
        setNewPassword('');
        setConfirmPassword('');
      }
      if (editingNameId !== null && deletedIds.has(editingNameId)) cancelNameEdit();
      setSelectedUserIds([]);
      setPendingBulkDelete(false);
      const count = result.deleted ?? deletedIds.size;
      showNotice(`${count} account${count === 1 ? '' : 's'} deleted.`, 'delete');
    } catch (deleteError) {
      setModalError(deleteError instanceof Error ? deleteError.message : 'Unable to delete users.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleUserUpdate = async (userId: number) => {
    const target = users.find((item) => item.id === userId);
    if (!target) return;

    const canEditName = !target.isCurrentUser && target.role !== 'ADMIN';
    const nextSchoolId = editSchoolId.trim();
    if (!nextSchoolId) {
      showNotice('School ID is required.', 'error');
      return;
    }
    if (nextSchoolId.length > 191) {
      showNotice('School ID must be 191 characters or fewer.', 'error');
      return;
    }

    const schoolIdChanged = nextSchoolId !== target.schoolId;
    const nameChanged =
      canEditName &&
      (editFirstName.trim() !== (target.firstName || '') || editLastName.trim() !== (target.lastName || ''));

    if (canEditName && nameChanged && (!editFirstName.trim() || !editLastName.trim())) {
      showNotice('First and last names are required.', 'error');
      return;
    }
    if (
      schoolIdChanged &&
      users.some((item) => item.id !== userId && item.schoolId.toLowerCase() === nextSchoolId.toLowerCase())
    ) {
      showNotice('A user with this school ID already exists.', 'error');
      return;
    }
    if (!schoolIdChanged && !nameChanged) {
      cancelNameEdit();
      return;
    }

    if (schoolIdChanged) {
      setSavingNameId(userId);
      try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}/school-id`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ schoolId: nextSchoolId }),
        });
        const result = await readApiResponse<{ error?: string; user: { schoolId: string } }>(response);
        if (!response.ok) throw new Error(result.error || 'Unable to update school ID.');
        setUsers((current) =>
          current.map((item) => item.id === userId ? { ...item, schoolId: result.user.schoolId } : item),
        );
        if (!nameChanged) {
          showNotice('School ID updated successfully.');
          cancelNameEdit();
        }
      } catch (updateError) {
        showNotice(updateError instanceof Error ? updateError.message : 'Unable to update school ID.', 'error');
        return;
      } finally {
        setSavingNameId(null);
      }
    }

    if (nameChanged) await handleNameUpdate(userId);
  };

  const isDeleteToast = noticeType === 'delete';
  const isErrorToast = noticeType === 'error';
  const toastAccent = isDeleteToast ? 'bg-rose-500' : isErrorToast ? 'bg-rose-500' : 'bg-emerald-500';
  const toastBorder = isDeleteToast || isErrorToast ? 'border-rose-200' : 'border-emerald-200';
  const toastLabel = isDeleteToast || isErrorToast ? 'text-rose-600' : 'text-emerald-600';
  const toastTitle = isDeleteToast ? 'Deleted' : isErrorToast ? 'Error' : 'Success';

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#eef1f7]">
      <ClamsHeader onNavigate={onNavigate} statusLabel="Computer Laboratory System" showLogout={false} />

      <div className="clams-layout">
        <AdminSubNav activeScreen="admin-user-management" onNavigate={onNavigate} onLogout={onLogout} />

        <main className="space-y-6">
          {/* Page header */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#1b325f]/15 bg-gradient-to-r from-[#1b325f]/[0.04] to-transparent px-6 py-5 shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-[#1b325f]">User Management</h1>
              <p className="mt-1 text-sm text-slate-500">
                Add accounts, manage passwords, and remove users.
              </p>
            </div>
            <span className="rounded-lg border border-[#1b325f]/15 bg-white px-4 py-2 text-sm font-semibold text-[#1b325f] shadow-sm">
              {users.length} account{users.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.6fr)]">
            {/* ── Form panel ── */}
            <form
              onSubmit={formMode === 'manual' ? handleSubmit : handleImportSubmit}
              className="space-y-5 overflow-hidden rounded-2xl border border-[#1b325f]/10 bg-white shadow-sm"
            >
              {/* Tabs */}
              <div className="flex border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => setFormMode('manual')}
                  className={`flex-1 cursor-pointer px-4 py-4 text-sm font-semibold transition-colors ${formMode === 'manual'
                    ? 'border-b-2 border-[#1b325f] text-[#1b325f]'
                    : 'border-b-2 border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                  Add One
                </button>
                <button
                  type="button"
                  onClick={() => setFormMode('import')}
                  className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-2 px-4 py-4 text-sm font-semibold transition-colors ${formMode === 'import'
                    ? 'border-b-2 border-[#1b325f] text-[#1b325f]'
                    : 'border-b-2 border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Import Excel
                </button>
              </div>

              {formMode === 'manual' ? (
                <div className="space-y-4 px-6 pb-6">
                  <h2 className="text-base font-bold text-slate-900">
                    Add {roleLabels[role]}
                  </h2>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-700">
                      First name
                      <input
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">
                      Last name
                      <input
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15"
                      />
                    </label>
                  </div>

                  <label className="block text-xs font-semibold text-slate-700">
                    School ID
                    <input
                      required
                      value={schoolId}
                      onChange={(e) => setSchoolId(e.target.value)}
                      placeholder="e.g. 24-10326"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2.5 font-mono text-sm text-slate-900 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Role
                    <select
                      value={role}
                      onChange={(e) => {
                        setRole(e.target.value as ManagedUserRole);
                        if (e.target.value !== 'STUDENT') setStudentYearLevel('');
                      }}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#1b325f] focus:ring-4 focus:ring-[#1b325f]/15"
                    >
                      <option value="STUDENT">Student</option>
                      <option value="INSTRUCTOR">Instructor</option>
                      <option value="CUSTODIAN">Custodian</option>
                    </select>
                  </label>

                  {role === 'STUDENT' && (
                    <label className="block text-xs font-semibold text-slate-700">
                      Year level
                      <select
                        required
                        value={studentYearLevel}
                        onChange={(e) => setStudentYearLevel(e.target.value ? Number(e.target.value) : '')}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#1b325f] focus:ring-4 focus:ring-[#1b325f]/15"
                      >
                        <option value="">Select year</option>
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                      </select>
                    </label>
                  )}

                  <label className="block text-xs font-semibold text-slate-700">
                    Initial password
                    <span className="relative mt-1.5 block">
                      <input
                        required
                        minLength={8}
                        type={showInitialPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2.5 pr-10 text-sm text-slate-900 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15"
                      />
                      <button
                        type="button"
                        onClick={() => setShowInitialPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-slate-500 hover:text-slate-800"
                        aria-label="Toggle password visibility"
                      >
                        {showInitialPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={isAdding}
                    className={`${PRIMARY_BTN} w-full justify-center`}
                  >
                    <Plus className="h-4 w-4" />
                    {isAdding ? 'Saving...' : `Add ${roleLabels[role]}`}
                  </button>
                </div>
              ) : (
                <div className="space-y-4 px-6 pb-6">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Import Students</h2>
                    <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                      Student accounts only. Instructor, custodian, and admin accounts must be added manually.
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Upload an .xlsx with columns: School ID, First Name, Last Name, Initial Password, Course, Year Level. Year Level must be 1–4.
                    </p>
                  </div>

                  <label className="block text-xs font-semibold text-slate-700">
                    Excel workbook (.xlsx)
                    <input
                      key={importInputKey}
                      type="file"
                      accept=".xlsx"
                      onChange={(e) => void handleImportFile(e.target.files?.[0])}
                      className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white text-xs text-slate-600 file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-2.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                    />
                  </label>

                  {importFileName && <p className="text-xs text-slate-600">Selected: {importFileName}</p>}
                  {isParsingImport && <p className="text-xs text-slate-500">Reading workbook...</p>}
                  {importErrors.map((message) => (
                    <p key={message} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {message}
                    </p>
                  ))}

                  {importRows.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">Preview ({importRows.length} rows)</span>
                        <span className={importRows.some((r) => r.errors.length) ? 'text-rose-700' : 'text-emerald-700'}>
                          {importRows.filter((r) => !r.errors.length).length} ready{importRows.some((r) => r.errors.length) ? `, ${importRows.filter((r) => r.errors.length).length} will be skipped` : ''}
                        </span>
                      </div>
                      <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
                        <table className="w-full text-left text-[11px]">
                          <thead className="sticky top-0 bg-[#1b325f] text-white">
                            <tr>
                              <th className="px-2 py-2 font-semibold">Row</th>
                              <th className="px-2 py-2 font-semibold">School ID</th>
                              <th className="px-2 py-2 font-semibold">Student</th>
                              <th className="px-2 py-2 font-semibold">Validation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {importRows.map((row) => (
                              <tr key={`${row.rowNumber}-${row.schoolId}`}>
                                <td className="px-2 py-2 font-mono">{row.rowNumber}</td>
                                <td className="px-2 py-2 font-mono">{row.schoolId || '—'}</td>
                                <td className="px-2 py-2">{`${row.firstName} ${row.lastName}`.trim() || '—'}</td>
                                <td className={`px-2 py-2 ${row.errors.length ? 'text-rose-700' : 'text-emerald-700'}`}>
                                  {row.errors.join('; ') || 'Ready'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isImporting || isParsingImport || !importRows.some((r) => !r.errors.length)}
                    className={`${PRIMARY_BTN} w-full justify-center`}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    {isImporting ? 'Importing...' : `Import ${importRows.filter((r) => !r.errors.length).length} Students`}
                  </button>
                </div>
              )}
            </form>

            {/* ── User list ── */}
            <section className="overflow-hidden rounded-2xl border border-[#1b325f]/10 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
                <h2 className="text-base font-bold text-[#1b325f]">Accounts</h2>
                {selectedUserIds.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600">
                      {selectedUserIds.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedUserIds([])}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingBulkDelete(true);
                        setModalError('');
                      }}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Selected
                    </button>
                  </div>
                )}
              </div>

              {isLoading ? (
                <p className="px-6 py-16 text-center text-sm text-slate-500">Loading users...</p>
              ) : users.length === 0 ? (
                <p className="px-6 py-16 text-center text-sm text-slate-500">No users yet.</p>
              ) : (
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-[#1b325f] text-xs font-bold uppercase tracking-wider text-white">
                      <tr>
                        <th className="w-12 px-5 py-4">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected;
                            }}
                            onChange={toggleSelectAll}
                            disabled={selectableUsers.length === 0}
                            aria-label="Select all users"
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-[#2563eb]"
                          />
                        </th>
                        <th className="px-5 py-4 text-left font-semibold text-white/70">Name</th>
                        <th className="px-4 py-4 text-left font-semibold text-white/70">School ID</th>
                        <th className="px-4 py-4 text-left font-semibold text-white/70">Role</th>
                        <th className="px-5 py-4 text-right font-semibold text-white/70">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map((user) => (
                        <React.Fragment key={user.id}>
                          <tr className={`transition-colors hover:bg-[#1b325f]/[0.02] ${selectedUserIds.includes(user.id) ? 'bg-blue-50/60' : ''}`}>
                            <td className="w-12 px-5 py-4">
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(user.id)}
                                onChange={() => toggleUserSelected(user.id)}
                                disabled={user.isCurrentUser}
                                title={user.isCurrentUser ? 'Cannot select yourself' : 'Select user'}
                                aria-label={`Select ${user.schoolId}`}
                                className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-[#2563eb] disabled:cursor-not-allowed disabled:opacity-40"
                              />
                            </td>
                            <td className="px-5 py-4 font-semibold text-slate-800">
                              {editingNameId === user.id ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {(user.isCurrentUser || user.role === 'ADMIN') && (
                                    <span className="font-normal text-slate-500 sm:col-span-2">
                                      {user.isCurrentUser ? 'Admin' : user.fullName || 'Name not on file'}
                                    </span>
                                  )}
                                  <input
                                    value={editFirstName}
                                    onChange={(e) => setEditFirstName(e.target.value)}
                                    maxLength={191}
                                    className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-normal focus:border-[#1b325f] focus:outline-none"
                                    aria-label="First name"
                                    hidden={user.isCurrentUser || user.role === 'ADMIN'}
                                  />
                                  <input
                                    value={editLastName}
                                    onChange={(e) => setEditLastName(e.target.value)}
                                    maxLength={191}
                                    className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-normal focus:border-[#1b325f] focus:outline-none"
                                    aria-label="Last name"
                                    hidden={user.isCurrentUser || user.role === 'ADMIN'}
                                  />
                                </div>
                              ) : (
                                user.isCurrentUser ? 'Admin' : user.fullName || 'Name not on file'
                              )}
                            </td>
                            <td className="px-4 py-4 font-mono text-xs text-slate-600">
                              {editingNameId === user.id ? (
                                <input
                                  value={editSchoolId}
                                  onChange={(e) => setEditSchoolId(e.target.value)}
                                  maxLength={191}
                                  className="w-full min-w-[8rem] rounded-lg border border-slate-300 px-2.5 py-2 font-mono text-sm text-slate-900 focus:border-[#1b325f] focus:outline-none"
                                  aria-label="School ID"
                                />
                              ) : (
                                user.schoolId
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <span>
                                {roleLabels[user.role]}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                {editingNameId === user.id ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => void handleUserUpdate(user.id)}
                                      disabled={savingNameId === user.id}
                                      className={PRIMARY_BTN_SM}
                                    >
                                      <Save className="h-3.5 w-3.5" />
                                      {savingNameId === user.id ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelNameEdit}
                                      disabled={savingNameId === user.id}
                                      className="rounded-md border border-slate-300 p-2 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
                                      aria-label="Cancel"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {(
                                      <button
                                        type="button"
                                        onClick={() => beginNameEdit(user)}
                                        className="rounded-md p-2 text-slate-500 transition-colors hover:bg-[#1b325f]/10 hover:text-[#1b325f]"
                                        title="Edit user"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingPasswordId(editingPasswordId === user.id ? null : user.id);
                                        setNewPassword('');
                                        setConfirmPassword('');
                                      }}
                                      className="rounded-md p-2 text-slate-500 transition-colors hover:bg-[#1b325f]/10 hover:text-[#1b325f]"
                                      title="Change password"
                                    >
                                      <KeyRound className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPendingDeleteUser(user);
                                        setModalError('');
                                      }}
                                      disabled={user.isCurrentUser}
                                      title={user.isCurrentUser ? 'Cannot delete yourself' : 'Delete user'}
                                      className="rounded-md p-2 text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                          {editingPasswordId === user.id && (
                            <tr>
                              <td colSpan={5} className="bg-slate-50 px-5 py-4">
                                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                                  <label className="block text-xs font-semibold text-slate-700">
                                    New password
                                    <input
                                      type="password"
                                      minLength={8}
                                      autoComplete="new-password"
                                      value={newPassword}
                                      onChange={(e) => setNewPassword(e.target.value)}
                                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal focus:border-[#1b325f] focus:outline-none"
                                    />
                                  </label>
                                  <label className="block text-xs font-semibold text-slate-700">
                                    Confirm password
                                    <input
                                      type="password"
                                      minLength={8}
                                      autoComplete="new-password"
                                      value={confirmPassword}
                                      onChange={(e) => setConfirmPassword(e.target.value)}
                                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal focus:border-[#1b325f] focus:outline-none"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => void handlePasswordUpdate(user.id)}
                                    disabled={savingPasswordId === user.id || !newPassword || !confirmPassword}
                                    className={PRIMARY_BTN_SM}
                                  >
                                    <Save className="h-3.5 w-3.5" />
                                    {savingPasswordId === user.id ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingPasswordId(null);
                                      setNewPassword('');
                                      setConfirmPassword('');
                                    }}
                                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 p-2.5 text-slate-600 transition-colors hover:bg-white"
                                    aria-label="Cancel"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      {/* Import loading overlay */}
      {(isImporting || isParsingImport) && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0f1a30]/70 px-4 backdrop-blur-sm"
        >
          <div className="animate-pop-in w-full max-w-sm rounded-2xl bg-white px-6 py-8 text-center shadow-2xl">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#2563eb]" />
            <h2 className="mt-5 text-base font-bold text-[#1b325f]">
              {isImporting ? `Importing ${importRows.filter((r) => !r.errors.length).length} students...` : 'Reading workbook...'}
            </h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {isImporting
                ? 'Creating accounts. Large imports can take a minute, so please keep this page open.'
                : 'Checking every row for errors.'}
            </p>
          </div>
        </div>
      )}

      {/* Toast */}
      {successNotice && (
        <div className="fixed right-6 top-6 z-[60] animate-toast-in">
          <div className={`flex items-center gap-3 overflow-hidden rounded-xl border bg-white px-5 py-4 shadow-2xl ${toastBorder}`}>
            <div className={`h-10 w-1 shrink-0 rounded-full ${toastAccent}`} />
            <div className="min-w-0">
              <div className={`text-xs font-bold uppercase tracking-wider ${toastLabel}`}>{toastTitle}</div>
              <div className="mt-0.5 text-sm text-slate-700">{successNotice}</div>
            </div>
            <button
              type="button"
              onClick={clearNotice}
              className="ml-2 rounded-md p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation */}
      {pendingBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1a30]/70 px-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            className="animate-pop-in w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl shadow-rose-900/20"
          >
            <div className="bg-rose-700 px-6 py-4">
              <h2 className="text-lg font-bold text-white">
                Delete {selectedUserIds.length} account{selectedUserIds.length === 1 ? '' : 's'}?
              </h2>
            </div>
            <div className="space-y-4 px-6 py-6">
              <p className="text-sm leading-relaxed text-slate-600">
                This will permanently delete the selected account{selectedUserIds.length === 1 ? '' : 's'}. This action cannot be undone.
              </p>
              <div className="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <ul className="space-y-1 text-xs text-slate-700">
                  {users
                    .filter((item) => selectedUserIds.includes(item.id))
                    .map((item) => (
                      <li key={item.id} className="flex justify-between gap-3">
                        <span className="font-mono font-semibold">{item.schoolId}</span>
                        <span className="truncate">{item.fullName || roleLabels[item.role]}</span>
                      </li>
                    ))}
                </ul>
              </div>
              {modalError && (
                <p role="alert" className="text-sm font-medium text-rose-700">{modalError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => { setPendingBulkDelete(false); setModalError(''); }}
                disabled={isBulkDeleting}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleBulkDelete()}
                disabled={isBulkDeleting}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {isBulkDeleting ? 'Deleting...' : `Delete ${selectedUserIds.length} user${selectedUserIds.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Delete confirmation */}
      {pendingDeleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1a30]/70 px-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            className="animate-pop-in w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl shadow-rose-900/20"
          >
            <div className="bg-rose-700 px-6 py-4">
              <h2 className="text-lg font-bold text-white">
                Delete {roleLabels[pendingDeleteUser.role].toLowerCase()}?
              </h2>
            </div>
            <div className="space-y-4 px-6 py-6">
              <p className="text-sm leading-relaxed text-slate-600">
                Delete{' '}
                <span className="font-mono font-bold text-slate-800">{pendingDeleteUser.schoolId}</span>
                {pendingDeleteUser.fullName && (
                  <>
                    {' '}—{' '}
                    <span className="font-semibold text-slate-800">{pendingDeleteUser.fullName}</span>
                  </>
                )}
                ?
              </p>
              {modalError && (
                <p role="alert" className="text-sm font-medium text-rose-700">{modalError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => { setPendingDeleteUser(null); setModalError(''); }}
                disabled={deletingUserId === pendingDeleteUser.id}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteUser(pendingDeleteUser)}
                disabled={deletingUserId === pendingDeleteUser.id}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {deletingUserId === pendingDeleteUser.id ? 'Deleting...' : 'Delete user'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};