import { ArrowLeft, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { AttendanceEntry, ScheduleEntry, WireframeScreenId } from '../../types';

interface InstructorAttendanceExportViewProps {
  schedule?: ScheduleEntry | null;
  attendance: AttendanceEntry[];
  onNavigate: (screen: WireframeScreenId) => void;
  onBackToSchedule: () => void;
}

export const InstructorAttendanceExportView = ({
  attendance,
  onNavigate,
  onBackToSchedule,
  schedule = null,
}: InstructorAttendanceExportViewProps) => {
  const handlePrint = () => {
    document.title = 'Attendance Log - Print';
    window.print();
  };

  const handleSaveAsPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;
    const right = pageWidth - margin;
    const centerX = pageWidth / 2;
    const navy = [27, 50, 95];
    const ink = [15, 23, 42];
    const muted = [100, 116, 139];
    const gridColor = [203, 213, 225];

    // ---- Header (matches the print view) ----
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('UNIVERSITY OF LA SALETTE, INC.', centerX, 52, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text('Santiago City, Isabela', centerX, 68, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text('COLLEGE OF INFORMATION TECHNOLOGY — COMPUTER LAB ATTENDANCE LOG', centerX, 92, { align: 'center' });

    doc.setDrawColor(ink[0], ink[1], ink[2]);
    doc.setLineWidth(1.2);
    doc.line(margin, 104, right, 104);

    // ---- Details: left block and right-aligned block ----
    const labelValue = (label: string, value: string, y: number, side: 'left' | 'right') => {
      const labelText = `${label}: `;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const labelWidth = doc.getTextWidth(labelText);
      doc.setFont('helvetica', 'normal');
      const valueWidth = doc.getTextWidth(value);
      const startX = side === 'left' ? margin : right - labelWidth - valueWidth;
      doc.setFont('helvetica', 'bold');
      doc.text(labelText, startX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, startX + labelWidth, y);
    };

    doc.setTextColor(ink[0], ink[1], ink[2]);
    labelValue('Subject Code', schedule?.subject ?? '—', 126, 'left');
    labelValue('Laboratory Room', schedule?.room ?? '—', 142, 'left');
    labelValue('Instructor Name', schedule?.teacher ?? '—', 158, 'left');
    labelValue('Date', new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }), 126, 'right');
    labelValue('Scheduled Time', schedule ? `${schedule.day} ${schedule.startTime}–${schedule.endTime}` : '—', 142, 'right');

    // ---- Table ----
    const colWidths = [34, 100, 215, 95, 180, 88];
    const headers = ['#', 'Student ID', 'Full Name', 'Time In', 'PC #', 'Status'];
    const drawTableHeader = (y: number) => {
      doc.setFillColor(navy[0], navy[1], navy[2]);
      doc.rect(margin, y, contentWidth, 24, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(255, 255, 255);
      let headerX = margin;
      headers.forEach((header, index) => {
        doc.text(header, headerX + 8, y + 15);
        headerX += colWidths[index];
      });
      return y + 24;
    };

    const tableRows = attendance.length
      ? attendance.map((row, index) => ({
        num: String(index + 1),
        studentId: row.studentId,
        name: row.formalName,
        timeIn: row.timeIn,
        pcEntries: row.pcHistory && row.pcHistory.length > 0
          ? row.pcHistory.map((h) => ({ pc: h.pcNumber, times: `(${h.claimedAt}${h.releasedAt ? ` – ${h.releasedAt}` : ''})` }))
          : [{ pc: row.pcNumber, times: '' }],
        status: row.status,
      }))
      : [{ num: '', studentId: '—', name: 'No attendance records', timeIn: '—', pcEntries: [{ pc: '—', times: '' }], status: '—' }];

    const lineHeight = 11;
    let y = drawTableHeader(176);

    tableRows.forEach((row) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const nameLines = doc.splitTextToSize(row.name, colWidths[2] - 16) as string[];
      const rowHeight = Math.max(26, Math.max(nameLines.length, row.pcEntries.length) * lineHeight + 14);

      if (y + rowHeight > pageHeight - margin) {
        doc.addPage();
        y = drawTableHeader(margin);
      }

      // grid lines
      doc.setDrawColor(gridColor[0], gridColor[1], gridColor[2]);
      doc.setLineWidth(0.6);
      doc.line(margin, y + rowHeight, right, y + rowHeight);
      let lineX = margin;
      doc.line(lineX, y, lineX, y + rowHeight);
      colWidths.forEach((width) => {
        lineX += width;
        doc.line(lineX, y, lineX, y + rowHeight);
      });

      const baseline = y + 16;
      let cellX = margin;

      doc.setFont('courier', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text(row.num, cellX + 8, baseline);
      cellX += colWidths[0];

      doc.text(String(row.studentId), cellX + 8, baseline);
      cellX += colWidths[1];

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(nameLines, cellX + 8, baseline);
      cellX += colWidths[2];

      doc.setFont('courier', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(String(row.timeIn), cellX + 8, baseline);
      cellX += colWidths[3];

      row.pcEntries.forEach((entry, entryIndex) => {
        const entryY = baseline + entryIndex * lineHeight;
        doc.setFont('courier', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.text(String(entry.pc), cellX + 8, entryY);
        if (entry.times) {
          const pcWidth = doc.getTextWidth(String(entry.pc));
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(muted[0], muted[1], muted[2]);
          doc.text(entry.times, cellX + 8 + pcWidth + 4, entryY);
        }
      });
      cellX += colWidths[4];

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(String(row.status), cellX + 8, baseline);

      y += rowHeight;
    });

    // ---- Signatures ----
    y += 64;
    if (y + 60 > pageHeight - margin) {
      doc.addPage();
      y = margin + 40;
    }
    const lineLength = 150;
    const signatures = [
      { x: margin + contentWidth * 0.25, name: schedule?.teacher ?? '—', caption: 'Class Instructor Signature & Date' },
      { x: margin + contentWidth * 0.75, name: 'Dean of IT', caption: 'Department Dean / Verifier (If Required)' },
    ];
    signatures.forEach((signature) => {
      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.8);
      doc.line(signature.x - lineLength / 2, y, signature.x + lineLength / 2, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(signature.name, signature.x, y + 15, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text(signature.caption, signature.x, y + 27, { align: 'center' });
    });

    doc.save('clams-attendance-log.pdf');
  };

  return (
    <div className="min-h-[calc(100vh-44px)] bg-white py-8 px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 no-print">
        <button
          type="button"
          onClick={() => {
            onBackToSchedule();
          }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-[#1b325f] cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6" />
          <span className="text-sm md:text-base">Back to Schedule</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[#1b325f] hover:bg-[#142547] text-white text-sm font-semibold cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAsPdf}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Save as PDF</span>
          </button>
        </div>
      </div>

      <div className="bg-white px-4 sm:px-6 py-6">
        <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
          <h1 className="text-lg font-bold tracking-wide text-slate-900 uppercase">
            UNIVERSITY OF LA SALETTE, INC.
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Santiago City, Isabela</p>
          <p className="text-sm font-bold tracking-wider text-slate-800 uppercase mt-3">
            COLLEGE OF INFORMATION TECHNOLOGY — COMPUTER LAB ATTENDANCE LOG
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-800 mb-5">
          <div className="space-y-1">
            <div><span className="font-bold">Subject Code:</span> {schedule?.subject ?? '—'}</div>
            <div><span className="font-bold">Laboratory Room:</span> {schedule?.room ?? '—'}</div>
            <div><span className="font-bold">Instructor Name:</span> {schedule?.teacher ?? '—'}</div>
          </div>
          <div className="space-y-1 sm:text-right">
            <div><span className="font-bold">Date:</span> {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div><span className="font-bold">Scheduled Time:</span> {schedule ? `${schedule.day} ${schedule.startTime}–${schedule.endTime}` : '—'}</div>
            
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-300">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#1b325f] text-white font-semibold">
                <th className="py-2.5 px-3 border-r border-slate-600/40 w-10">#</th>
                <th className="py-2.5 px-3 border-r border-slate-600/40">Student ID</th>
                <th className="py-2.5 px-3 border-r border-slate-600/40">Full Name</th>
                <th className="py-2.5 px-3 border-r border-slate-600/40">Time In</th>
                <th className="py-2.5 px-3 border-r border-slate-600/40">PC #</th>
                <th className="py-2.5 px-3 border-r border-slate-600/40">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {attendance.map((row, index) => (
                <tr key={row.id} className="bg-white">
                  <td className="py-2.5 px-3 border-r border-slate-300 font-mono tabular-nums text-slate-600">
                    {index + 1}
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-300 font-mono tabular-nums text-slate-600">
                    {row.studentId}
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-300 font-bold text-slate-900">
                    {row.formalName}
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-300 font-mono tabular-nums text-slate-700">
                    {row.timeIn}
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-300 font-mono tabular-nums text-slate-700">
                    {row.pcHistory && row.pcHistory.length > 0
                      ? row.pcHistory.map((h, i) => (
                        <div key={i}>
                          {h.pcNumber}{' '}
                          <span className="text-xs text-slate-500">
                            ({h.claimedAt}{h.releasedAt ? ` – ${h.releasedAt}` : ''})
                          </span>
                        </div>
                      ))
                      : row.pcNumber}
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-300 font-semibold text-slate-800">
                    {row.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 mt-16 pt-4 text-center text-sm">
          <div className="max-w-xs mx-auto w-full">
            <div className="border-t border-slate-700 pt-2 font-bold text-slate-900">{schedule?.teacher ?? '—'}</div>
            <div className="text-xs text-slate-500 mt-0.5">Class Instructor Signature &amp; Date</div>
          </div>
          <div className="max-w-xs mx-auto w-full">
            <div className="border-t border-slate-700 pt-2 font-bold text-slate-900">Dean of IT</div>
            <div className="text-xs text-slate-500 mt-0.5">Department Dean / Verifier (If Required)</div>
          </div>
        </div>
      </div>
    </div>
  );
};