import React, { useState } from 'react';
import { CheckCircle2, UserPlus, Play, Square } from 'lucide-react';
import { ClamsHeader } from '../ClamsHeader';
import type { AttendanceEntry, ScheduleEntry, WireframeScreenId } from '../../types';

interface InstructorAttendanceProps {
  attendance: AttendanceEntry[];
  schedule: ScheduleEntry | null;
  onScanStudent: (entry: AttendanceEntry) => void;
  onManualStudent: (schoolId: string) => Promise<AttendanceEntry>;
  onEndSession: () => Promise<void>;
  onNavigate: (screen: WireframeScreenId) => void;
  onLogout?: () => void | Promise<void>;
  lastScannedName: string | null;
  onStudentLogged: (message: string) => void;
  scanner: React.ReactNode;
}

export const InstructorAttendanceView: React.FC<InstructorAttendanceProps> = ({
  attendance,
  schedule,
  onScanStudent,
  onManualStudent,
  onEndSession,
  onNavigate,
  onLogout,
  lastScannedName,
  onStudentLogged,
  scanner,
}) => {
  const [customId, setCustomId] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customId.trim()) return;
    setManualBusy(true);
    setManualError('');
    try {
      const entry = await onManualStudent(customId.trim());
      onScanStudent(entry);
      onStudentLogged(`${entry.name} (${entry.studentId}) recorded`);
      setCustomId('');
      setShowManualEntry(false);
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'Unable to record attendance.');
    } finally {
      setManualBusy(false);
    }
  };

  const handleEndSession = async () => {
    setEndingSession(true);
    setManualError('');
    try {
      await onEndSession();
      onNavigate('instructor-attendance-export');
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'Unable to end the session.');
    } finally {
      setEndingSession(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#f4f6f9]">
      <ClamsHeader
        onNavigate={onNavigate}
        onLogout={onLogout}
        statusLabel="Session Active"
        logoutTitle="End active session?"
        logoutMessage="This class session will be ended automatically before you return to the role selection screen."
      />

      <main className="px-4 py-7 space-y-6">
        {/* Session Status Top Bar Card */}
        <section className="bg-white rounded-xl border border-slate-200/90 px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500" />
              <h1 className="text-lg font-bold text-slate-900">Active Lab Session</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {schedule ? `${schedule.subject} · ${schedule.room} · ${schedule.day} ${schedule.startTime}–${schedule.endTime}` : 'Session details unavailable.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowEndConfirmation(true)}
              disabled={endingSession}
              className="px-4 py-2 rounded-lg bg-[#1b325f] hover:bg-[#142547] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-xs"
            >
              {endingSession ? 'Ending session...' : 'End Session & Export Log'}
            </button>
          </div>
        </section>
        {manualError && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{manualError}</p>}

        {showEndConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
              <h2 className="text-lg font-bold text-slate-900">End this session?</h2>
              <p className="mt-2 text-base leading-6 text-slate-600">
                This will close the active class session and open the attendance export page.
              </p>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEndConfirmation(false)}
                  className="rounded-md border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowEndConfirmation(false);
                    await handleEndSession();
                  }}
                  disabled={endingSession}
                  className="rounded-md bg-[#1b325f] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#142547] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {endingSession ? 'Ending...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Two-Column Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Live Attendance Sheet (Today) */}
          <section className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Live Attendance Sheet (Today)</h2>
              <span className="text-sm text-slate-500 font-mono tabular-nums">
                {attendance.length} Logged
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 pr-3">Time</th>
                    <th className="py-2.5 px-3">Student ID</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">PC #</th>
                    <th className="py-2.5 pl-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {attendance.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pr-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {item.timeIn}
                      </td>
                      <td className="py-3.5 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {item.studentId}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        {item.name}
                      </td>
                      <td className="py-3.5 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        <span
                          title={item.pcHistory?.map((h) => `${h.pcNumber}: ${h.claimedAt}${h.releasedAt ? ` – ${h.releasedAt}` : ' – now'}`).join('\n')}
                        >
                          {item.pcHistory && item.pcHistory.length > 1
                            ? item.pcHistory.map((h) => h.pcNumber).join(' → ')
                            : item.pcNumber}
                        </span>
                      </td>
                      <td className="py-3.5 pl-3 text-right whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold ${item.status === 'On-Time'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                            }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right Column: Live Camera Scanner */}
          <section className="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Student ID Scanner</h2>
              <button
                type="button"
                onClick={() => setShowManualEntry((v) => !v)}
                className="inline-flex items-center gap-1 text-sm font-medium text-[#1b325f] hover:underline cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{showManualEntry ? 'Hide Manual Input' : 'Manual ID Input'}</span>
              </button>
            </div>

            {scanner}

            {lastScannedName && (
              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="truncate">Scanned: {lastScannedName}</span>
              </div>
            )}

            {showManualEntry && (
              <form onSubmit={handleManualSubmit} className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                <div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Student ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 24-10255"
                      value={customId}
                      onChange={(e) => setCustomId(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#1b325f] font-mono"
                    />
                  </div>
                </div>
                <button type="submit" disabled={manualBusy} className="w-full py-2 rounded-md bg-[#1b325f] hover:bg-[#142547] text-white text-sm font-semibold cursor-pointer disabled:opacity-60">
                  {manualBusy ? 'Checking student...' : 'Log Student Attendance'}
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};
