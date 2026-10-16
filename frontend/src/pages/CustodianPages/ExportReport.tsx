import React, { useEffect, useState } from 'react';
import { Download, Save, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { ClamsHeader } from '../../components/ClamsHeader';
import { LabStaffSubNav } from '../../components/CustodianComponents/LabStaffSubNav';
import type { PCIssueReport, WireframeScreenId } from '../../types';

interface LabStaffExportProps {
  reports: PCIssueReport[];
  onSaveCustodianReport: (reportId: string, custodianReport: string) => Promise<void>;
  onNavigate: (screen: WireframeScreenId) => void;
  onLogout: () => void;
}

type NoticeType = 'success' | 'error';

export const LabStaffReportExportView: React.FC<LabStaffExportProps> = ({
  reports,
  onSaveCustodianReport,
  onNavigate,
  onLogout,
}) => {
  const [reportDrafts, setReportDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState('');
  const [noticeType, setNoticeType] = useState<NoticeType>('success');

  useEffect(() => {
    if (!successNotice) return;
    const t = window.setTimeout(() => setSuccessNotice(''), 3500);
    return () => window.clearTimeout(t);
  }, [successNotice]);

  const showNotice = (message: string, type: NoticeType = 'success') => {
    setNoticeType(type);
    setSuccessNotice(message);
  };

  const resolvedReports = reports.filter((report) => report.status === 'RESOLVED');

  const getDraft = (report: PCIssueReport) =>
    reportDrafts[report.id] ?? report.custodianReport ?? '';

  const saveReport = async (reportId: string, draft: string) => {
    setSavingId(reportId);
    try {
      await onSaveCustodianReport(reportId, draft.trim());
      showNotice('Repair notes saved successfully.');
    } catch (e) {
      showNotice(e instanceof Error ? e.message : 'Unable to save repair notes.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const savePdf = (report: PCIssueReport) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 44;
    const contentWidth = pageWidth - margin * 2;
    let currentY = 46;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CLAMS - LABORATORY OPERATIONS', margin, currentY);
    currentY += 28;
    doc.setFontSize(18);
    doc.text('Resolved PC Issue Report', margin, currentY);
    currentY += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Report ID: ${report.id}`, margin, currentY);
    currentY += 12;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, currentY);
    currentY += 16;
    doc.setDrawColor(190, 198, 208);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 22;

    const addField = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(label, margin, currentY);
      currentY += 13;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(value || 'Not provided', contentWidth);
      const blockHeight = lines.length * 12 + 10;
      if (currentY + blockHeight > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
      }
      doc.text(lines, margin, currentY);
      currentY += blockHeight;
    };

    addField('Status', 'Resolved');
    addField('Computer', report.pcNumber);
    addField('Laboratory Room', report.labRoom);
    addField('Issue Category', report.category);
    addField('Reported By (Student ID)', report.studentId);
    addField('Subject', report.subjectCode || 'Not provided');
    addField('Class Schedule', [report.classDay, report.classTimeRange].filter(Boolean).join(' - ') || 'Not provided');
    addField('Issue Description', report.description);
    addField('Submitted', report.submittedAt);
    addField('Resolved', report.resolvedAt || 'Not provided');
    addField('Custodian Repair Report', getDraft(report).trim());

    const safePart = (value: string) =>
      value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';
    doc.save(`clams-pc-repair-${safePart(report.pcNumber)}-${safePart(report.id)}.pdf`);
  };

  const isErrorToast = noticeType === 'error';
  const toastAccent = isErrorToast ? 'bg-rose-500' : 'bg-emerald-500';
  const toastBorder = isErrorToast ? 'border-rose-200' : 'border-emerald-200';
  const toastLabel = isErrorToast ? 'text-rose-600' : 'text-emerald-600';
  const toastTitle = isErrorToast ? 'Error' : 'Saved';

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#eef1f7]">
      <ClamsHeader onNavigate={onNavigate} statusLabel="Computer Laboratory System" showLogout={false} />

      <div className="clams-layout">
        <LabStaffSubNav activeScreen="lab-staff-report-export" onNavigate={onNavigate} onLogout={onLogout} />

        <main className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#1b325f]/15 bg-gradient-to-r from-[#1b325f]/[0.04] to-transparent px-6 py-5 shadow-sm no-print">
            <div>
              <h1 className="text-2xl font-bold text-[#1b325f]">Fixed PC Issue Reports</h1>
              <p className="mt-1 text-sm text-slate-500">
                Only issues marked fixed appear here. Add the repair details before exporting.
              </p>
            </div>
          </div>

          {resolvedReports.length === 0 ? (
            <section className="rounded-2xl border border-[#1b325f]/10 bg-white px-6 py-16 text-center shadow-sm">
              <h2 className="text-base font-semibold text-slate-700">No fixed PC issues to export</h2>
              <p className="mt-1 text-sm text-slate-500">
                Issues will appear here after a custodian marks them fixed.
              </p>
            </section>
          ) : (
            <div className="space-y-5">
              {resolvedReports.map((report) => {
                const draft = getDraft(report);
                const hasChanges = draft !== (report.custodianReport ?? '');

                return (
                  <article
                    key={report.id}
                    className="overflow-hidden rounded-2xl border border-[#1b325f]/10 bg-white shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
                      <div>
                        <h2 className="text-base font-bold text-[#1b325f]">
                          Repair Report: {report.pcNumber}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          {report.category} · Student {report.studentId}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          Resolved{report.resolvedAt ? ` · ${report.resolvedAt}` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => savePdf(report)}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#1b325f]/20 bg-white px-3.5 py-2 text-xs font-semibold text-[#1b325f] transition-colors hover:bg-[#1b325f]/5 no-print"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Save PDF
                        </button>
                      </div>
                    </div>

                    <dl className="grid gap-4 px-6 py-5 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-slate-500">Issue reported</dt>
                        <dd className="mt-1 whitespace-pre-wrap text-slate-800">{report.description}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">Submitted</dt>
                        <dd className="mt-1 text-slate-800">{report.submittedAt}</dd>
                      </div>
                    </dl>

                    {report.imageUrls && report.imageUrls.length > 0 && (
                      <div className="border-t border-slate-100 px-6 py-4">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Photos from student
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {report.imageUrls.map((url, idx) => (
                            <a key={idx} href={url} target="_blank" rel="noreferrer" className="block">
                              <img
                                src={url}
                                alt={`Photo ${idx + 1}`}
                                className="h-20 w-20 rounded-lg border border-slate-200 object-cover transition hover:ring-2 hover:ring-[#1b325f]/40"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-slate-100 px-6 py-5">
                      <label
                        htmlFor={`custodian-report-${report.id}`}
                        className="mb-2 block text-xs font-semibold text-slate-700"
                      >
                        Custodian repair report
                      </label>
                      <textarea
                        id={`custodian-report-${report.id}`}
                        rows={4}
                        value={draft}
                        onChange={(event) =>
                          setReportDrafts((current) => ({ ...current, [report.id]: event.target.value }))
                        }
                        placeholder="Describe the repair performed and the result."
                        className="w-full resize-y rounded-lg border border-slate-300 bg-slate-50/60 p-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15"
                      />
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void saveReport(report.id, draft)}
                          disabled={!draft.trim() || !hasChanges || savingId === report.id}
                          className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-600/30 transition-all hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 no-print"
                        >
                          <Save className="h-4 w-4" />
                          {savingId === report.id ? 'Saving...' : 'Save Report'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
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
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};