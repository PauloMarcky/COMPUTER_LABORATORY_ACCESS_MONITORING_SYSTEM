import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { ClamsHeader } from '../../components/ClamsHeader';
import type { PCIssueReport, WireframeScreenId } from '../../types';

interface StudentReportIssueProps {
  selectedPc: string;
  reports: PCIssueReport[];
  canSubmitIssue: boolean;
  onSubmitIssue: (
    category: PCIssueReport['category'],
    description: string,
    images?: File[],
  ) => Promise<void>;
  onNavigate: (screen: WireframeScreenId) => void;
  onLogout?: () => void | Promise<void>;
}

const ISSUE_CATEGORIES: PCIssueReport['category'][] = [
  'Mouse / Keyboard',
  'Monitor',
  'No Power',
  'No Network',
  'Software',
  'Other',
];

async function compressImage(file: File): Promise<File> {
  const MAX_DIM = 1600;
  const QUALITY = 0.85;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export const StudentReportIssueView: React.FC<StudentReportIssueProps> = ({
  selectedPc,
  reports,
  canSubmitIssue,
  onSubmitIssue,
  onNavigate,
  onLogout,
}) => {
  const [selectedCategory, setSelectedCategory] =
    useState<PCIssueReport['category']>('Mouse / Keyboard');
  const [description, setDescription] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<{ file: File; previewUrl: string }[]>([]);
  const [compressing, setCompressing] = useState(false);

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const remaining = 3 - images.length;
    const toAdd = files.slice(0, remaining);
    setCompressing(true);
    try {
      const processed = await Promise.all(
        toAdd.map(async (file) => {
          const compressed = await compressImage(file);
          return { file: compressed, previewUrl: URL.createObjectURL(compressed) };
        }),
      );
      setImages((prev) => [...prev, ...processed]);
      setSubmittedSuccess(false);
    } finally {
      setCompressing(false);
      event.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].previewUrl);
      next.splice(index, 1);
      return next;
    });
  };
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedDescription = description.trim();
    if (!selectedPc || !trimmedDescription) return;

    setSubmitting(true);
    setError('');
    try {
      await onSubmitIssue(selectedCategory, trimmedDescription, images.map((img) => img.file));
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      setImages([]);
      setSubmittedSuccess(true);
      setDescription('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit the issue report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#f4f6f9]">
      <ClamsHeader onNavigate={onNavigate} statusLabel="Computer Laboratory System" onLogout={onLogout} />

      <main className="px-4 py-6 sm:py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {canSubmitIssue ? 'Report a PC Issue' : 'My PC Reports'}
            </h1>
            <p className="text-base text-slate-500 mt-1 font-mono tabular-nums">
              {selectedPc ? `PC-${selectedPc}` : 'No PC selected'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('student-claim-pc')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#1b325f] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Seat Claim</span>
          </button>
        </div>

        {canSubmitIssue && <form
          onSubmit={handleSubmit}
          className="mt-6 bg-white rounded-xl border border-slate-200/90 p-4 space-y-5 sm:p-6"
        >
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2.5">
              Issue Category
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {ISSUE_CATEGORIES.map((category) => {
                const active = selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(category);
                      setSubmittedSuccess(false);
                    }}
                    className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer whitespace-nowrap ${active
                      ? 'bg-[#1b325f] border-[#1b325f] text-white shadow-2xs'
                      : 'bg-slate-50/80 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="issue-description"
              className="block text-sm font-bold text-slate-700 mb-2"
            >
              Describe the issue
            </label>
            <textarea
              id="issue-description"
              rows={4}
              required
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setSubmittedSuccess(false);
              }}
              placeholder="e.g. Left click doesn't register"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/40 p-4 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#1b325f] transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!selectedPc || !description.trim() || submitting || compressing}
            className="w-full py-3.5 px-6 rounded-lg bg-[#1b325f] hover:bg-[#142547] text-white font-semibold text-sm transition-colors cursor-pointer shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Photos{' '}
              <span className="text-slate-400 font-normal">(optional, up to 3)</span>
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesSelected}
              disabled={images.length >= 3 || compressing || submitting}
              className="block w-full text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-100 disabled:opacity-50"
            />
            {compressing && (
              <p className="mt-2 text-xs text-slate-500">Compressing...</p>
            )}
            {images.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {images.map((image, index) => (
                  <div key={index} className="relative">
                    <img
                      src={image.previewUrl}
                      alt={`Preview ${index + 1}`}
                      className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -right-2 -top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-rose-600 text-xs font-bold text-white shadow-md hover:bg-rose-700"
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-rose-700">{error}</p>}

          {submittedSuccess && (
            <div className="flex flex-col gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Issue report recorded for this session against PC-{selectedPc}.</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('student-claim-pc')}
                className="font-semibold underline whitespace-nowrap cursor-pointer"
              >
                Return to PC-{selectedPc}
              </button>
            </div>
          )}
        </form>}

        {reports.length > 0 ? (
          <div className="mt-6 bg-white rounded-xl border border-slate-200/80 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-base font-bold text-slate-700">
                My Reports ({reports.length})
              </div>
              <span className="text-sm text-slate-500">Updated by lab staff</span>
            </div>
            <div className="space-y-3 text-base">
              {reports.map((report) => (
                <div key={report.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-slate-800">{report.pcNumber}</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-semibold text-slate-700">{report.category}</span>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${report.status === 'RESOLVED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : report.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-700'
                        : report.status === 'IN_PROGRESS'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-200 text-slate-700'}`}>
                      {report.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-slate-600 font-medium">
                    {report.subjectCode || 'Subject'} • {report.classDay || 'Day'} • {report.classTimeRange || 'Time'}
                  </div>

                  <p className="mt-2 text-slate-600">{report.description}</p>
                  <p className="mt-2 text-sm text-slate-500">Submitted {report.submittedAt}</p>

                  <div className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Custodian update
                    </div>
                    {report.custodianReport ? (
                      <p className="text-slate-700 leading-5">{report.custodianReport}</p>
                    ) : (
                      <p className="text-slate-400">Waiting for a custodian update on this report.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 bg-white rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
            No reports submitted yet. Once you submit a lab issue, it will appear here with the latest custodian update.
          </div>
        )}
      </main>
    </div>
  );
};
