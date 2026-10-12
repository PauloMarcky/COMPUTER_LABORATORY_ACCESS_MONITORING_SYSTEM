import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen, CalendarDays, CheckCircle2, ChevronDown, Clock, Download, Edit3,
  Monitor, Plus, Printer, Search, Trash2, User, Users, Wrench, X,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { ClamsHeader } from '../../components/ClamsHeader';
import { LabStaffSubNav } from '../../components/CustodianComponents/LabStaffSubNav';
import { formatSchoolDate } from '../../utils/attendance-time';
import { API_BASE_URL, readApiResponse } from '../../api';
import type { LabRoomStatus, LabUsageRecord, Pc, PcStatus, WireframeScreenId } from '../../types';

interface Props {
  records: LabUsageRecord[];
  rooms: LabRoomStatus[];
  activeTab: 'rooms' | 'history';
  onTabChange: (tab: 'rooms' | 'history') => void;
  onNavigate: (screen: WireframeScreenId) => void;
  token?: string;
  onRoomsChanged?: () => void;
}

/* ---------------- Date helpers ---------------- */

const pad = (v: number) => String(v).padStart(2, '0');
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const weekRange = (ymd: string): [string, string] => {
  const date = parseYmd(ymd);
  const sinceMonday = (date.getDay() + 6) % 7;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - sinceMonday);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return [toYmd(start), toYmd(end)];
};
const monthRange = (ymd: string): [string, string] => {
  const date = parseYmd(ymd);
  return [
    toYmd(new Date(date.getFullYear(), date.getMonth(), 1)),
    toYmd(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  ];
};
const prettyDate = (ymd: string) =>
  parseYmd(ymd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const PAGE_SIZE = 8;

/* ================================================================
 *  MAIN PAGE
 * ================================================================ */

export const LabStaffUsagePage: React.FC<Props> = ({
  records,
  rooms,
  activeTab,
  onTabChange,
  onNavigate,
  token,
  onRoomsChanged,
}) => {
  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#eef1f7] print:min-h-0 print:bg-white">
      <style>{'@page { size: A4; margin: 12mm; }'}</style>
      <ClamsHeader onNavigate={onNavigate} statusLabel="Computer Laboratory System" />

      <div className="clams-layout print:block">
        <LabStaffSubNav activeScreen="lab-staff-usage-history" onNavigate={onNavigate} />

        <main className="space-y-6 print:hidden">
          {/* Header + tabs */}
          <div className="rounded-2xl border border-[#1b325f]/15 bg-gradient-to-r from-[#1b325f]/[0.04] to-transparent px-6 pt-5 shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-[#1b325f]">Laboratory Usage</h1>
              <p className="mt-1 text-sm text-slate-500">
                {activeTab === 'rooms'
                  ? 'Live status of every laboratory room.'
                  : 'History of completed class sessions with attendance and export.'}
              </p>
            </div>

            <div className="mt-5 flex gap-1">
              <button
                type="button"
                onClick={() => onTabChange('rooms')}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-t-lg px-5 py-3 text-sm font-semibold transition-colors ${activeTab === 'rooms'
                    ? 'bg-white text-[#1b325f] shadow-sm'
                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                  }`}
              >
                <Monitor className="h-4 w-4" />
                Live Rooms
              </button>
              <button
                type="button"
                onClick={() => onTabChange('history')}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-t-lg px-5 py-3 text-sm font-semibold transition-colors ${activeTab === 'history'
                    ? 'bg-white text-[#1b325f] shadow-sm'
                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                  }`}
              >
                <BookOpen className="h-4 w-4" />
                History
              </button>
            </div>
          </div>

          {activeTab === 'rooms'
            ? <RoomsTab rooms={rooms} token={token} onRoomsChanged={onRoomsChanged} />
            : <HistoryTab records={records} />}
        </main>
      </div>

      {activeTab === 'history' && <PrintView records={records} />}
    </div>
  );
};

/* ================================================================
 *  TAB 1 — LIVE ROOMS
 * ================================================================ */

const PC_STATUS_CYCLE: PcStatus[] = ['AVAILABLE', 'UNDER_REPAIR', 'BROKEN'];

