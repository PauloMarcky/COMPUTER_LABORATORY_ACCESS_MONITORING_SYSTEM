import React, { useState } from 'react';
import { ClamsHeader } from '../../components/ClamsHeader';
import { LabStaffSubNav } from '../../components/CustodianComponents/LabStaffSubNav';
import { PCIssueRepairQueue } from '../../components/CustodianComponents/PCIssueRepairQueue';
import type { ClassReportSubmission, PCIssueReport, PCIssueStatus, WireframeScreenId } from '../../types';

interface LabStaffReportDetailProps {
  selectedReport?: ClassReportSubmission;
  onUpdateReportStatus?: (
    reportId: string,
    status: 'Pending' | 'Approved' | 'Rejected',
    remarks: string
  ) => Promise<void>;
  pcIssueReports: PCIssueReport[];
  onUpdatePcIssueStatus: (reportId: string, status: PCIssueStatus) => Promise<void>;
  onNavigate: (screen: WireframeScreenId) => void;
  onLogout: () => void;
}

type NoticeType = 'success' | 'error' | 'delete';

const PRIMARY_BTN =
  'inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-600/30 transition-all hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60';

export const LabStaffReportDetailView: React.FC<LabStaffReportDetailProps> = ({
  selectedReport,
  onUpdateReportStatus,
  pcIssueReports,
  onUpdatePcIssueStatus,
  onNavigate,
  onLogout,
}) => {
  const [remarks, setRemarks] = useState(selectedReport?.remarks || '');
  const [busy, setBusy] = useState(false);
  const [successNotice, setSuccessNotice] = useState('');
  const [noticeType, setNoticeType] = useState<NoticeType>('success');

  const showNotice = (message: string, type: NoticeType = 'success') => {
    setNoticeType(type);
    setSuccessNotice(message);
  };

  React.useEffect(() => {
    if (!successNotice) return;
    const t = window.setTimeout(() => setSuccessNotice(''), 3500);
    return () => window.clearTimeout(t);
  }, [successNotice]);

  const handleDecision = async (newStatus: 'Approved' | 'Rejected') => {
    if (!selectedReport || !onUpdateReportStatus) return;
    setBusy(true);
    try {
      await onUpdateReportStatus(selectedReport.id, newStatus, remarks);
      showNotice(
        newStatus === 'Approved' ? 'Report verified and approved.' : 'Report marked as rejected.',
        newStatus === 'Approved' ? 'success' : 'delete'
      );
    } catch (e) {
      showNotice(e instanceof Error ? e.message : 'Unable to update this report.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const isDeleteToast = noticeType === 'delete';
  const isErrorToast = noticeType === 'error';
  const toastAccent = isDeleteToast || isErrorToast ? 'bg-rose-500' : 'bg-emerald-500';
  const toastBorder = isDeleteToast || isErrorToast ? 'border-rose-200' : 'border-emerald-200';
  const toastLabel = isDeleteToast || isErrorToast ? 'text-rose-600' : 'text-emerald-600';
  const toastTitle = isDeleteToast ? 'Rejected' : isErrorToast ? 'Error' : 'Approved';

  if (!selectedReport) {
    return (
      <div className="min-h-[calc(100vh-44px)] bg-[#eef1f7]">
        <ClamsHeader onNavigate={onNavigate} statusLabel="Computer Laboratory System" showLogout={false} />
        <div className="clams-layout">
          <LabStaffSubNav activeScreen="lab-staff-report-detail" onNavigate={onNavigate} onLogout={onLogout} />
          <main className="space-y-6">
            <p className="rounded-lg border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500 shadow-sm">
              No report selected.
            </p>
            <PCIssueRepairQueue reports={pcIssueReports} onUpdateStatus={onUpdatePcIssueStatus} />
          </main>
        </div>
      </div>
    );
  }

  const statusDisplay =
    selectedReport.status === 'Pending'
      ? { label: 'Pending Review', className: 'bg-amber-100 text-amber-800 border border-amber-200' }
      : selectedReport.status === 'Approved'
        ? { label: 'Approved', className: 'bg-emerald-100 text-emerald-800 border border-emerald-200' }
        : { label: 'Rejected', className: 'bg-rose-100 text-rose-800 border border-rose-200' };

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#eef1f7]">
      <ClamsHeader onNavigate={onNavigate} statusLabel="Computer Laboratory System" showLogout={false} />

      <div className="clams-layout">
        <LabStaffSubNav activeScreen="lab-staff-report-detail" onNavigate={onNavigate} onLogout={onLogout} />

        <main className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#1b325f]/15 bg-gradient-to-r from-[#1b325f]/[0.04] to-transparent px-6 py-5 shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-[#1b325f]">PC Report Details</h1>
              <p className="mt-1 text-sm text-slate-500">
                Viewing record {selectedReport.subjectCode} Class Session Log for verification.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('lab-staff-report-export')}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#1b325f]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#1b325f] shadow-sm transition-colors hover:bg-[#1b325f]/5"
            >
              View Fixed PC Issues
            </button>
          </div>

          {/* Metadata card */}
          <section className="grid grid-cols-1 gap-6 rounded-2xl border border-[#1b325f]/10 bg-white px-6 py-5 text-sm shadow-sm sm:grid-cols-2">
            <div className="space-y-2">
              <div>
                <span className="font-bold text-slate-800">Subject Code:</span>{' '}
                <span className="text-slate-600">{selectedReport.subjectCode} ({selectedReport.subjectName})</span>
              </div>
              <div>
                <span className="font-bold text-slate-800">Lab Room:</span>{' '}
                <span className="text-slate-600">{selectedReport.labRoom}</span>
              </div>
              <div>
                <span className="font-bold text-slate-800">Instructor Name:</span>{' '}
                <span className="text-slate-600">{selectedReport.instructor}</span>
              </div>
            </div>

            <div className="space-y-2 sm:text-right">
              <div>
                <span className="font-bold text-slate-800">Date:</span>{' '}
                <span className="text-slate-600">{selectedReport.date}</span>
              </div>
              <div>
                <span className="font-bold text-slate-800">Session Time:</span>{' '}
                <span className="text-slate-600 font-mono tabular-nums">{selectedReport.sessionTime}</span>
              </div>
              <div>
                <span className="font-bold text-slate-800">Semester:</span>{' '}
                <span className="text-slate-600">{selectedReport.semester}</span>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            {/* Attendance */}
            <section className="overflow-hidden rounded-2xl border border-[#1b325f]/10 bg-white shadow-sm lg:col-span-8">
              <div className="border-b border-slate-100 px-6 py-4">
                <h2 className="text-sm font-bold text-[#1b325f]">Attendance</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-[#1b325f] text-xs font-bold uppercase tracking-wider text-white">
                      <th className="w-12 px-4 py-4 text-left font-semibold text-white/70">#</th>
                      <th className="px-4 py-4 text-left">Student ID</th>
                      <th className="px-4 py-4 text-left">Full Name</th>
                      <th className="px-4 py-4 text-left">Time In</th>
                      <th className="px-4 py-4 text-left">PC #</th>
                      <th className="px-4 py-4 text-right font-semibold text-white/70">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedReport.attendanceList.map((entry, idx) => (
                      <tr key={entry.id} className="transition-colors hover:bg-[#1b325f]/[0.02]">
                        <td className="px-4 py-4 font-mono text-xs tabular-nums text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-4 font-mono text-xs tabular-nums text-slate-500">{entry.studentId}</td>
                        <td className="px-4 py-4 font-bold text-slate-800">{entry.formalName}</td>
                        <td className="px-4 py-4 font-mono text-xs tabular-nums text-slate-600">{entry.timeIn}</td>
                        <td className="px-4 py-4 font-mono text-xs tabular-nums text-slate-600">{entry.pcNumber}</td>
                        <td className="px-4 py-4 text-right">
                          <span
                            className={`inline-block rounded-md border px-2.5 py-1 text-xs font-semibold ${entry.status === 'On-Time'
                                ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                                : 'border-amber-200 bg-amber-100 text-amber-800'
                              }`}
                          >
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Approval panel */}
            <section className="space-y-5 rounded-2xl border border-[#1b325f]/10 bg-white shadow-sm lg:col-span-4">
              <div className="border-b border-slate-100 px-6 py-4">
                <h2 className="text-sm font-bold text-[#1b325f]">Approval Panel</h2>
              </div>

              <div className="space-y-5 px-6 pb-6">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <span className="font-medium text-slate-500">Current Status</span>
                  <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${statusDisplay.className}`}>
                    {statusDisplay.label}
                  </span>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Remarks (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Record any verification or rejection notes..."
                    className="w-full resize-none rounded-lg border border-slate-300 bg-slate-50/60 p-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15"
                  />
                </div>

                <div className="space-y-3 pt-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDecision('Approved')}
                    className={`${PRIMARY_BTN} w-full justify-center`}
                  >
                    Approve Report
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDecision('Rejected')}
                    className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-rose-300 bg-white px-5 py-3 text-sm font-semibold text-rose-600 transition-colors hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                  >
                    Reject Report
                  </button>
                </div>
              </div>
            </section>
          </div>

          <PCIssueRepairQueue reports={pcIssueReports} onUpdateStatus={onUpdatePcIssueStatus} />
        </main>
      </div>

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
              onClick={() => setSuccessNotice('')}
              className="ml-2 rounded-md p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
              aria-label="Dismiss"
            >
              <span className="sr-only">Dismiss</span>
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};