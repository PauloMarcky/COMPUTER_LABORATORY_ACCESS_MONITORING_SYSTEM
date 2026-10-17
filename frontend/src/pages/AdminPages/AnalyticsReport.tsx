import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { ClamsHeader } from '../../components/ClamsHeader';
import { AdminSubNav } from '../../components/AdminComponents/AdminSubNav';
import { API_BASE_URL, readApiResponse } from '../../api';
import type { WireframeScreenId } from '../../types';

interface Kpis {
  totalRegistered: number;
  avgAttendanceRate: number;
  totalAbsences: number;
  studentsAtRisk: number;
}

interface MonthlyPoint {
  month: string;   // "YYYY-MM"
  rate: number;    // 0-100
  expected: number;
  attended: number;
}

interface SubjectAbsence {
  code: string;
  count: number;
}

interface TopAbsent {
  studentProfileId: number;
  schoolId: string;
  fullName: string;
  masked: string;
  course: string;
  yearLevel: number | null;
  absences: number;
  expected: number;
  attended: number;
  rate: number;
  severity: 'critical' | 'warning';
}

interface Overview {
  term: { id: number; academicYear: string; semester: string } | null;
  kpis: Kpis;
  monthlyAbsenceRate: MonthlyPoint[];
  subjectAbsences: SubjectAbsence[];
  topAbsentStudents: TopAbsent[];
}

interface AdminAnalyticsProps {
  token: string;
  onNavigate: (screen: WireframeScreenId) => void;
}

function monthLabel(yyyymm: string): string {
  const [year, month] = yyyymm.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = Number(month) - 1;
  return `${names[idx] ?? month} ${year.slice(2)}`;
}

export const AdminStudentsAnalyticsView: React.FC<AdminAnalyticsProps> = ({
  token,
  onNavigate,
}) => {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unmaskNames, setUnmaskNames] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE_URL}/analytics/overview`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await readApiResponse<Overview & { error?: string }>(res);
        if (!res.ok) throw new Error(json.error || 'Unable to load analytics.');
        if (active) setData(json);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load analytics.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [token]);

  const kpis = data?.kpis;

  // Bar chart normalization — biggest bar fills the available height
  const maxSubjectAbsence = useMemo(
    () => Math.max(1, ...(data?.subjectAbsences.map((s) => s.count) ?? [1])),
    [data]
  );

  return (
    <div className="min-h-[calc(100vh-44px)] bg-white">
      <ClamsHeader onNavigate={onNavigate} statusLabel="Computer Laboratory System" />

      <div className="clams-layout">
        <AdminSubNav activeScreen="admin-students-analytics" onNavigate={onNavigate} />

        <main className="admin-flat space-y-6">
          {loading && (
            <section className="rounded-2xl border border-[#1b325f]/10 bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-sm">
              Loading analytics…
            </section>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
              {error}
            </p>
          )}

          {!loading && data && (
            <>
              {data.term && (
                <p className="text-sm text-slate-500">
                  Showing data for{' '}
                  <span className="font-bold text-[#1b325f]">
                    {data.term.academicYear} · {data.term.semester}
                  </span>
                </p>
              )}

              {/* KPI Cards */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-[#1b325f]/10 bg-white p-6 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Total Registered
                  </div>
                  <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#1b325f]">
                    {kpis?.totalRegistered ?? 0}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#1b325f]/10 bg-white p-6 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Avg Attendance Rate
                  </div>
                  <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-emerald-600">
                    {kpis ? `${kpis.avgAttendanceRate}%` : '0%'}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#1b325f]/10 bg-white p-6 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Total Absences (Sem)
                  </div>
                  <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-rose-600">
                    {kpis?.totalAbsences ?? 0}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#1b325f]/10 bg-white p-6 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Students At Risk
                  </div>
                  <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-amber-600">
                    {kpis?.studentsAtRisk ?? 0}
                  </div>
                </div>
              </div>

              {/* Charts + Top Absent */}
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                {/* Left column */}
                <div className="space-y-6 lg:col-span-8">
                  {/* Monthly Absence Rate (SVG line chart) */}
                  <section className="rounded-2xl border border-[#1b325f]/10 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                      <h2 className="text-sm font-bold text-[#1b325f]">
                        Monthly Absence Rate (%)
                      </h2>
                      {data.monthlyAbsenceRate.length > 0 && (
                        <span className="text-xs text-slate-400">
                          {data.monthlyAbsenceRate.length} month
                          {data.monthlyAbsenceRate.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>

                    <div className="px-6 py-5">
                      {data.monthlyAbsenceRate.length === 0 ? (
                        <div className="flex h-44 w-full items-center justify-center text-sm text-slate-400">
                          No attendance data yet.
                        </div>
                      ) : (
                        <MonthlyLineChart points={data.monthlyAbsenceRate} />
                      )}
                    </div>
                  </section>

                  {/* Total Absences by Subject Code */}
                  <section className="rounded-2xl border border-[#1b325f]/10 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-6 py-4">
                      <h2 className="text-sm font-bold text-[#1b325f]">
                        Total Absences by Subject Code
                      </h2>
                    </div>

                    <div className="px-6 py-5">
                      {data.subjectAbsences.length === 0 ? (
                        <div className="flex h-44 w-full items-center justify-center text-sm text-slate-400">
                          No absence data yet.
                        </div>
                      ) : (
                        <>
                          <div className="flex h-44 items-end justify-around gap-4 border-b border-slate-100 px-4 pt-6">
                            {data.subjectAbsences.map((item) => (
                              <div
                                key={item.code}
                                className="flex h-full w-16 flex-col items-center justify-end"
                              >
                                <span className="mb-1.5 font-mono text-xs font-bold tabular-nums text-[#1b325f]">
                                  {item.count}
                                </span>
                                <div
                                  style={{
                                    height: `${Math.max(4, (item.count / maxSubjectAbsence) * 100)}%`,
                                  }}
                                  className="w-10 rounded-t-md bg-gradient-to-t from-[#1b325f] to-[#3b5d9c] transition-all"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-around gap-4 px-4 pt-3">
                            {data.subjectAbsences.map((item) => (
                              <div
                                key={item.code}
                                className="w-16 text-center font-mono text-xs font-bold text-slate-500"
                              >
                                {item.code}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </section>
                </div>

                {/* Right column — Top absent students */}
                <section className="rounded-2xl border border-[#1b325f]/10 bg-white shadow-sm lg:col-span-4">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
                    <div>
                      <h2 className="text-sm font-bold text-[#1b325f]">Top Absent Students</h2>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Privacy-masked names
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUnmaskNames((v) => !v)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#1b325f]/15 bg-[#1b325f]/5 px-3 py-1.5 text-xs font-semibold text-[#1b325f] transition-colors hover:bg-[#1b325f]/10"
                      title="Toggle privacy mask"
                    >
                      {unmaskNames ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          <span>Mask</span>
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" />
                          <span>Unmask</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-3 px-6 py-5">
                    {data.topAbsentStudents.length === 0 && (
                      <p className="py-4 text-center text-sm text-slate-400">No student data.</p>
                    )}
                    {data.topAbsentStudents.map((st) => (
                      <div
                        key={st.studentProfileId}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${st.severity === 'critical'
                            ? 'border-rose-100 bg-rose-50/50'
                            : 'border-amber-100 bg-amber-50/50'
                          }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {st.severity === 'critical' ? (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                              <AlertCircle className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                              <AlertTriangle className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-slate-900">
                              {unmaskNames ? st.fullName : st.masked}
                            </div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              {st.course}
                              {st.yearLevel != null && ` · Year ${st.yearLevel}`}
                            </div>
                            <div className="font-mono text-xs text-slate-400">
                              {st.schoolId}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-md px-3 py-1 font-mono text-xs font-bold tabular-nums ${st.severity === 'critical'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                            }`}
                        >
                          {st.absences} Days
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