const RoomsTab: React.FC<{
  rooms: LabRoomStatus[];
  token?: string;
  onRoomsChanged?: () => void;
}> = ({ rooms, token, onRoomsChanged }) => {
  const [statusFilter, setStatusFilter] = useState<'IN USE' | 'ALL'>('IN USE');

  const [formOpen, setFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<LabRoomStatus | null>(null);
  const [formName, setFormName] = useState('');
  const [formCapacity, setFormCapacity] = useState('0');
  const [formDescription, setFormDescription] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [pcsByRoom, setPcsByRoom] = useState<Record<string, Pc[]>>({});
  const [pcsLoading, setPcsLoading] = useState<string | null>(null);
  const [pcsError, setPcsError] = useState<string | null>(null);

  const canMutate = Boolean(token);

  const openCreateForm = () => {
    setEditingRoom(null);
    setFormName('');
    setFormCapacity('0');
    setFormDescription('');
    setFormError('');
    setFormOpen(true);
  };

  const openEditForm = (room: LabRoomStatus) => {
    setEditingRoom(room);
    setFormName(room.name);
    setFormCapacity(String(room.totalPcs));
    setFormDescription(room.location);
    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    if (formBusy) return;
    setFormOpen(false);
    setFormError('');
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setFormError('');

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError('Room name is required.');
      return;
    }
    const capacity = Number(formCapacity);
    if (!Number.isInteger(capacity) || capacity < 0 || capacity > 200) {
      setFormError('Capacity must be a whole number between 0 and 200.');
      return;
    }

    setFormBusy(true);
    try {
      const isEdit = Boolean(editingRoom);
      const url = isEdit
        ? `${API_BASE_URL}/lab-rooms/${editingRoom!.id}`
        : `${API_BASE_URL}/lab-rooms`;
      const response = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: trimmedName,
          capacity,
          description: formDescription.trim() || null,
        }),
      });
      const data = await readApiResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || 'Unable to save room.');
      setFormOpen(false);
      onRoomsChanged?.();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save room.');
    } finally {
      setFormBusy(false);
    }
  };

  const handleDelete = async (room: LabRoomStatus) => {
    if (!token) return;
    if (!window.confirm(`Delete "${room.name}"? This cannot be undone.`)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/lab-rooms/${room.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await readApiResponse<{ error?: string }>(response);
        throw new Error(data.error || 'Unable to delete room.');
      }
      onRoomsChanged?.();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to delete room.');
    }
  };

  const toggleRoomPcs = async (room: LabRoomStatus) => {
    if (expandedRoomId === room.id) {
      setExpandedRoomId(null);
      return;
    }
    setExpandedRoomId(room.id);
    if (pcsByRoom[room.id] || !token) return;

    setPcsLoading(room.id);
    setPcsError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/lab-rooms/${room.id}/pcs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readApiResponse<{ error?: string; pcs: Pc[] }>(response);
      if (!response.ok) throw new Error(data.error || 'Unable to load PCs.');
      setPcsByRoom((prev) => ({ ...prev, [room.id]: data.pcs }));
    } catch (error) {
      setPcsError(error instanceof Error ? error.message : 'Unable to load PCs.');
    } finally {
      setPcsLoading(null);
    }
  };

  const cyclePcStatus = async (roomId: string, pc: Pc) => {
    if (!token) return;
    const currentIndex = PC_STATUS_CYCLE.indexOf(pc.status);
    const nextStatus = currentIndex === -1
      ? PC_STATUS_CYCLE[0]
      : PC_STATUS_CYCLE[(currentIndex + 1) % PC_STATUS_CYCLE.length];

    try {
      const response = await fetch(`${API_BASE_URL}/lab-rooms/pcs/${pc.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await readApiResponse<{ error?: string; pc: Pc }>(response);
      if (!response.ok) throw new Error(data.error || 'Unable to update PC.');
      setPcsByRoom((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || []).map((item) => (item.id === pc.id ? data.pc : item)),
      }));
    } catch (error) {
      setPcsError(error instanceof Error ? error.message : 'Unable to update PC.');
    }
  };

  const inUseRooms = rooms.filter((r) => r.status === 'IN USE');
  const availableRooms = rooms.filter((r) => r.status === 'AVAILABLE');
  const visibleRooms = statusFilter === 'IN USE' ? inUseRooms : rooms;

  return (
    <>
      {canMutate && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Laboratory Room
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setStatusFilter('IN USE')}
          className={`flex cursor-pointer items-center gap-4 rounded-2xl border bg-white p-5 text-left shadow-sm transition-all hover:shadow-md ${statusFilter === 'IN USE' ? 'border-emerald-300 ring-2 ring-emerald-300/30' : 'border-[#1b325f]/10 hover:border-emerald-300'
            }`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-emerald-600">
            <Monitor className="h-5 w-5" />
          </div>
          <div>
            <div className="font-mono text-2xl font-bold tabular-nums text-[#1b325f]">{inUseRooms.length}</div>
            <div className="text-sm text-slate-500">Currently In Use</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className="flex cursor-pointer items-center gap-4 rounded-2xl border border-[#1b325f]/10 bg-white p-5 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-100 text-blue-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="font-mono text-2xl font-bold tabular-nums text-[#1b325f]">{availableRooms.length}</div>
            <div className="text-sm text-slate-500">Available Now</div>
          </div>
        </button>
      </div>

      {visibleRooms.length === 0 ? (
        <section className="rounded-2xl border border-[#1b325f]/10 bg-white px-6 py-16 text-center shadow-sm">
          <Monitor className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No rooms to show</p>
          <p className="mt-1 text-xs text-slate-400">
            {statusFilter === 'IN USE'
              ? 'No classes are currently in session.'
              : 'No laboratory rooms have been configured.'}
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {visibleRooms.map((room) => {
            const isInUse = room.status === 'IN USE';
            const isAvailable = room.status === 'AVAILABLE';

            return (
              <div
                key={room.id}
                className="flex flex-col justify-between rounded-2xl border border-[#1b325f]/10 bg-white p-6 shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-base font-bold text-[#1b325f]">{room.name}</h2>
                      <p className="mt-0.5 text-xs text-slate-400">{room.location}</p>
                    </div>
                    <span
                      className={`whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${isInUse
                          ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                          : isAvailable
                            ? 'border-blue-200 bg-blue-100 text-blue-800'
                            : 'border-amber-200 bg-amber-100 text-amber-800'
                        }`}
                    >
                      {room.status}
                    </span>
                  </div>

                  {isInUse ? (
                    <div className="space-y-3 py-4 text-sm">
                      <div className="flex items-center gap-2.5 font-bold text-slate-800">
                        <BookOpen className="h-4 w-4 shrink-0 text-slate-400" />
                        <span>{room.subject}</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-slate-600">
                        <User className="h-4 w-4 shrink-0 text-slate-400" />
                        <span>
                          {room.instructor} · <strong className="text-slate-800">{room.section}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 font-mono text-xs text-slate-500">
                        <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                        <span>{room.timeslot}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-sm text-slate-400">
                      No active class scheduled right now.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
                  <span className="font-mono tabular-nums text-slate-400">{room.totalPcs} Available PCs</span>
                  <span className="inline-flex items-center gap-1.5 font-mono font-bold tabular-nums text-slate-800">
                    <Users className="h-4 w-4 text-slate-500" />
                    <span>
                      {room.occupiedPcs}/{room.totalPcs} Pupils
                    </span>
                  </span>
                </div>

                {canMutate && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => void toggleRoomPcs(room)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                      {expandedRoomId === room.id ? 'Hide PCs' : 'Manage PCs'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditForm(room)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(room)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                )}

                {expandedRoomId === room.id && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    {pcsLoading === room.id ? (
                      <p className="py-4 text-center text-xs text-slate-400">Loading PCs…</p>
                    ) : pcsError && !pcsByRoom[room.id] ? (
                      <p className="py-4 text-center text-xs text-rose-600">{pcsError}</p>
                    ) : (
                      <>
                        <p className="mb-2 text-xs text-slate-500">
                          Click a PC to cycle: Available → Under Repair → Broken.
                        </p>
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                          {(pcsByRoom[room.id] || []).map((pc) => {
                            const palette: Record<PcStatus, string> = {
                              AVAILABLE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                              UNDER_REPAIR: 'border-amber-200 bg-amber-50 text-amber-700',
                              BROKEN: 'border-rose-200 bg-rose-50 text-rose-700',
                              RETIRED: 'border-slate-200 bg-slate-100 text-slate-400',
                            };
                            return (
                              <button
                                key={pc.id}
                                type="button"
                                title={pc.notes || pc.status}
                                onClick={() => void cyclePcStatus(room.id, pc)}
                                className={`cursor-pointer rounded-md border px-2 py-1.5 text-xs font-semibold tabular-nums transition-colors hover:brightness-95 ${palette[pc.status]}`}
                              >
                                {pc.pcNumber}
                              </button>
                            );
                          })}
                        </div>
                        {pcsError && pcsByRoom[room.id] && (
                          <p className="mt-2 text-xs text-rose-600">{pcsError}</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={submitForm}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1b325f]">
                {editingRoom ? 'Edit Laboratory Room' : 'Add Laboratory Room'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                disabled={formBusy}
                className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-semibold text-slate-500">
                Room name
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Lab 5"
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-500">
                Capacity (number of PCs)
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={formCapacity}
                  onChange={(e) => setFormCapacity(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15"
                />
                {editingRoom && (
                  <span className="mt-1 block text-[11px] font-normal text-slate-400">
                    Increasing capacity adds new PCs. Decreasing marks the extra PCs RETIRED
                    (they stay visible but can't be claimed).
                  </span>
                )}
              </label>

              <label className="block text-xs font-semibold text-slate-500">
                Description / Location
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Main computer lab, 2nd floor"
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15"
                />
              </label>
            </div>

            {formError && (
              <p role="alert" className="mt-3 text-sm font-medium text-rose-700">
                {formError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                disabled={formBusy}
                className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formBusy}
                className="cursor-pointer rounded-lg bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {formBusy ? 'Saving…' : editingRoom ? 'Save changes' : 'Create room'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

/* ================================================================
 *  TAB 2 — HISTORY
 * ================================================================ */

const HistoryTab: React.FC<{ records: LabUsageRecord[] }> = ({ records }) => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [labFilter, setLabFilter] = useState('All Laboratories');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const invalidRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return records
      .filter((record) => {
        const matchesFrom = !dateFrom || record.date >= dateFrom;
        const matchesTo = !dateTo || record.date <= dateTo;
        const matchesLab = labFilter === 'All Laboratories' || record.laboratory === labFilter;
        const matchesSearch =
          !query ||
          record.subject.toLowerCase().includes(query) ||
          record.subjectName.toLowerCase().includes(query) ||
          record.instructor.toLowerCase().includes(query) ||
          record.section.toLowerCase().includes(query) ||
          record.laboratory.toLowerCase().includes(query);
        return matchesFrom && matchesTo && matchesLab && matchesSearch;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [records, dateFrom, dateTo, labFilter, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo, labFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const displayedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalAttendanceEntries = filteredRecords.reduce((sum, record) => sum + record.students.length, 0);

  const applyPreset = (preset: 'today' | 'week' | 'month' | 'all') => {
    const today = formatSchoolDate(new Date());
    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'today') {
      setDateFrom(today);
      setDateTo(today);
    } else {
      const [start, end] = preset === 'week' ? weekRange(today) : monthRange(today);
      setDateFrom(start);
      setDateTo(end);
    }
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setLabFilter('All Laboratories');
    setSearchQuery('');
  };

  const handlePrint = () => {
    const prev = document.title;
    const period = dateFrom || dateTo
      ? `${dateFrom ? prettyDate(dateFrom) : 'Earliest'} to ${dateTo ? prettyDate(dateTo) : 'Latest'}`
      : 'All dates';
    document.title = `Laboratory Usage Report - ${period}`;
    window.print();
    document.title = prev;
  };

  const inputClass =
    'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#1b325f] focus:bg-white focus:ring-4 focus:ring-[#1b325f]/15';
  const presetClass =
    'cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50';

  return (
    <>
      {/* Filters + print */}
      <section className="space-y-4 rounded-2xl border border-[#1b325f]/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-xs font-semibold text-slate-500">
            From
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className={`mt-1.5 block ${inputClass}`}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            To
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className={`mt-1.5 block ${inputClass}`}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => applyPreset('today')} className={presetClass}>Today</button>
            <button type="button" onClick={() => applyPreset('week')} className={presetClass}>This Week</button>
            <button type="button" onClick={() => applyPreset('month')} className={presetClass}>This Month</button>
            <button type="button" onClick={() => applyPreset('all')} className={presetClass}>All Dates</button>
          </div>

          <div className="ml-auto">
            <button
              type="button"
              onClick={handlePrint}
              disabled={filteredRecords.length === 0 || invalidRange}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-600/30 transition-all hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print {filteredRecords.length} {filteredRecords.length === 1 ? 'record' : 'records'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by subject, instructor, section or room..."
              className={`w-full pl-9 ${inputClass}`}
            />
          </div>
          <select
            value={labFilter}
            onChange={(e) => setLabFilter(e.target.value)}
            className={`${inputClass} cursor-pointer font-medium`}
          >
            <option value="All Laboratories">All Laboratories</option>
            {[...new Set(records.map((r) => r.laboratory))].map((lab) => (
              <option key={lab} value={lab}>{lab}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Clear filters
          </button>
        </div>

        {invalidRange && (
          <p role="alert" className="text-sm font-medium text-rose-700">
            The start date is after the end date. Adjust the range to see records.
          </p>
        )}
      </section>

      {/* Summary */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#1b325f]/10 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Completed Classes</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#1b325f]">{filteredRecords.length}</div>
        </div>
        <div className="rounded-2xl border border-[#1b325f]/10 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Attendance Entries</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#1b325f]">{totalAttendanceEntries}</div>
        </div>
        <div className="rounded-2xl border border-[#1b325f]/10 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Laboratories Covered</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#1b325f]">
            {new Set(filteredRecords.map((r) => r.laboratory)).size}
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-2xl border border-[#1b325f]/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#1b325f] text-xs font-bold uppercase tracking-wider text-white">
                <th className="px-4 py-4 text-left">Date</th>
                <th className="px-4 py-4 text-left">Class</th>
                <th className="px-4 py-4 text-left">Laboratory</th>
                <th className="px-4 py-4 text-left">Session Time</th>
                <th className="px-4 py-4 text-left">Instructor</th>
                <th className="px-4 py-4 text-left">Attendance</th>
                <th className="px-4 py-4 text-left font-semibold text-white/70">Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedRecords.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-slate-400">
                    {records.length === 0 ? 'No completed classes yet.' : 'No classes match these filters.'}
                  </td>
                </tr>
              )}
              {displayedRecords.map((record) => (
                <React.Fragment key={record.id}>
                  <tr className="transition-colors hover:bg-[#1b325f]/[0.02]">
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-700">{record.date}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        aria-expanded={expandedId === record.id}
                        onClick={() => setExpandedId((c) => (c === record.id ? null : record.id))}
                        className="flex cursor-pointer items-center gap-2 text-left"
                      >
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expandedId === record.id ? 'rotate-180' : ''
                            }`}
                        />
                        <span>
                          <span className="block font-bold text-[#1b325f]">{record.subject}</span>
                          <span className="block text-xs font-medium text-slate-500">
                            {record.subjectName} · Section {record.section} · Year {record.yearLevel}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-800">{record.laboratory}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-mono text-xs tabular-nums text-slate-500">{record.timeslot}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{record.instructor}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {record.studentsPresent} / {record.studentsTotal} present
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveRecordPdf(record, 'room-usage')}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#1b325f]/20 bg-white px-3 py-2 text-xs font-semibold text-[#1b325f] transition-colors hover:bg-[#1b325f]/5"
                        >
                          <Download className="h-3.5 w-3.5" /> Room PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => saveRecordPdf(record, 'attendance-sheet')}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#2563eb] px-3 py-2 text-xs font-semibold text-white shadow-md shadow-amber-600/30 transition-all hover:bg-blue-700"
                        >
                          <Download className="h-3.5 w-3.5" /> Attendance PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === record.id && (
                    <tr>
                      <td colSpan={7} className="bg-[#1b325f]/[0.03] px-6 py-4">
                        {record.students.length === 0 ? (
                          <p className="py-3 text-center text-sm text-slate-500">No student attendance recorded.</p>
                        ) : (
                          <div className="overflow-hidden rounded-lg border border-[#1b325f]/10 bg-white">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-[#1b325f]/[0.06] text-xs font-bold uppercase tracking-wider text-[#1b325f]">
                                <tr>
                                  <th className="px-4 py-3 text-left">#</th>
                                  <th className="px-4 py-3 text-left">Student</th>
                                  <th className="px-4 py-3 text-left">School ID</th>
                                  <th className="px-4 py-3 text-left">Time In</th>
                                  <th className="px-4 py-3 text-left">Time Out</th>
                                  <th className="px-4 py-3 text-left">PC</th>
                                  <th className="px-4 py-3 text-left">Attendance</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {record.students.map((student, index) => (
                                  <tr key={student.id} className="transition-colors hover:bg-[#1b325f]/[0.02]">
                                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{index + 1}</td>
                                    <td className="px-4 py-3 font-semibold text-slate-800">
                                      {student.formalName || student.name}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{student.studentId}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{student.timeIn}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                                      {student.timeOut || 'Not recorded'}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{student.pcNumber}</td>
                                    <td className="px-4 py-3 text-slate-600">{student.status}</td>
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

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/50 px-4 py-3.5 text-sm text-slate-500">
          <span>Showing {displayedRecords.length} of {filteredRecords.length} classes</span>
          <div className="flex items-center gap-1.5 font-mono tabular-nums">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="cursor-pointer rounded border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-white disabled:opacity-40"
            >
              &larr; Prev
            </button>
            <span className="px-2">Page {currentPage} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="cursor-pointer rounded border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-white disabled:opacity-40"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </section>
    </>
  );
};

/* ================================================================
 *  Per-record PDF export
 * ================================================================ */

function saveRecordPdf(record: LabUsageRecord, mode: 'room-usage' | 'attendance-sheet') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const title = mode === 'room-usage' ? 'Laboratory Room Usage' : 'Laboratory Attendance Sheet';

  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('CLAMS - LABORATORY OPERATIONS', margin, 42);
  doc.setFontSize(18);
  doc.text(title, margin, 68);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 86);

  const details: Array<[string, string]> = [
    ['Date', record.date],
    ['Laboratory Room', record.laboratory],
    ['Subject', `${record.subject} - ${record.subjectName}`],
    ['Instructor', record.instructor],
    ['Section / Year Level', `${record.section} / ${record.yearLevel}`],
    ['Session Time', record.timeslot],
    ['Academic Year', record.academicYear || 'Not specified'],
    ['Semester', record.semester || 'Not specified'],
    ['Session Status', 'Completed'],
  ];
  const detailsTop = 112;
  const detailColumnWidth = (contentWidth - 20) / 2;
  details.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + column * (detailColumnWidth + 20);
    const y = detailsTop + row * 36;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(value, detailColumnWidth), x, y + 13);
  });

  if (mode === 'attendance-sheet') {
    const tableTop = detailsTop + Math.ceil(details.length / 2) * 36 + 18;
    const headers = ['No.', 'Student Name', 'School ID', 'Time In', 'Time Out', 'PC', 'Attendance'];
    const columnWidths = [28, 100, 78, 68, 68, 48, contentWidth - 390];
    let currentY = tableTop;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Student Attendance', margin, currentY);
    currentY += 14;

    const drawHeader = () => {
      doc.setFillColor(27, 50, 95);
      doc.setTextColor(255, 255, 255);
      doc.rect(margin, currentY, contentWidth, 24, 'F');
      let x = margin;
      headers.forEach((header, i) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(header, x + 4, currentY + 15);
        x += columnWidths[i];
      });
      currentY += 24;
      doc.setTextColor(20, 20, 20);
    };

    drawHeader();
    record.students.forEach((student, index) => {
      const values = [
        String(index + 1),
        student.formalName || student.name,
        student.studentId,
        student.timeIn,
        student.timeOut || 'Not recorded',
        student.pcNumber,
        `Present - ${student.status}`,
      ];
      const lines = values.map((v, vi) => doc.splitTextToSize(v, columnWidths[vi] - 8));
      const rowHeight = Math.max(22, ...lines.map((l) => l.length * 10 + 8));

      if (currentY + rowHeight > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
        drawHeader();
      }

      doc.setFillColor(
        index % 2 === 0 ? 245 : 255,
        index % 2 === 0 ? 247 : 255,
        index % 2 === 0 ? 250 : 255
      );
      doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      doc.setDrawColor(220, 224, 230);
      doc.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

      let x = margin;
      lines.forEach((cellLines, cellIndex) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(cellLines, x + 4, currentY + 13);
        x += columnWidths[cellIndex];
      });
      currentY += rowHeight;
    });

    if (record.students.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('No student attendance recorded.', margin, currentY + 16);
    }
  }

  const safe = (v: string) =>
    v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'class';
  doc.save(`clams-${mode}-${safe(record.subject)}-${safe(record.section)}-${safe(record.date)}.pdf`);
}

