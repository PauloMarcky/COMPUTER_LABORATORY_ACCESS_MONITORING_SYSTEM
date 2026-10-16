import React, { useState } from 'react';
import { BookOpen, CheckCircle2, ChevronDown, Clock, Download, Monitor, Search, User, Users } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { ClamsHeader } from '../../components/ClamsHeader';
import { LabStaffSubNav } from '../../components/CustodianComponents/LabStaffSubNav';
import type { LabRoomStatus, LabUsageRecord, WireframeScreenId } from '../../types';

interface LabStaffRecordsProps {
  records: LabUsageRecord[];
  onNavigate: (screen: WireframeScreenId) => void;
  onLogout: () => void;
}

export const LabStaffRecordsView: React.FC<LabStaffRecordsProps> = ({ records, onNavigate, onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [labFilter, setLabFilter] = useState('All Laboratories');
  const [ayFilter, setAyFilter] = useState('');
  const [semFilter, setSemFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  const filteredRecords = records.filter((rec) => {
    const matchesSearch =
      !searchQuery.trim() ||
      rec.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.instructor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.section.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.laboratory.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLab = labFilter === 'All Laboratories' || rec.laboratory === labFilter;
    const matchesAy = !ayFilter || rec.academicYear === ayFilter;
    const matchesSem = !semFilter || rec.semester === semFilter;
    return matchesSearch && matchesLab && matchesAy && matchesSem;
  });

  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const displayedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const savePdf = (record: LabUsageRecord, mode: 'room-usage' | 'attendance-sheet') => {
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

    const details = [
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

      const drawTableHeader = () => {
        doc.setFillColor(27, 50, 95);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, currentY, contentWidth, 24, 'F');
        let x = margin;
        headers.forEach((header, index) => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(header, x + 4, currentY + 15);
          x += columnWidths[index];
        });
        currentY += 24;
        doc.setTextColor(20, 20, 20);
      };

      drawTableHeader();
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
        const lines = values.map((value, valueIndex) =>
          doc.splitTextToSize(value, columnWidths[valueIndex] - 8)
        );
        const rowHeight = Math.max(22, ...lines.map((cellLines) => cellLines.length * 10 + 8));

        if (currentY + rowHeight > pageHeight - margin) {
          doc.addPage();
          currentY = margin;
          drawTableHeader();
        }

        doc.setFillColor(index % 2 === 0 ? 245 : 255, index % 2 === 0 ? 247 : 255, index % 2 === 0 ? 250 : 255);
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

    const filenamePart = (value: string) =>
      value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'class';
    doc.save(`clams-${mode}-${filenamePart(record.subject)}-${filenamePart(record.section)}-${filenamePart(record.date)}.pdf`);
  };

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#eef1f7]">
      <ClamsHeader onNavigate={onNavigate} statusLabel="Computer Laboratory System" showLogout={false} />

      <div className="clams-layout">
        <LabStaffSubNav activeScreen="lab-staff-records-module" onNavigate={onNavigate} onLogout={onLogout} />

        <main className="space-y-6">
          <div className="rounded-2xl border border-[#1b325f]/15 bg-gradient-to-r from-[#1b325f]/[0.04] to-transparent px-6 py-5 shadow-sm">
            <h1 className="text-2xl font-bold text-[#1b325f]">Laboratory Records</h1>
            <p className="mt-1 text-sm text-slate-500">
              All completed class sessions with attendance and export options.
            </p>
          </div>

          {/* Filters */}
          <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#1b325f]/10 bg-white p-4 shadow-sm">
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search by class, room, or instructor..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#1b325f] focus:bg-white"
              />
            </div>

            <select
              value={labFilter}
              onChange={(e) => { setLabFilter(e.target.value); setCurrentPage(1); }}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-[#1b325f]"
            >
              <option value="All Laboratories">All Laboratories</option>
              {[...new Set(records.map((record) => record.laboratory))].map((laboratory) => (
                <option key={laboratory} value={laboratory}>{laboratory}</option>
              ))}
            </select>

            <select
              value={ayFilter}
              onChange={(e) => setAyFilter(e.target.value)}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-[#1b325f]"
            >
              <option value="">All Academic Years</option>
              {[...new Set(records.map((record) => record.academicYear))].map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            <select
              value={semFilter}
              onChange={(e) => setSemFilter(e.target.value)}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-[#1b325f]"
            >
              <option value="">All Semesters</option>
              {[...new Set(records.map((record) => record.semester))].map((semester) => (
                <option key={semester} value={semester}>{semester}</option>
              ))}
            </select>
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
                        No completed class usage records.
                      </td>
                    </tr>
                  )}
                  {displayedRecords.map((rec) => (
                    <React.Fragment key={rec.id}>
                      <tr className="transition-colors hover:bg-[#1b325f]/[0.02]">
                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-700">{rec.date}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            aria-expanded={expandedRecordId === rec.id}
                            onClick={() => setExpandedRecordId((c) => c === rec.id ? null : rec.id)}
                            className="flex cursor-pointer items-center gap-2 text-left"
                          >
                            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expandedRecordId === rec.id ? 'rotate-180' : ''}`} />
                            <span>
                              <span className="block font-bold text-[#1b325f]">{rec.subject}</span>
                              <span className="block text-xs font-medium text-slate-500">{rec.subjectName} · Section {rec.section} · Year {rec.yearLevel}</span>
                            </span>
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-800">{rec.laboratory}</td>
                        <td className="whitespace-nowrap px-4 py-4 font-mono text-xs tabular-nums text-slate-500">{rec.timeslot}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-600">{rec.instructor}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-600">{rec.studentsPresent} / {rec.studentsTotal} present</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => savePdf(rec, 'room-usage')}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#1b325f]/20 bg-white px-3 py-2 text-xs font-semibold text-[#1b325f] transition-colors hover:bg-[#1b325f]/5"
                            >
                              <Download className="h-3.5 w-3.5" /> Room PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => savePdf(rec, 'attendance-sheet')}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#2563eb] px-3 py-2 text-xs font-semibold text-white shadow-md shadow-amber-600/30 transition-all hover:bg-blue-700"
                            >
                              <Download className="h-3.5 w-3.5" /> Attendance PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedRecordId === rec.id && (
                        <tr>
                          <td colSpan={7} className="bg-[#1b325f]/[0.03] px-6 py-4">
                            {rec.students.length === 0 ? (
                              <p className="py-3 text-center text-sm text-slate-500">No student attendance recorded.</p>
                            ) : (
                              <div className="overflow-hidden rounded-lg border border-[#1b325f]/10 bg-white">
                                <table className="w-full text-left text-sm">
                                  <thead className="bg-[#1b325f]/[0.06] text-xs font-bold uppercase tracking-wider text-[#1b325f]">
                                    <tr>
                                      <th className="px-4 py-3 text-left">Student</th>
                                      <th className="px-4 py-3 text-left">School ID</th>
                                      <th className="px-4 py-3 text-left">Time In</th>
                                      <th className="px-4 py-3 text-left">Time Out</th>
                                      <th className="px-4 py-3 text-left">PC</th>
                                      <th className="px-4 py-3 text-left">Attendance</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {rec.students.map((student) => (
                                      <tr key={student.id} className="transition-colors hover:bg-[#1b325f]/[0.02]">
                                        <td className="px-4 py-3 font-semibold text-slate-800">{student.name}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{student.studentId}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{student.timeIn}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{student.timeOut || 'Not recorded'}</td>
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
              <span>Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-1.5 font-mono tabular-nums">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="cursor-pointer rounded border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-white"
                >
                  &larr; Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`h-8 w-8 cursor-pointer rounded text-xs font-semibold transition-colors ${currentPage === page
                        ? 'bg-[#1b325f] text-white'
                        : 'border border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="cursor-pointer rounded border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-white"
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

/* ===========================
 * Rooms view
 * =========================== */

interface LabStaffRoomsProps {
  rooms: LabRoomStatus[];
  onNavigate: (screen: WireframeScreenId) => void;
  onLogout: () => void;
}

export const LabStaffRoomsView: React.FC<LabStaffRoomsProps> = ({ rooms, onNavigate, onLogout }) => {
  const [statusFilter, setStatusFilter] = useState<'IN USE' | 'ALL'>('IN USE');

  const inUseRooms = rooms.filter((r) => r.status === 'IN USE');
  const availableRooms = rooms.filter((r) => r.status === 'AVAILABLE');

  const visibleRooms = statusFilter === 'IN USE' ? inUseRooms : rooms;

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#eef1f7]">
      <ClamsHeader onNavigate={onNavigate} statusLabel="Computer Laboratory System" showLogout={false} />

      <div className="clams-layout">
        <LabStaffSubNav activeScreen="lab-staff-rooms-module" onNavigate={onNavigate} onLogout={onLogout} />

        <main className="space-y-6">
          <div className="rounded-2xl border border-[#1b325f]/15 bg-gradient-to-r from-[#1b325f]/[0.04] to-transparent px-6 py-5 shadow-sm">
            <h1 className="text-2xl font-bold text-[#1b325f]">Lab Room Usage</h1>
            <p className="mt-1 text-sm text-slate-500">
              Live status of every laboratory room.
            </p>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setStatusFilter('IN USE')}
              className="flex cursor-pointer items-center gap-4 rounded-2xl border border-[#1b325f]/10 bg-white p-5 text-left shadow-sm transition-all hover:border-emerald-300 hover:shadow-md"
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

          {/* Room grid */}
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
                          <span>{room.instructor} · <strong className="text-slate-800">{room.section}</strong></span>
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
                    <span className="font-mono tabular-nums text-slate-400">
                      {room.totalPcs} Available PCs
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-bold font-mono tabular-nums text-slate-800">
                      <Users className="h-4 w-4 text-slate-500" />
                      <span>{room.occupiedPcs}/{room.totalPcs} Pupils</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};