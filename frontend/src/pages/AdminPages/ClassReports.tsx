import React, { useState } from 'react';
import { Calendar, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { ClamsHeader } from '../../components/ClamsHeader';
import { AdminSubNav } from '../../components/AdminComponents/AdminSubNav';
import type { ClassReportSubmission, WireframeScreenId } from '../../types';
import { formatSchoolDate } from '../../utils/attendance-time';

interface AdminReportsDashboardProps {
  onLogout: () => void;
  reports: ClassReportSubmission[];
  onNavigate: (screen: WireframeScreenId) => void;
}

export const AdminReportsDashboardView: React.FC<AdminReportsDashboardProps> = ({
  onLogout,
  reports,
  onNavigate,
}) => {
  const [labFilter, setLabFilter] = useState('All Labs');
  const [subjectFilter, setSubjectFilter] = useState('All Subjects');
  const [instructorFilter, setInstructorFilter] = useState('All Instructors');
  const [todayOnly, setTodayOnly] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const filteredReports = reports.filter((r) => {
    const matchesLab = labFilter === 'All Labs' || r.labRoom === labFilter;
    const matchesSubject =
      subjectFilter === 'All Subjects' || r.subjectCode === subjectFilter;
    const matchesInstructor =
      instructorFilter === 'All Instructors' || r.instructor === instructorFilter;
    const matchesDate = !todayOnly || r.date === formatSchoolDate(new Date());
    return matchesLab && matchesSubject && matchesInstructor && matchesDate;
  });

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#eef1f7]">
      <ClamsHeader onNavigate={onNavigate} statusLabel="Computer Laboratory System" showLogout={false} />

      <div className="clams-layout">
        <AdminSubNav activeScreen="admin-reports-dashboard" onNavigate={onNavigate} onLogout={onLogout} />

        <main className="space-y-6">
          {/* Filter Bar */}
          <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#1b325f]/15 bg-gradient-to-r from-[#1b325f]/[0.04] to-transparent px-6 py-5 text-sm shadow-sm">
            <div className="inline-flex items-center gap-2 font-bold text-[#1b325f]">
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filters:</span>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-[#1b325f]/15 bg-white/80 px-4 py-2 shadow-sm">
              <span className="text-slate-500">Lab:</span>
              <select
                value={labFilter}
                onChange={(e) => setLabFilter(e.target.value)}
                className="cursor-pointer bg-transparent font-bold text-[#1b325f] focus:outline-none"
              >
                <option value="All Labs">All Labs</option>
                {[...new Set(reports.map((report) => report.labRoom))].map((labRoom) => (
                  <option key={labRoom} value={labRoom}>{labRoom}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-[#1b325f]/15 bg-white/80 px-4 py-2 shadow-sm">
              <span className="text-slate-500">Subject:</span>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="cursor-pointer bg-transparent font-bold text-[#1b325f] focus:outline-none"
              >
                <option value="All Subjects">All Subjects</option>
                {[...new Set(reports.map((report) => report.subjectCode))].map((subjectCode) => (
                  <option key={subjectCode} value={subjectCode}>{subjectCode}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-[#1b325f]/15 bg-white/80 px-4 py-2 shadow-sm">
              <span className="text-slate-500">Instructor:</span>
              <select
                value={instructorFilter}
                onChange={(e) => setInstructorFilter(e.target.value)}
                className="cursor-pointer bg-transparent font-bold text-[#1b325f] focus:outline-none"
              >
                <option value="All Instructors">All Instructors</option>
                {[...new Set(reports.map((report) => report.instructor))].map((instructor) => (
                  <option key={instructor} value={instructor}>{instructor}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setTodayOnly((v) => !v)}
              className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${todayOnly
                  ? 'bg-[#2563eb] text-white shadow-lg shadow-amber-600/30 hover:bg-blue-700 hover:shadow-lg'
                  : 'border border-[#1b325f]/15 bg-white/80 text-[#1b325f] shadow-sm hover:bg-white'
                }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Today</span>
            </button>
          </section>

          {/* Class Reports Table */}
          <section className="overflow-hidden rounded-2xl border border-[#1b325f]/10 bg-white shadow-lg shadow-[#1b325f]/5">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#1b325f] text-xs font-bold uppercase tracking-wider text-white">
                    <th className="px-4 py-4 text-left font-semibold text-white/70">Date</th>
                    <th className="px-4 py-4 text-left">Subject Code</th>
                    <th className="px-4 py-4 text-left">Subject Name</th>
                    <th className="px-4 py-4 text-left">Instructor</th>
                    <th className="px-4 py-4 text-left">Lab Room</th>
                    <th className="px-4 py-4 text-left">Session Time</th>
                    <th className="px-4 py-4 text-left">Students</th>
                    <th className="px-4 py-4 text-left">Session Status</th>
                    <th className="px-4 py-4 text-right font-semibold text-white/70">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReports.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-sm text-slate-400">
                        No reports.
                      </td>
                    </tr>
                  )}
                  {filteredReports.map((rep) => (
                    <React.Fragment key={rep.id}>
                      <tr className="transition-colors hover:bg-[#1b325f]/[0.02]">
                        <td className="whitespace-nowrap px-4 py-4 font-mono text-xs tabular-nums text-slate-500">
                          {rep.date}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-mono text-sm font-bold text-[#1b325f]">
                          {rep.subjectCode}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-700">
                          {rep.subjectName}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                          {rep.instructor}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                          {rep.labRoom}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-mono text-xs tabular-nums text-slate-500">
                          {rep.sessionTime}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-mono text-sm font-bold tabular-nums text-slate-700">
                          {rep.studentsPresent} / {rep.studentsTotal}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Completed
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          <button
                            type="button"
                            aria-expanded={expandedReportId === rep.id}
                            onClick={() =>
                              setExpandedReportId((current) => (current === rep.id ? null : rep.id))
                            }
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#2563eb]/25 bg-[#2563eb]/5 px-3 py-1.5 text-xs font-bold text-[#2563eb] transition-colors hover:bg-[#2563eb]/10"
                          >
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${expandedReportId === rep.id ? 'rotate-180' : ''
                                }`}
                            />
                            {expandedReportId === rep.id ? 'Hide Students' : 'View Students'}
                          </button>
                        </td>
                      </tr>
                      {expandedReportId === rep.id && (
                        <tr>
                          <td colSpan={9} className="bg-[#1b325f]/[0.03] px-6 py-5">
                            {rep.attendanceList.length === 0 ? (
                              <p className="py-3 text-center text-sm text-slate-500">
                                No students were recorded as present.
                              </p>
                            ) : (
                              <div className="overflow-hidden rounded-lg border border-[#1b325f]/10 bg-white shadow-sm">
                                <table className="w-full border-collapse text-left text-sm">
                                  <thead className="bg-[#1b325f]/[0.06] text-xs font-bold uppercase tracking-wider text-[#1b325f]">
                                    <tr>
                                      <th className="px-4 py-3 text-left">#</th>
                                      <th className="px-4 py-3 text-left">Student ID</th>
                                      <th className="px-4 py-3 text-left">Student Name</th>
                                      <th className="px-4 py-3 text-left">Time In</th>
                                      <th className="px-4 py-3 text-left">PC</th>
                                      <th className="px-4 py-3 text-left">Attendance</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {rep.attendanceList.map((student, index) => (
                                      <tr
                                        key={student.id}
                                        className="transition-colors hover:bg-[#1b325f]/[0.02]"
                                      >
                                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                                          {index + 1}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                                          {student.studentId}
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-slate-800">
                                          {student.formalName}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                                          {student.timeIn}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                                          {student.pcNumber}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                          {student.status}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs text-slate-500">
              <span>
                Showing <span className="font-bold text-[#1b325f]">{filteredReports.length}</span> report
                {filteredReports.length === 1 ? '' : 's'}
              </span>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};