/* ================================================================
 *  Print view (only rendered when the History tab is active)
 * ================================================================ */

const PrintView: React.FC<{ records: LabUsageRecord[] }> = ({ records }) => {
  const totalEntries = records.reduce((sum, r) => sum + r.students.length, 0);

  return (
    <div className="hidden px-1 text-[11px] text-black print:block">
      <header className="mb-4 border-b-2 border-black pb-2 text-center">
        <h1 className="text-base font-bold uppercase tracking-wide">University of La Salette, Inc.</h1>
        <p className="text-[10px]">Santiago City, Isabela</p>
        <p className="mt-1 text-xs font-bold uppercase tracking-wider">Computer Laboratory Usage Report</p>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-1">
        <div>
          <span className="font-bold">Printed:</span> {new Date().toLocaleString()}
        </div>
        <div className="text-right">
          <span className="font-bold">Total classes:</span> {records.length} ·{' '}
          <span className="font-bold">Attendance entries:</span> {totalEntries}
        </div>
      </div>

      {records.map((record, recordIndex) => (
        <section key={record.id} className="mb-6">
          <div className="break-after-avoid">
            <div className="bg-slate-200 px-2 py-1 font-bold">
              {recordIndex + 1}. {record.subject} - {record.subjectName}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 border-x border-b border-slate-400 px-2 py-1.5">
              <div><span className="font-bold">Date:</span> {record.date}</div>
              <div><span className="font-bold">Session Time:</span> {record.timeslot}</div>
              <div><span className="font-bold">Laboratory:</span> {record.laboratory}</div>
              <div><span className="font-bold">Instructor:</span> {record.instructor}</div>
              <div><span className="font-bold">Section / Year:</span> {record.section} / {record.yearLevel}</div>
              <div>
                <span className="font-bold">Term:</span>{' '}
                {[record.academicYear, record.semester].filter(Boolean).join(' ') || 'Not specified'}
              </div>
              <div className="col-span-2">
                <span className="font-bold">Attendance:</span> {record.studentsPresent} of {record.studentsTotal} enrolled students present
              </div>
            </div>
          </div>

          {record.students.length === 0 ? (
            <p className="border-x border-b border-slate-400 px-2 py-2 italic">No student attendance recorded.</p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-100">
                  <th className="w-7 border border-slate-400 px-1.5 py-1">#</th>
                  <th className="border border-slate-400 px-1.5 py-1">Student Name</th>
                  <th className="border border-slate-400 px-1.5 py-1">School ID</th>
                  <th className="border border-slate-400 px-1.5 py-1">Time In</th>
                  <th className="border border-slate-400 px-1.5 py-1">Time Out</th>
                  <th className="border border-slate-400 px-1.5 py-1">PC</th>
                  <th className="border border-slate-400 px-1.5 py-1">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {record.students.map((student, index) => (
                  <tr key={student.id} className="break-inside-avoid">
                    <td className="border border-slate-400 px-1.5 py-0.5">{index + 1}</td>
                    <td className="border border-slate-400 px-1.5 py-0.5">{student.formalName || student.name}</td>
                    <td className="border border-slate-400 px-1.5 py-0.5">{student.studentId}</td>
                    <td className="border border-slate-400 px-1.5 py-0.5">{student.timeIn}</td>
                    <td className="border border-slate-400 px-1.5 py-0.5">{student.timeOut || 'Not recorded'}</td>
                    <td className="border border-slate-400 px-1.5 py-0.5">{student.pcNumber}</td>
                    <td className="border border-slate-400 px-1.5 py-0.5">{student.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}

      <div className="mt-12 grid grid-cols-2 gap-12 break-inside-avoid text-center">
        <div>
          <div className="border-t border-black pt-1 font-bold">Laboratory Custodian</div>
          <div className="text-[10px]">Prepared by / Date</div>
        </div>
        <div>
          <div className="border-t border-black pt-1 font-bold">Dean of IT</div>
          <div className="text-[10px]">Noted by / Date</div>
        </div>
      </div>
    </div>
  );
};