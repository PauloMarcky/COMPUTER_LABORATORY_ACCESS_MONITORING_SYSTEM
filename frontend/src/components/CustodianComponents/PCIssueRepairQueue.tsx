import React from 'react';
import { Check, ChevronLeft, ChevronRight, CircleDashed, X, Wrench } from 'lucide-react';
import type { PCIssueReport, PCIssueStatus } from '../../types';

interface PCIssueRepairQueueProps {
  reports: PCIssueReport[];
  onUpdateStatus: (reportId: string, status: PCIssueStatus) => Promise<void>;
}

export const PCIssueRepairQueue: React.FC<PCIssueRepairQueueProps> = ({
  reports,
  onUpdateStatus,
}) => {
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const [preview, setPreview] = React.useState<{ urls: string[]; index: number } | null>(null);
  React.useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(null);
      else if (e.key === 'ArrowRight') setPreview((p) => (p ? { ...p, index: (p.index + 1) % p.urls.length } : p));
      else if (e.key === 'ArrowLeft') setPreview((p) => (p ? { ...p, index: (p.index - 1 + p.urls.length) % p.urls.length } : p));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);
  const updateStatus = async (reportId: string, status: PCIssueStatus) => {
    setBusyId(reportId);
    setError('');
    try {
      await onUpdateStatus(reportId, status);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update this issue.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mt-8 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">PC Issue Queue</h2>
        <p className="mt-1 text-xs text-slate-500">
          Track each reported issue from review through repair or rejection.
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
          No PC issues reported.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const statusLabel = {
              PENDING: 'Pending',
              IN_PROGRESS: 'In Progress',
              RESOLVED: 'Resolved',
              REJECTED: 'Rejected',
            }[report.status];
            const statusClass = {
              PENDING: 'bg-amber-50 text-amber-800',
              IN_PROGRESS: 'bg-blue-50 text-blue-800',
              RESOLVED: 'bg-emerald-50 text-emerald-800',
              REJECTED: 'bg-rose-50 text-rose-800',
            }[report.status];
            return (
              <article
                key={report.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="text-sm font-bold text-slate-900">{report.pcNumber}</h3>
                    <span className="text-xs font-semibold text-slate-600">{report.category}</span>
                    <span className="text-xs text-slate-400">Student {report.studentId}</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${statusClass}`}>{statusLabel}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{report.description}</p>
                  <p className="mt-2 text-[11px] text-slate-400">Reported {report.submittedAt}</p>
                  {report.imageUrls && report.imageUrls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {report.imageUrls.map((url, idx, all) => (
                        <button key={idx} type="button" onClick={() => setPreview({ urls: all, index: idx })} aria-label={`View photo ${idx + 1}`} className="block cursor-zoom-in">
                          <img
                            src={url}
                            alt={`Photo ${idx + 1}`}
                            className="h-16 w-16 rounded-md border border-slate-200 object-cover transition hover:ring-2 hover:ring-[#1b325f]/40"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {report.status === 'PENDING' && (
                    <button type="button" disabled={busyId === report.id} onClick={() => void updateStatus(report.id, 'IN_PROGRESS')} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60">
                      <Wrench className="h-3.5 w-3.5" /> {busyId === report.id ? 'Saving...' : 'Start Repair'}
                    </button>
                  )}
                  {report.status === 'IN_PROGRESS' && (
                    <button type="button" disabled={busyId === report.id} onClick={() => void updateStatus(report.id, 'RESOLVED')} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60">
                      <Check className="h-3.5 w-3.5" /> {busyId === report.id ? 'Saving...' : 'Mark Fixed'}
                    </button>
                  )}
                  {(report.status === 'PENDING' || report.status === 'IN_PROGRESS') && (
                    <button type="button" disabled={busyId === report.id} onClick={() => void updateStatus(report.id, 'REJECTED')} className="inline-flex items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-60">
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  )}
                  {(report.status === 'RESOLVED' || report.status === 'REJECTED') && <span className="inline-flex items-center gap-1.5 px-2 py-2 text-xs font-medium text-slate-400"><CircleDashed className="h-3.5 w-3.5" /> Closed</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</p>}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            aria-label="Close preview"
            className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-800 shadow transition hover:bg-white"
          >
            <X className="h-5 w-5" />
          </button>
          {preview.urls.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPreview({ ...preview, index: (preview.index - 1 + preview.urls.length) % preview.urls.length }); }}
              aria-label="Previous photo"
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-800 shadow transition hover:bg-white"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <img
            src={preview.urls[preview.index]}
            alt={`Photo ${preview.index + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
          {preview.urls.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPreview({ ...preview, index: (preview.index + 1) % preview.urls.length }); }}
              aria-label="Next photo"
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-800 shadow transition hover:bg-white"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800">
            {preview.index + 1} / {preview.urls.length}
          </span>
        </div>
      )}
    </section>
  );
};