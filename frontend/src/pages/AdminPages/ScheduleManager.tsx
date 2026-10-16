import React, { useState, useEffect } from 'react';
import { Plus, SlidersHorizontal, Trash2, Users, X } from 'lucide-react';
import { ClamsHeader } from '../../components/ClamsHeader';
import { AdminSubNav } from '../../components/AdminComponents/AdminSubNav';
import { API_BASE_URL } from '../../api';
import type {
  ScheduleEntry,
  ScheduleInstructorOption,
  ScheduleLabRoomOption,
  WireframeScreenId,
} from '../../types';

/* ---------------- Types ---------------- */

interface SubjectOption {
  id: number;
  code: string;
  title: string;
  yearLevel?: number | null;
}

interface TermOption {
  id: number;
  academicYear: string;
  semester: string;
  isActive: boolean;
}

type NoticeType = 'success' | 'delete';

/* ---------------- Helpers ---------------- */

const timeToMinutes = (time: string) => {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const [, hourText, minuteText, period] = match;
  let hour = Number(hourText) % 12;
  if (period.toUpperCase() === 'PM') hour += 12;
  return hour * 60 + Number(minuteText);
};

const toInputTime = (time: string) => {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '14:00';
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
};

const toScheduleTime = (time: string) => {
  const [hourText, minute] = time.split(':');
  const hour = Number(hourText);
  const period = hour >= 12 ? 'PM' : 'AM';
  return `${String(hour % 12 || 12).padStart(2, '0')}:${minute} ${period}`;
};

const DAYS: Array<{ key: ScheduleEntry['day']; label: string }> = [
  { key: 'Mon', label: 'Monday' },
  { key: 'Tue', label: 'Tuesday' },
  { key: 'Wed', label: 'Wednesday' },
  { key: 'Thu', label: 'Thursday' },
  { key: 'Fri', label: 'Friday' },
];

