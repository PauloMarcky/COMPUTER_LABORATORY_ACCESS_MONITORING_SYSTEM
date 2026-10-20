import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, UserPlus, Trash2, Users } from 'lucide-react';
import { ClamsHeader } from '../../components/ClamsHeader';
import { AdminSubNav } from '../../components/AdminComponents/AdminSubNav';
import { API_BASE_URL, readApiResponse } from '../../api';
import type { ScheduleEntry, WireframeScreenId } from '../../types';

interface RosterStudent {
  studentProfileId: number;
  schoolId: string;
  firstName: string;
  lastName: string;
  yearLevel: number | null;
}

interface EnrolledStudent extends RosterStudent {
  enrollmentId: number;
}

interface RosterResponse {
  schedule: {
    id: number;
    subjectCode: string;
    section: string;
    instructor: { firstName: string; lastName: string } | null;
    labRoom: { roomName: string } | null;
    term: { academicYear: string; semester: string } | null;
  };
  enrolled: EnrolledStudent[];
  available: RosterStudent[];
}

interface Props {
  onLogout: () => void;
  schedule: ScheduleEntry | null;
  token: string;
  onNavigate: (screen: WireframeScreenId) => void;
}

const YEAR_FILTERS = [
  { value: 0, label: 'All Years' },
  { value: 1, label: '1st Year' },
  { value: 2, label: '2nd Year' },
  { value: 3, label: '3rd Year' },
  { value: 4, label: '4th Year' },
];

export const ManageRosterView: React.FC<Props> = ({ schedule, token, onNavigate, onLogout }) => {
  const [data, setData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const load = async () => {
    if (!schedule) {
      setLoading(false);
      setError('No schedule selected. Return to schedules and open enrollment from a saved schedule.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/enrollments/roster/${schedule.id}`, { headers });
      const json = await readApiResponse<RosterResponse & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error || 'Unable to load roster.');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule?.id, token]);

  const filteredAvailable = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.available.filter((s) => {
      const matchesYear = yearFilter === 0 || s.yearLevel === yearFilter;
      const matchesSearch =
        !q ||
        s.schoolId.toLowerCase().includes(q) ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q);
      return matchesYear && matchesSearch;
    });
  }, [data, search, yearFilter]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEnroll = async () => {
    if (!schedule || selected.size === 0) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/enrollments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          scheduleId: Number(schedule.id),
          studentProfileIds: Array.from(selected),
        }),
      });
      const json = await readApiResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error || 'Unable to enroll students.');
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to enroll students.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (enrollmentId: number) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/enrollments/${enrollmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await readApiResponse<{ error?: string }>(res);
        throw new Error(json.error || 'Unable to remove student.');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to remove student.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#f4f6f9]">
      <ClamsHeader onNavigate={onNavigate} statusLabel="Computer Laboratory System" showLogout={false} />

      <div className="clams-layout">
        <AdminSubNav activeScreen="admin-schedule-roster" onNavigate={onNavigate} onLogout={onLogout} />

        <main className="space-y-5">
          <div>
            <button
              type="button"
              onClick={() => onNavigate('admin-schedule-module')}
              className="mb-3 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              title="Return to the schedule list"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Schedule List
            </button>
            <h1 className="text-lg font-bold text-slate-900">
              {data ? `${data.schedule.subjectCode} · Section ${data.schedule.section}` : 'Manage Roster'}
            </h1>
            {data && (
              <p className="text-xs text-slate-500 mt-0.5">
                {data.schedule.instructor
                  ? `${data.schedule.instructor.firstName} ${data.schedule.instructor.lastName}`
                  : 'No instructor'}
                {data.schedule.labRoom ? ` · ${data.schedule.labRoom.roomName}` : ''}
                {data.schedule.term ? ` · ${data.schedule.term.academicYear} ${data.schedule.term.semester}` : ''}
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              {error}
            </p>
          )}

          {loading ? (
            <section className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
              Loading roster...
            </section>
          ) : data ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <section className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-[#1b325f]" /> Enroll Students
                  </h2>
                  <span className="text-[11px] text-slate-500">{selected.size} selected</span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name or ID..."
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-[#1b325f]"
                    />
                  </div>
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(Number(e.target.value))}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:border-[#1b325f]"
                  >
                    {YEAR_FILTERS.map((y) => (
                      <option key={y.value} value={y.value}>{y.label}</option>
                    ))}
                  </select>
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-1.5 border border-slate-100 rounded-lg p-1">
                  {filteredAvailable.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic py-6 text-center">
                      {data.available.length === 0
                        ? 'All students are already enrolled.'
                        : 'No students match your filters.'}
                    </p>
                  ) : (
                    filteredAvailable.map((s) => {
                      const checked = selected.has(s.studentProfileId);
                      return (
                        <label
                          key={s.studentProfileId}
                          className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-xs transition-colors ${checked
                            ? 'bg-blue-50 border border-blue-200'
                            : 'hover:bg-slate-50 border border-transparent'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(s.studentProfileId)}
                            className="cursor-pointer"
                          />
                          <span className="font-mono text-[10px] text-slate-500 w-20 shrink-0">
                            {s.schoolId}
                          </span>
                          <span className="font-medium text-slate-800 truncate">
                            {s.lastName}, {s.firstName}
                          </span>
                          {s.yearLevel != null && (
                            <span className="ml-auto text-[10px] text-slate-400 shrink-0">
                              Year {s.yearLevel}
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>

                <button
                  onClick={handleEnroll}
                  disabled={busy || selected.size === 0}
                  className="w-full py-2.5 rounded-lg bg-[#2563eb] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  {busy ? 'Enrolling...' : `Enroll ${selected.size} selected`}
                </button>
              </section>

              <section className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#1b325f]" /> Enrolled Students
                  </h2>
                  <span className="text-[11px] text-slate-500">{data.enrolled.length} enrolled</span>
                </div>

                <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
                  {data.enrolled.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic py-6 text-center">
                      No students enrolled yet.
                    </p>
                  ) : (
                    data.enrolled.map((s) => (
                      <div
                        key={s.enrollmentId}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 text-xs"
                      >
                        <span className="font-mono text-[10px] text-slate-500 w-20 shrink-0">
                          {s.schoolId}
                        </span>
                        <span className="font-medium text-slate-800 truncate">
                          {s.lastName}, {s.firstName}
                        </span>
                        {s.yearLevel != null && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            Year {s.yearLevel}
                          </span>
                        )}
                        <button
                          onClick={() => handleRemove(s.enrollmentId)}
                          disabled={busy}
                          className="ml-auto p-1.5 hover:bg-rose-50 rounded cursor-pointer disabled:opacity-50"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
};