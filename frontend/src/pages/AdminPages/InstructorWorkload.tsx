import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Search, SlidersHorizontal, Plus, Trash2, X } from 'lucide-react';
import { ClamsHeader } from '../../components/ClamsHeader';
import { AdminSubNav } from '../../components/AdminComponents/AdminSubNav';
import { API_BASE_URL, readApiResponse } from '../../api';
import type { WireframeScreenId } from '../../types';

interface SubjectLite {
  id: number;
  code: string;
  title: string;
  yearLevel: number | null;
}

interface InstructorRow {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  schoolId: string;
  subjects: SubjectLite[];
  scheduleCount: number;
}

interface AdminTeacherWorkloadProps {
  onLogout: () => void;
  token: string;
  onNavigate: (screen: WireframeScreenId) => void;
}

type NoticeType = 'success' | 'delete';

// Shared primary button style
const PRIMARY_BTN =
  'inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-600/30 transition-all hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50';

export const AdminTeacherWorkloadView: React.FC<AdminTeacherWorkloadProps> = ({
  onLogout,
  token,
  onNavigate,
}) => {
  const [instructors, setInstructors] = useState<InstructorRow[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectLite[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('All Subjects');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Multi-select: one Set per instructor
  const [pendingSelections, setPendingSelections] = useState<Record<number, Set<number>>>({});
  const [busy, setBusy] = useState(false);

  const [successNotice, setSuccessNotice] = useState('');
  const [noticeType, setNoticeType] = useState<NoticeType>('success');

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!successNotice) return;
    const timer = window.setTimeout(() => setSuccessNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [successNotice]);

  const showNotice = (message: string, type: NoticeType = 'success') => {
    setNoticeType(type);
    setSuccessNotice(message);
  };

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [workloadRes, subjectsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/instructor-subjects/workload`, { headers }),
        fetch(`${API_BASE_URL}/subjects`, { headers }),
      ]);
      const workloadData = await readApiResponse<{ instructors: InstructorRow[]; error?: string }>(workloadRes);
      const subjectsData = await readApiResponse<{ subjects: SubjectLite[]; error?: string }>(subjectsRes);
      if (!workloadRes.ok) throw new Error(workloadData.error || 'Unable to load instructors.');
      if (!subjectsRes.ok) throw new Error(subjectsData.error || 'Unable to load subjects.');
      setInstructors(workloadData.instructors);
      setAllSubjects(subjectsData.subjects);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workload data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const togglePending = (instructorId: number, subjectId: number) => {
    setPendingSelections((prev) => {
      const current = new Set(prev[instructorId] ?? []);
      if (current.has(subjectId)) current.delete(subjectId);
      else current.add(subjectId);
      return { ...prev, [instructorId]: current };
    });
  };

  const clearPending = (instructorId: number) => {
    setPendingSelections((prev) => ({ ...prev, [instructorId]: new Set() }));
  };

  const handleAssignAll = async (instructorId: number) => {
    const selected = Array.from(pendingSelections[instructorId] ?? []);
    if (selected.length === 0) return;

    setBusy(true);
    setError('');

    const succeeded: SubjectLite[] = [];
    const failures: string[] = [];

    for (const subjectId of selected) {
      try {
        const res = await fetch(`${API_BASE_URL}/instructor-subjects/${instructorId}/subjects`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectId }),
        });
        const data = await readApiResponse<{ error?: string; link: { subject: SubjectLite } }>(res);
        if (!res.ok) throw new Error(data.error || 'Unable to assign subject.');
        succeeded.push(data.link.subject);
      } catch (e) {
        const subject = allSubjects.find((s) => s.id === subjectId);
        const label = subject ? subject.code : `#${subjectId}`;
        failures.push(`${label}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    if (succeeded.length > 0) {
      setInstructors((prev) =>
        prev.map((i) =>
          i.id === instructorId ? { ...i, subjects: [...i.subjects, ...succeeded] } : i
        )
      );
      clearPending(instructorId);
    }

    if (failures.length === 0) {
      showNotice(
        succeeded.length === 1
          ? '1 subject assigned successfully.'
          : `${succeeded.length} subjects assigned successfully.`
      );
    } else if (succeeded.length === 0) {
      setError(`Failed to assign: ${failures.join('; ')}`);
    } else {
      setError(`Assigned ${succeeded.length} of ${selected.length}. Failures — ${failures.join('; ')}`);
      showNotice(`${succeeded.length} of ${selected.length} subjects assigned.`);
    }

    setBusy(false);
  };

  const handleUnassign = async (instructorId: number, subjectId: number) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/instructor-subjects/${instructorId}/subjects/${subjectId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const data = await readApiResponse<{ error?: string }>(res);
        throw new Error(data.error || 'Unable to remove subject.');
      }
      const removedSubject = instructors
        .find((i) => i.id === instructorId)
        ?.subjects.find((s) => s.id === subjectId);

      setInstructors((prev) =>
        prev.map((i) =>
          i.id === instructorId
            ? { ...i, subjects: i.subjects.filter((s) => s.id !== subjectId) }
            : i
        )
      );
      showNotice(
        removedSubject ? `Subject ${removedSubject.code} removed.` : 'Subject removed.',
        'delete'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to remove subject.');
    } finally {
      setBusy(false);
    }
  };

  const filteredInstructors = instructors.filter((i) => {
    const matchesSubject =
      subjectFilter === 'All Subjects' || i.subjects.some((subject) => String(subject.id) === subjectFilter);
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      i.name.toLowerCase().includes(q) ||
      i.subjects.some((s) => s.code.toLowerCase().includes(q) || s.title.toLowerCase().includes(q));
    return matchesSubject && matchesSearch;
  });

  const isDeleteToast = noticeType === 'delete';

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#eef1f7]">
      <ClamsHeader onNavigate={onNavigate} statusLabel="Computer Laboratory System" showLogout={false} />

      <div className="clams-layout">
        <AdminSubNav activeScreen="admin-teacher-workload" onNavigate={onNavigate} onLogout={onLogout} />

        <main className="space-y-6">
          {/* Filter bar */}
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#1b325f]/15 bg-white px-6 py-5 text-sm shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 font-bold text-[#1b325f]">
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filters:</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-[#1b325f]/15 bg-slate-50 px-4 py-2">
                <span className="text-slate-500">Subject:</span>
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="cursor-pointer bg-transparent font-bold text-[#1b325f] focus:outline-none"
                >
                  <option value="All Subjects">All Subjects</option>
                  {allSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code} - {subject.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative min-w-[260px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search instructors or subjects..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-[#1b325f] focus:bg-white"
              />
            </div>
          </section>

          {error && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
              {error}
            </p>
          )}

          {/* Table */}
          <section className="overflow-hidden rounded-2xl border border-[#1b325f]/10 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#1b325f] text-xs font-bold uppercase tracking-wider text-white">
                    <th className="px-5 py-4 text-left font-semibold text-white/70">Instructor</th>
                    <th className="px-4 py-4 text-left">School ID</th>
                    <th className="px-4 py-4 text-left">Assigned Subjects</th>
                    <th className="px-5 py-4 text-right font-semibold text-white/70">Schedules</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="py-16 text-center text-sm text-slate-400">
                        Loading instructors...
                      </td>
                    </tr>
                  ) : filteredInstructors.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-16 text-center text-sm text-slate-400">
                        No instructors found.
                      </td>
                    </tr>
                  ) : (
                    filteredInstructors.map((teacher) => {
                      const isExpanded = expandedId === teacher.id;
                      const availableSubjects = allSubjects.filter(
                        (s) => !teacher.subjects.some((ts) => ts.id === s.id)
                      );
                      const selectedSet = pendingSelections[teacher.id] ?? new Set<number>();
                      const selectedCount = selectedSet.size;

                      return (
                        <React.Fragment key={teacher.id}>
                          <tr
                            onClick={() => setExpandedId(isExpanded ? null : teacher.id)}
                            className={`cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                              }`}
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 shrink-0 text-[#1b325f]" />
                                ) : (
                                  <ChevronUp className="h-4 w-4 shrink-0 rotate-90 text-slate-400" />
                                )}
                                <div className="font-bold text-slate-900">{teacher.name}</div>
                              </div>
                            </td>
                            <td className="px-4 py-4 font-mono text-sm text-slate-600">
                              {teacher.schoolId}
                            </td>
                            <td className="px-4 py-4">
                              {teacher.subjects.length === 0 ? (
                                <span className="text-xs italic text-slate-400">
                                  No subjects assigned
                                </span>
                              ) : (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {teacher.subjects.map((sub) => (
                                    <span
                                      key={sub.id}
                                      className="rounded border border-slate-200 bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-semibold text-slate-700"
                                    >
                                      {sub.code}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-4 text-right font-mono text-sm font-bold tabular-nums text-slate-700">
                              {teacher.scheduleCount}
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={4} className="border-t border-slate-100 bg-slate-50/60 px-6 py-6">
                                {/* Currently assigned */}
                                <div className="mb-5">
                                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Assigned ({teacher.subjects.length})
                                  </div>
                                  {teacher.subjects.length === 0 ? (
                                    <p className="text-xs italic text-slate-400">No subjects yet.</p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {teacher.subjects.map((sub) => (
                                        <div
                                          key={sub.id}
                                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-2"
                                        >
                                          <div className="flex min-w-0 items-center gap-3">
                                            <span className="font-mono text-sm font-bold text-slate-800">
                                              {sub.code}
                                            </span>
                                            <span className="truncate text-xs text-slate-500">
                                              {sub.title}
                                            </span>
                                          </div>
                                          <button
                                            onClick={() => void handleUnassign(teacher.id, sub.id)}
                                            disabled={busy}
                                            className="rounded p-1.5 text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                                            title="Remove subject"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Available subjects — compact checkbox list */}
                                <div>
                                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Add subjects
                                  </div>
                                  {availableSubjects.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs italic text-slate-400">
                                      All subjects are already assigned.
                                    </p>
                                  ) : (
                                    <>
                                      <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                                        {availableSubjects.map((s) => {
                                          const checked = selectedSet.has(s.id);
                                          return (
                                            <label
                                              key={s.id}
                                              className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0 transition-colors ${checked ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                                                }`}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => togglePending(teacher.id, s.id)}
                                                className="h-4 w-4 shrink-0 cursor-pointer accent-[#2563eb]"
                                              />
                                              <span className="w-20 shrink-0 font-mono text-sm font-bold text-slate-800">
                                                {s.code}
                                              </span>
                                              <span className="truncate text-xs text-slate-600">
                                                {s.title}
                                              </span>
                                            </label>
                                          );
                                        })}
                                      </div>

                                      <div className="mt-4 flex items-center justify-between gap-3">
                                        <span className="text-xs text-slate-500">
                                          {selectedCount === 0
                                            ? ''
                                            : `${selectedCount} selected`}
                                        </span>
                                        <div className="flex items-center gap-3">
                                          <button
                                            type="button"
                                            onClick={() => clearPending(teacher.id)}
                                            disabled={busy || selectedCount === 0}
                                            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                                          >
                                            Clear
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => void handleAssignAll(teacher.id)}
                                            disabled={busy || selectedCount === 0}
                                            className={PRIMARY_BTN}
                                          >
                                            <Plus className="h-4 w-4" />
                                            {busy
                                              ? 'Assigning...'
                                              : selectedCount <= 1
                                                ? 'Assign subject'
                                                : `Assign ${selectedCount} subjects`}
                                          </button>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filteredInstructors.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs text-slate-500">
                {filteredInstructors.length} instructor{filteredInstructors.length === 1 ? '' : 's'}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Toast */}
      {successNotice && (
        <div className="fixed right-6 top-6 z-[60] animate-toast-in">
          <div
            className={`flex items-center gap-3 overflow-hidden rounded-xl border bg-white px-5 py-4 shadow-2xl ${isDeleteToast ? 'border-rose-200' : 'border-emerald-200'
              }`}
          >
            <div className="min-w-0">
              <div className={`text-xs font-bold uppercase tracking-wider ${isDeleteToast ? 'text-rose-600' : 'text-emerald-600'}`}>
                {isDeleteToast ? 'Removed' : 'Success'}
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
    </div>
  );
};