const ALL_DAYS: ScheduleEntry['day'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const YEAR_LEVELS = [
  { value: 1, label: '1st Year' },
  { value: 2, label: '2nd Year' },
  { value: 3, label: '3rd Year' },
  { value: 4, label: '4th Year' },
];

const createDraft = (day: ScheduleEntry['day'] = 'Mon', startTime = '02:00 PM'): ScheduleEntry => ({
  id: '',
  instructorId: 0,
  labRoomId: 0,
  day,
  startTime,
  endTime: '04:00 PM',
  subject: '',
  teacher: '',
  room: '',
  department: '',
  semester: '',
  colorTheme: 'blue',
  termId: null,
  section: 'A',
  yearLevel: 1,
});

/* ================================================================
 * FORM MODAL
 * ================================================================ */

interface ScheduleFormModalProps {
  editingSchedule: ScheduleEntry;
  instructors: ScheduleInstructorOption[];
  labRooms: ScheduleLabRoomOption[];
  token: string;
  onSaveSchedule: (entry: ScheduleEntry) => Promise<void>;
  onDeleteSchedule: (id: string) => Promise<void>;
  onManageRoster: (entry: ScheduleEntry) => void;
  onClose: () => void;
  onSaved: (message?: string) => void;
  onDeleted: (message?: string) => void;
}

const ScheduleFormModal: React.FC<ScheduleFormModalProps> = ({
  editingSchedule,
  instructors,
  labRooms,
  token,
  onSaveSchedule,
  onDeleteSchedule,
  onManageRoster,
  onClose,
  onSaved,
  onDeleted,
}) => {
  const isEdit = editingSchedule.id !== '';

  const [labRoomId, setLabRoomId] = useState(editingSchedule.labRoomId || 0);
  const [instructorId, setInstructorId] = useState(editingSchedule.instructorId || 0);

  const [selectedDays, setSelectedDays] = useState<Set<ScheduleEntry['day']>>(
    new Set([editingSchedule.day])
  );

  const toggleDay = (day: ScheduleEntry['day']) => {
    if (isEdit) {
      setSelectedDays(new Set([day]));
      return;
    }
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        if (next.size > 1) next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  };

  const [startTime, setStartTime] = useState(toInputTime(editingSchedule.startTime));
  const [endTime, setEndTime] = useState(toInputTime(editingSchedule.endTime));

  const [subjectCode, setSubjectCode] = useState(editingSchedule.subject || '');
  const [termId, setTermId] = useState<number | ''>(editingSchedule.termId ?? '');
  const [section, setSection] = useState<string>(editingSchedule.section || 'A');
  const [yearLevel, setYearLevel] = useState<number>(editingSchedule.yearLevel ?? 1);

  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [assignedSubjectIds, setAssignedSubjectIds] = useState<number[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [actionError, setActionError] = useState('');
  const [showDeleteChoice, setShowDeleteChoice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [subRes, termRes] = await Promise.all([
          fetch(`${API_BASE_URL}/subjects`, { headers }),
          fetch(`${API_BASE_URL}/terms`, { headers }),
        ]);
        const subJson = await subRes.json();
        const termJson = await termRes.json();
        if (cancelled) return;
        setSubjects(subJson.subjects || []);
        setTerms(termJson.terms || []);

        if (!isEdit && termJson.terms?.length) {
          const active = termJson.terms.find((t: TermOption) => t.isActive);
          if (active) setTermId(active.id);
        }
      } catch {
        if (!cancelled) setActionError('Could not load subjects or terms.');
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [token, isEdit]);

  useEffect(() => {
    let cancelled = false;
    const loadAssignments = async () => {
      if (!instructorId) {
        setAssignedSubjectIds([]);
        return;
      }
      try {
        const response = await fetch(
          `${API_BASE_URL}/instructor-subjects/${instructorId}/subjects`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load instructor subjects.');
        if (!cancelled) setAssignedSubjectIds((data.subjects || []).map((subject: SubjectOption) => subject.id));
      } catch {
        if (!cancelled) setAssignedSubjectIds([]);
      }
    };
    void loadAssignments();
    return () => { cancelled = true; };
  }, [instructorId, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setActionError('');

    const selectedTerm = terms.find((t) => t.id === termId);
    const days = Array.from(selectedDays);

    const baseEntry = {
      instructorId,
      labRoomId,
      startTime: toScheduleTime(startTime),
      endTime: toScheduleTime(endTime),
      subject: subjectCode,
      teacher: instructors.find((i) => i.id === instructorId)
        ? `${instructors.find((i) => i.id === instructorId)!.firstName} ${instructors.find((i) => i.id === instructorId)!.lastName}`
        : '',
      room: labRooms.find((r) => r.id === labRoomId)?.roomName || '',
      department: instructors.find((i) => i.id === instructorId)?.department || '',
      semester: selectedTerm ? `${selectedTerm.academicYear} ${selectedTerm.semester}` : '',
      colorTheme: editingSchedule.colorTheme || ('blue' as const),
      termId: termId || null,
      section,
      yearLevel,
    };

    try {
      if (isEdit) {
        await onSaveSchedule({
          ...baseEntry,
          id: editingSchedule.id,
          day: days[0],
        } as ScheduleEntry);
        onSaved('Schedule updated successfully.');
      } else {
        const created: string[] = [];
        const failures: string[] = [];

        for (const day of days) {
          try {
            await onSaveSchedule({
              ...baseEntry,
              id: '',
              day,
            } as ScheduleEntry);
            created.push(day);
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            failures.push(`${day}: ${msg}`);
          }
        }

        if (failures.length > 0) {
          if (created.length === 0) {
            throw new Error(failures[0]);
          }
          throw new Error(
            `Created ${created.length} of ${days.length} schedules. ${failures.join('; ')}`
          );
        }

        onSaved(
          created.length === 1
            ? 'Schedule created successfully.'
            : `${created.length} schedules created successfully.`
        );
      }
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : 'Unable to save schedule.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (withRecords = false) => {
    if (!isEdit) return;
    setActionError('');
    try {
      await (onDeleteSchedule as (id: string, withRecords?: boolean) => Promise<void>)(editingSchedule.id, withRecords);
      onDeleted('Schedule deleted successfully.');
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Unable to delete schedule.');
      setShowDeleteChoice(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1a30]/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="animate-pop-in relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl shadow-[#1b325f]/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Navy header — matches login aesthetic */}
        <div className="flex items-center justify-between bg-[#1b325f] px-6 py-4">
          <h1 className="text-lg font-bold text-white">
            {isEdit ? 'Edit Schedule' : 'Create Schedule'}
          </h1>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-1.5 text-white/80 ring-1 ring-white/20 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5 text-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Lab Room</label>
              <select
                required
                value={labRoomId || ''}
                onChange={(e) => setLabRoomId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2.5 font-medium text-slate-800 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15"
              >
                <option value="" disabled>Select</option>
                {labRooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.roomName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Subject</label>
              <select
                required
                disabled={loadingOptions}
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2.5 font-medium text-slate-800 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15 disabled:opacity-60"
              >
                <option value="" disabled>
                  {loadingOptions ? 'Loading...' : 'Select'}
                </option>
                {subjects.some((s) => assignedSubjectIds.includes(s.id)) && (
                  <optgroup label="Assigned to teacher">
                    {subjects.filter((s) => assignedSubjectIds.includes(s.id)).map((s) => (
                      <option key={s.id} value={s.code}>{s.code} — {s.title}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Other subjects">
                  {subjects.filter((s) => !assignedSubjectIds.includes(s.id)).map((s) => (
                    <option key={s.id} value={s.code}>{s.code} — {s.title}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Teacher</label>
              <select
                required
                value={instructorId || ''}
                onChange={(e) => setInstructorId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2.5 font-medium text-slate-800 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15"
              >
                <option value="" disabled>Select</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>{i.firstName} {i.lastName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Term</label>
              <select
                required
                disabled={loadingOptions}
                value={termId}
                onChange={(e) => setTermId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2.5 font-medium text-slate-800 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15 disabled:opacity-60"
              >
                <option value="" disabled>
                  {loadingOptions ? 'Loading...' : 'Select'}
                </option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.academicYear} · {t.semester}{t.isActive ? ' ★' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Section</label>
              <input
                type="text"
                required
                value={section}
                onChange={(e) => {
                  const letter = e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 1);
                  setSection(letter.toUpperCase());
                }}
                onKeyDown={(e) => {
                  if (e.key.length === 1 && !/[A-Za-z]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                  }
                }}
                placeholder="A"
                maxLength={1}
                pattern="[A-Za-z]"
                className="w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2.5 font-medium uppercase text-slate-800 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Year Level</label>
              <select
                required
                value={yearLevel}
                onChange={(e) => setYearLevel(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2.5 font-medium text-slate-800 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15"
              >
                {YEAR_LEVELS.map((y) => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </select>
            </div>
          </div>

          {actionError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {actionError}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_1fr]">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {isEdit ? 'Day of Week' : 'Days'}
                {!isEdit && (
                  <span className="ml-2 font-normal text-slate-400">
                    — creates a schedule for each
                  </span>
                )}
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {ALL_DAYS.map((day) => {
                  const active = selectedDays.has(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      aria-pressed={active}
                      className={`cursor-pointer rounded-lg py-2.5 text-xs font-semibold transition-all ${active
                        ? 'bg-[#2563eb] text-white shadow-md shadow-amber-600/30'
                        : 'border border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Start Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2.5 font-mono text-sm font-medium tabular-nums text-slate-800 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15"
              />
            </div>

            <div>
              {showDeleteChoice && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0f1a30]/60 px-4 backdrop-blur-sm">
                  <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl shadow-rose-900/30">
                    <div className="bg-rose-700 px-6 py-4">
                      <h2 className="text-lg font-bold text-white">Delete schedule?</h2>
                    </div>
                    <div className="space-y-3 px-6 py-5">
                      <button
                        type="button"
                        onClick={() => void handleDelete(false)}
                        className="w-full cursor-pointer rounded-lg border border-slate-300 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                      >
                        <span className="block text-sm font-semibold text-slate-800">Delete schedule only</span>
                        <span className="mt-0.5 block text-xs text-slate-500">Keeps attendance records and frees the time slot.</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(true)}
                        className="w-full cursor-pointer rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-left transition-colors hover:border-rose-400 hover:bg-rose-100"
                      >
                        <span className="block text-sm font-semibold text-rose-700">Delete schedule and records</span>
                        <span className="mt-0.5 block text-xs text-rose-600">Also removes all sessions and attendance.</span>
                      </button>
                      {actionError && <p role="alert" className="text-sm font-medium text-rose-700">{actionError}</p>}
                    </div>
                    <div className="flex justify-end border-t border-slate-100 px-6 py-4">
                      <button
                        type="button"
                        onClick={() => setShowDeleteChoice(false)}
                        className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">End Time</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2.5 font-mono text-sm font-medium tabular-nums text-slate-800 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="flex gap-2">
              {isEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowDeleteChoice(true)}
                    disabled={isSaving}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/50 px-3.5 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100/70 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onManageRoster(editingSchedule)}
                    disabled={!/^\d+$/.test(editingSchedule.id)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#1b325f]/20 bg-[#1b325f]/5 px-3.5 py-2 text-xs font-semibold text-[#1b325f] transition-colors hover:bg-[#1b325f]/10 disabled:opacity-50"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Manage Students</span>
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !instructors.length || !labRooms.length || loadingOptions}
                className="cursor-pointer rounded-lg bg-[#2563eb] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-amber-600/30 transition-all hover:bg-blue-700 disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Schedule'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ================================================================
 * MAIN VIEW
 * ================================================================ */

interface AdminScheduleModuleProps {
  schedules: ScheduleEntry[];
  instructors: ScheduleInstructorOption[];
  labRooms: ScheduleLabRoomOption[];
  token: string;
  onSaveSchedule: (entry: ScheduleEntry) => Promise<void>;
  onDeleteSchedule: (id: string) => Promise<void>;
  onDeleteAllSchedules: () => Promise<void>;
  onManageRoster: (entry: ScheduleEntry) => void;
  isLoading: boolean;
  error: string;
  onNavigate: (screen: WireframeScreenId) => void;
  onLogout: () => void;
}

export const AdminScheduleModuleView: React.FC<AdminScheduleModuleProps> = ({
  schedules,
  instructors,
  labRooms,
  token,
  onSaveSchedule,
  onDeleteSchedule,
  onDeleteAllSchedules,
  onManageRoster,
  isLoading,
  error,
  onNavigate,
  onLogout,
}) => {
  const [roomFilter, setRoomFilter] = useState('All Rooms');
  const [semFilter, setSemFilter] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [noticeType, setNoticeType] = useState<NoticeType>('success');
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [termLabels, setTermLabels] = useState<string[]>([]);
  const [activeTermLabel, setActiveTermLabel] = useState('');
  const isPastTerm = Boolean(semFilter && activeTermLabel && semFilter !== activeTermLabel);

  useEffect(() => {
    let cancelled = false;
    const loadTerms = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/terms`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (cancelled || !res.ok) return;
        const list: Array<{ academicYear: string; semester: string; isActive: boolean }> = data.terms || [];
        const label = (t: { academicYear: string; semester: string }) => `${t.academicYear} ${t.semester}`;
        setTermLabels(list.map(label));
        const active = list.find((t) => t.isActive);
        if (active) {
          setActiveTermLabel(label(active));
          setSemFilter(label(active));
        }
      } catch {
        // Terms are optional for this screen; the filter falls back to schedule labels.
      }
    };
    void loadTerms();
    return () => { cancelled = true; };
  }, [token]);

  const [modalSchedule, setModalSchedule] = useState<ScheduleEntry | null>(null);

  const openCreate = (day?: ScheduleEntry['day'], startTime?: string) => {
    setModalSchedule(createDraft(day, startTime));
  };
  const openEdit = (entry: ScheduleEntry) => {
    if (activeTermLabel && entry.semester && entry.semester !== activeTermLabel) {
      setDeleteError('Schedules from a past term are read-only. Switch to the active term to edit.');
      return;
    }
    setModalSchedule(entry);
  };
  const closeModal = () => setModalSchedule(null);

  const handleSaved = (message?: string) => {
    setModalSchedule(null);
    if (message) {
      setNoticeType('success');
      setSuccessNotice(message);
    }
  };

  const handleDeleted = (message?: string) => {
    setModalSchedule(null);
    if (message) {
      setNoticeType('delete');
      setSuccessNotice(message);
    }
  };

  useEffect(() => {
    if (!successNotice) return;
    const timer = window.setTimeout(() => setSuccessNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [successNotice]);

  const handleDeleteAllSchedules = async () => {
    setIsDeletingAll(true);
    setDeleteError('');
    try {
      const count = schedules.length;
      await onDeleteAllSchedules();
      setIsDeleteConfirmationOpen(false);
      setNoticeType('delete');
      setSuccessNotice(
        count === 1
          ? 'Schedule deleted successfully.'
          : `All ${count} schedules deleted successfully.`
      );
    } catch (deleteError) {
      setDeleteError(deleteError instanceof Error ? deleteError.message : 'Unable to delete schedules.');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const filteredSchedules = schedules.filter((s) => {
    const matchesRoom = roomFilter === 'All Rooms' || s.room.includes(roomFilter);
    const matchesSem = !semFilter || s.semester === semFilter;
    return matchesRoom && matchesSem;
  });

  const timeSlots = [...new Set(filteredSchedules.map((s) => s.startTime))]
    .sort((a, b) => timeToMinutes(a) - timeToMinutes(b));

  const groupedSchedules = filteredSchedules.reduce<Record<string, ScheduleEntry[]>>((acc, schedule) => {
    const key = `${schedule.day}|${schedule.startTime}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(schedule);
    return acc;
  }, {});

  const getColorClasses = (theme: ScheduleEntry['colorTheme']) => {
    switch (theme) {
      case 'blue':
        return 'bg-sky-100/90 border-l-4 border-sky-600 text-sky-950 hover:bg-sky-200/90 shadow-sm';
      case 'green':
        return 'bg-emerald-100/90 border-l-4 border-emerald-600 text-emerald-950 hover:bg-emerald-200/90 shadow-sm';
      case 'amber':
        return 'bg-amber-100/90 border-l-4 border-amber-500 text-amber-950 hover:bg-amber-200/90 shadow-sm';
      case 'purple':
        return 'bg-purple-100/90 border-l-4 border-purple-600 text-purple-950 hover:bg-purple-200/90 shadow-sm';
    }
  };

  const isDelete = noticeType === 'delete';

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#eef1f7]">
      <ClamsHeader onNavigate={onNavigate} statusLabel="Computer Laboratory System" showLogout={false} />

      <div className="clams-layout">
        <AdminSubNav activeScreen="admin-schedule-module" onNavigate={onNavigate} onLogout={onLogout} />

        <main className="space-y-6">
          {/* Filter + actions bar — navy tinted */}
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#1b325f]/15 bg-gradient-to-r from-[#1b325f]/[0.04] to-transparent px-6 py-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="mr-2 inline-flex items-center gap-2 font-bold text-[#1b325f]">
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filters:</span>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-[#1b325f]/15 bg-white/80 px-4 py-2 shadow-sm">
                <span className="text-slate-500">Lab Room:</span>
                <select
                  value={roomFilter}
                  onChange={(e) => setRoomFilter(e.target.value)}
                  className="cursor-pointer bg-transparent font-bold text-[#1b325f] focus:outline-none"
                >
                  <option value="All Rooms">All Rooms</option>
                  {[...new Set(schedules.map((s) => s.room))].map((room) => (
                    <option key={room} value={room}>{room}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-[#1b325f]/15 bg-white/80 px-4 py-2 shadow-sm">
                <span className="text-slate-500">Semester:</span>
                <select
                  value={semFilter}
                  onChange={(e) => setSemFilter(e.target.value)}
                  className="cursor-pointer bg-transparent font-bold text-[#1b325f] focus:outline-none"
                >
                  <option value="">All Semesters</option>
                  {[...new Set([...termLabels, ...schedules.map((s) => s.semester)])].map((semester) => (
                    <option key={semester} value={semester}>{semester}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmationOpen(true)}
                disabled={!schedules.length || isLoading || isDeletingAll}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-600 shadow-sm transition-all hover:bg-rose-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isDeletingAll ? 'Deleting...' : 'Delete All'}</span>
              </button>
              <button
                type="button"
                onClick={() => openCreate('Mon', '02:00 PM')}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-600/30 transition-all hover:bg-blue-700 hover:shadow-lg"
              >
                <Plus className="h-4 w-4" />
                <span>Create Schedule</span>
              </button>
            </div>
          </section>

          {isPastTerm && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
              <span>
                Viewing <span className="font-semibold">{semFilter}</span>, a past term. Its schedules are read-only.
              </span>
              <button
                type="button"
                onClick={() => setSemFilter(activeTermLabel)}
                className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
              >
                Back to {activeTermLabel}
              </button>
            </div>
          )}
          {(error || deleteError) && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
              {deleteError || error}
            </p>
          )}

          {isLoading ? (
            <section className="rounded-2xl border border-[#1b325f]/10 bg-white px-6 py-16 text-center text-base text-slate-500 shadow-sm">
              Loading schedules...
            </section>
          ) : schedules.length > 0 ? (
            <section className="overflow-hidden rounded-2xl border border-[#1b325f]/10 bg-white shadow-lg shadow-[#1b325f]/5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] table-fixed border-collapse">
                  <thead>
                    <tr className="bg-[#1b325f] text-sm font-bold text-white">
                      <th className="w-32 border-r border-white/10 px-5 py-4 text-left font-semibold text-white/70">
                        Time
                      </th>
                      {DAYS.map((day) => (
                        <th key={day.key} className="border-r border-white/10 px-5 py-4 text-center last:border-r-0">
                          {day.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {timeSlots.map((slot) => (
                      <tr key={slot} className="h-32 transition-colors hover:bg-[#1b325f]/[0.02]">
                        <td className="border-r border-slate-100 bg-[#1b325f]/[0.03] p-4 text-center align-middle font-mono text-xs font-bold tabular-nums text-[#1b325f]">
                          {slot}
                        </td>
                        {DAYS.map((day) => {
                          const cellEntries = groupedSchedules[`${day.key}|${slot}`] || [];
                          return (
                            <td key={day.key} className="border-r border-slate-100 p-3 align-top last:border-r-0">
                              {cellEntries.length > 0 ? (
                                <div className="space-y-2">
                                  {cellEntries.map((entry) => (
                                    <button
                                      key={`${entry.id}-${entry.room}-${entry.subject}`}
                                      type="button"
                                      onClick={() => openEdit(entry)}
                                      className={`flex min-h-[100px] w-full cursor-pointer flex-col justify-between rounded-lg p-3.5 text-left transition-all ${getColorClasses(entry.colorTheme)}`}
                                    >
                                      <div>
                                        <div className="line-clamp-1 text-sm font-bold leading-snug">{entry.subject}</div>
                                        <div className="mt-1 truncate text-xs opacity-80">{entry.teacher}</div>
                                      </div>
                                      <div className="mt-2 text-[11px] font-bold opacity-90">{entry.room}</div>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openCreate(day.key, slot)}
                                  className="flex h-full min-h-[100px] w-full cursor-pointer items-center justify-center rounded-lg border border-transparent text-xs text-slate-300 transition-colors hover:border-dashed hover:border-[#1b325f]/30 hover:bg-[#1b325f]/5 hover:text-[#1b325f]"
                                >
                                  Unassigned
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-[#1b325f]/10 bg-white px-6 py-16 text-center shadow-sm">
              <p className="text-base font-semibold text-slate-500">No schedules assigned yet.</p>
            </section>
          )}
        </main>
      </div>

      {/* Toast — navy or rose tinted, matching the login aesthetic */}
      {successNotice && (
        <div className="fixed right-6 top-6 z-[60] animate-toast-in">
          <div
            className={`flex items-center gap-3 overflow-hidden rounded-xl border bg-white px-5 py-4 shadow-2xl ${isDelete
              ? 'border-rose-200 shadow-rose-900/20'
              : 'border-emerald-200 shadow-emerald-900/20'
              }`}
          >
            <div className={`h-10 w-1 shrink-0 rounded-full ${isDelete ? 'bg-rose-500' : 'bg-emerald-500'}`} />
            <div className="min-w-0">
              <div className={`text-xs font-bold uppercase tracking-wider ${isDelete ? 'text-rose-600' : 'text-emerald-600'}`}>
                {isDelete ? 'Deleted' : 'Success'}
              </div>
              <div className="mt-0.5 text-sm text-slate-700">{successNotice}</div>
            </div>
            <button
              type="button"
              onClick={() => setSuccessNotice('')}
              className="ml-2 rounded-md p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {modalSchedule && (
        <ScheduleFormModal
          editingSchedule={modalSchedule}
          instructors={instructors}
          labRooms={labRooms}
          token={token}
          onSaveSchedule={onSaveSchedule}
          onDeleteSchedule={onDeleteSchedule}
          onManageRoster={onManageRoster}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {isDeleteConfirmationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1a30]/70 px-4 py-6 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-schedules-title"
            aria-describedby="delete-schedules-description"
            className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl shadow-rose-900/20"
          >
            <div className="bg-rose-600 px-7 py-4">
              <h2 id="delete-schedules-title" className="text-lg font-bold text-white">
                Delete all schedules?
              </h2>
            </div>
            <div className="p-7">
              <p id="delete-schedules-description" className="text-sm leading-relaxed text-slate-600">
                This permanently deletes all {schedules.length} schedules, along with their enrollments and active sessions.
              </p>
              {deleteError && (
                <p role="alert" className="mt-4 text-sm font-medium text-rose-700">
                  {deleteError}
                </p>
              )}
              <div className="mt-7 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmationOpen(false)}
                  disabled={isDeletingAll}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteAllSchedules()}
                  disabled={isDeletingAll}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-700/30 transition-all hover:bg-rose-800 disabled:cursor-wait disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {isDeletingAll ? 'Deleting...' : 'Delete all'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};