/* --------------------------------------------------------------
 * Inline SVG line chart for monthly absence rate.
 * No dependency — draws axis, grid, polyline, and dots.
 * -------------------------------------------------------------- */
const MonthlyLineChart: React.FC<{ points: MonthlyPoint[] }> = ({ points }) => {
  const W = 640;
  const H = 200;
  const PAD_L = 40;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 32;

  const yMax = 100;

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const n = points.length;
  const stepX = n > 1 ? plotW / (n - 1) : 0;

  const xAt = (i: number) => PAD_L + (n > 1 ? i * stepX : plotW / 2);
  const yAt = (rate: number) => PAD_T + plotH - (rate / yMax) * plotH;

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.rate)}`)
    .join(' ');

  // Filled area under the line
  const areaD = `${pathD} L ${xAt(n - 1)} ${PAD_T + plotH} L ${xAt(0)} ${PAD_T + plotH} Z`;

  const gridLines = [0, 25, 50, 75, 100];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" preserveAspectRatio="none">
        {/* Grid + Y labels */}
        {gridLines.map((g) => {
          const y = yAt(g);
          return (
            <g key={g}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray={g === 0 ? '' : '3 3'}
              />
              <text
                x={PAD_L - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fill="#94a3b8"
                fontFamily="ui-monospace, monospace"
              >
                {g}%
              </text>
            </g>
          );
        })}

        {/* Filled area under line */}
        <path d={areaD} fill="#1b325f" fillOpacity="0.08" />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#1b325f"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots + X labels */}
        {points.map((p, i) => {
          const x = xAt(i);
          const y = yAt(p.rate);
          return (
            <g key={p.month}>
              <circle cx={x} cy={y} r="4" fill="white" stroke="#1b325f" strokeWidth="2" />
              <text
                x={x}
                y={H - 10}
                textAnchor="middle"
                fontSize="10"
                fill="#64748b"
                fontFamily="ui-monospace, monospace"
              >
                {monthLabel(p.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};