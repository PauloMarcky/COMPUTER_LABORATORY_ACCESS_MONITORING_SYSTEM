import { ClipboardList, MonitorCheck } from 'lucide-react';
import { InstructorAttendanceExportView } from '../../components/InstructorComponents/InstructorAttendanceExportView';
import type { AttendanceEntry, ScheduleEntry, WireframeScreenId } from '../../types';

interface ExportAttendancePageProps {
  schedule?: ScheduleEntry | null;
  attendance: AttendanceEntry[];
  onNavigate: (screen: WireframeScreenId) => void;
  onBackToSchedule: () => void;
}

export const ExportAttendancePage = ({ attendance, schedule = null, onNavigate, onBackToSchedule }: ExportAttendancePageProps) => {
  const assignedPcCount = attendance.filter((entry) => entry.pcNumber !== 'None' || (entry.pcHistory?.length ?? 0) > 0).length;

  return (
    <main className="min-h-screen bg-[#edf1f5]">
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="flex flex-col gap-5 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
              <ClipboardList size={15} aria-hidden="true" />
              <span>Instructor workspace</span>
              <span className="text-slate-300">/</span>
              <span>Attendance</span>
            </div>
            <h1 className="text-3xl font-semibold text-slate-900">Export attendance</h1>
            <p className="mt-1 text-base text-slate-500">
              Review the session log and print its official copy.
            </p>
          </div>

          <div className="flex items-stretch gap-6 border-t border-slate-200 pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Students logged
              </p>
              <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">
                {attendance.length}
              </p>
            </div>
            <div className="border-l border-slate-200 pl-6">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <MonitorCheck size={14} aria-hidden="true" />
                PCs assigned
              </p>
              <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">
                {assignedPcCount}
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="px-4 py-6 sm:py-9">
        <InstructorAttendanceExportView schedule={schedule} attendance={attendance} onNavigate={onNavigate} onBackToSchedule={onBackToSchedule} />
      </section>
    </main>
  );
};
