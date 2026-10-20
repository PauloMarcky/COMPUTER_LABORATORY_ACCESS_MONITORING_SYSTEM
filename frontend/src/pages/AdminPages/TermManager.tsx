import React, { useEffect, useState } from 'react';
import { Plus, X, CheckCircle2, Trash2 } from 'lucide-react';
import { ClamsHeader } from '../../components/ClamsHeader';
import { AdminSubNav } from '../../components/AdminComponents/AdminSubNav';
import { API_BASE_URL, readApiResponse } from '../../api';
import type { WireframeScreenId } from '../../types';

interface Term {
  id: number;
  academicYear: string;
  semester: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface Props {
  onLogout: () => void;
  token: string;
  onNavigate: (screen: WireframeScreenId) => void;
}

const SEMESTERS = ['1ST', '2ND', 'SUMMER'];

const emptyForm = {
  academicYear: '',
  semester: '1ST',
  startDate: '',
  endDate: '',
  makeActive: true,
  copySchedules: true,
};

export const TermManagerView: React.FC<Props> = ({ token, onNavigate, onLogout }) => {
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Term | null>(null);
  const [deleting, setDeleting] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const sourceTerm = terms.find((t) => t.isActive) ?? terms[0] ?? null;

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/terms`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await readApiResponse<{ terms: Term[] }>(res);
      setTerms(data.terms || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load terms.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const openForm = () => {
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        academicYear: form.academicYear,
        semester: form.semester,
        startDate: form.startDate,
        endDate: form.endDate,
        makeActive: form.makeActive,
      };
      if (form.copySchedules && sourceTerm) body.copyFromTermId = sourceTerm.id;
      const res = await fetch(`${API_BASE_URL}/terms`, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await readApiResponse<{ error?: string; copied?: number; skipped?: number }>(res);
      if (!res.ok) throw new Error(data.error || 'Unable to create term.');
      setShowForm(false);
      await load();
      const copied = data.copied ?? 0;
      const skipped = data.skipped ?? 0;
      setNotice(
        form.copySchedules && sourceTerm
          ? `Term created. ${copied} schedule${copied === 1 ? '' : 's'} copied${skipped ? `, ${skipped} skipped` : ''}.`
          : 'Term created.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create term.');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (t: Term) => {
    setActivatingId(t.id);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/terms/${t.id}/activate`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Unable to activate term.');
      await load();
      setNotice(`${t.academicYear} ${t.semester} is now the active term.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to activate term.');
    } finally {
      setActivatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/terms/${pendingDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 204) {
        setNotice(`${pendingDelete.academicYear} ${pendingDelete.semester} deleted.`);
        setPendingDelete(null);
        await load();
      } else {
        const data = await readApiResponse<{ error?: string }>(res);
        setError(data.error || 'Unable to delete term.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete term.');
    } finally {
      setDeleting(false);
    }
  };

  const day = (value: string) => (value ? value.slice(0, 10) : '—');
  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15';

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#eef1f7]">
      <ClamsHeader onNavigate={onNavigate} statusLabel="Computer Laboratory System" showLogout={false} />

      <div className="clams-layout">
        <AdminSubNav activeScreen="admin-terms" onNavigate={onNavigate} onLogout={onLogout} />

        <main className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#1b325f]/15 bg-gradient-to-r from-[#1b325f]/[0.04] to-transparent px-6 py-5 shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-[#1b325f]">Terms</h1>
              <p className="mt-1 text-sm text-slate-500">
                Start a new semester without losing past records.
              </p>
            </div>
            <button
              onClick={openForm}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-600/30 transition-all hover:bg-blue-700 hover:shadow-lg"
            >
              <Plus className="h-4 w-4" />
              <span>Start New Term</span>
            </button>
          </div>

          {error && !showForm && !pendingDelete && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
              {error}
            </p>
          )}

          <section className="overflow-hidden rounded-2xl border border-[#1b325f]/10 bg-white shadow-lg shadow-[#1b325f]/5">
            <table className="w-full text-sm">
              <thead className="bg-[#1b325f] text-xs font-bold uppercase tracking-wider text-white">
                <tr>
                  <th className="py-4 px-5 text-left">Academic Year</th>
                  <th className="py-4 px-4 text-left">Semester</th>
                  <th className="py-4 px-4 text-left">Dates</th>
                  <th className="py-4 px-4 text-left">Status</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-sm text-slate-400">Loading terms...</td>
                  </tr>
                ) : terms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-sm text-slate-400">
                      No terms yet. Click <span className="font-semibold text-[#1b325f]">Start New Term</span> to create one.
                    </td>
                  </tr>
                ) : (
                  terms.map((t) => (
                    <tr key={t.id} className="transition-colors hover:bg-[#1b325f]/[0.02]">
                      <td className="py-4 px-5 font-semibold text-[#1b325f]">{t.academicYear}</td>
                      <td className="py-4 px-4 text-slate-700">{t.semester}</td>
                      <td className="py-4 px-4 text-slate-600">{day(t.startDate)} → {day(t.endDate)}</td>
                      <td className="py-4 px-4">
                        {t.isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                            Closed
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          {!t.isActive && (
                            <button
                              onClick={() => void handleActivate(t)}
                              disabled={activatingId === t.id}
                              className="rounded-md border border-[#1b325f]/20 bg-[#1b325f]/5 px-3 py-1.5 text-xs font-semibold text-[#1b325f] transition-colors hover:bg-[#1b325f]/10 disabled:opacity-50"
                            >
                              {activatingId === t.id ? 'Activating...' : 'Make active'}
                            </button>
                          )}
                          <button
                            onClick={() => { setError(''); setPendingDelete(t); }}
                            disabled={t.isActive || (deleting && pendingDelete?.id === t.id)}
                            className="rounded-md p-2 text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                            title={t.isActive ? 'Activate a different term first' : 'Delete term'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </main>
      </div>

      {notice && (
        <div className="fixed right-6 top-6 z-[60] animate-toast-in">
          <div className="flex items-center gap-3 overflow-hidden rounded-xl border border-emerald-200 bg-white px-5 py-4 shadow-2xl">
            <div className="h-10 w-1 shrink-0 rounded-full bg-emerald-500" />
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Success</div>
              <div className="mt-0.5 text-sm text-slate-700">{notice}</div>
            </div>
            <button
              type="button"
              onClick={() => setNotice('')}
              className="ml-2 rounded-md p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1a30]/70 px-4 backdrop-blur-sm"
          onClick={() => !saving && setShowForm(false)}
        >
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="animate-pop-in w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl shadow-[#1b325f]/40"
          >
            <div className="flex items-center justify-between bg-[#1b325f] px-6 py-4">
              <h2 className="text-lg font-bold text-white">Start New Term</h2>
              <button
                type="button"
                onClick={() => !saving && setShowForm(false)}
                className="rounded-full bg-white/10 p-1.5 text-white/80 ring-1 ring-white/20 transition-colors hover:bg-white/20 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Academic Year</label>
                  <input
                    value={form.academicYear}
                    onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                    required
                    className={inputClass}
                    placeholder="2025-2026"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Semester</label>
                  <select
                    value={form.semester}
                    onChange={(e) => setForm({ ...form, semester: e.target.value })}
                    className={inputClass}
                  >
                    {SEMESTERS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.makeActive}
                  onChange={(e) => setForm({ ...form, makeActive: e.target.checked })}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">Make this the active term</span>
                  <span className="block text-xs text-slate-500">The current term is closed. Its records are kept.</span>
                </span>
              </label>

              <label className={`flex items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 ${sourceTerm ? 'cursor-pointer' : 'opacity-50'}`}>
                <input
                  type="checkbox"
                  checked={form.copySchedules && Boolean(sourceTerm)}
                  disabled={!sourceTerm}
                  onChange={(e) => setForm({ ...form, copySchedules: e.target.checked })}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                    Copy schedules{sourceTerm ? ` from ${sourceTerm.academicYear} ${sourceTerm.semester}` : ''}
                  </span>
                  <span className="block text-xs text-slate-500">Same subject, teacher, room and time. Rosters start empty.</span>
                </span>
              </label>

              {error && (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => !saving && setShowForm(false)}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-600/30 transition-all hover:bg-blue-700 hover:shadow-lg disabled:opacity-60"
              >
                {saving ? 'Creating...' : 'Create Term'}
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1a30]/70 px-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            className="animate-pop-in w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl shadow-rose-900/20"
          >
            <div className="bg-rose-700 px-6 py-4">
              <h2 className="text-lg font-bold text-white">Delete term?</h2>
            </div>
            <div className="space-y-4 px-6 py-6">
              <p className="text-sm text-slate-600">
                Delete{' '}
                <span className="font-bold text-slate-800">
                  {pendingDelete.academicYear} {pendingDelete.semester}
                </span>
                ? This cannot be undone.
              </p>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Only terms with no schedules can be deleted. Past attendance records are safe — they belong to schedules, not to the term itself.
              </p>
              {error && (
                <p role="alert" className="text-sm font-medium text-rose-700">{error}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => { setPendingDelete(null); setError(''); }}
                disabled={deleting}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Deleting...' : 'Delete term'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};