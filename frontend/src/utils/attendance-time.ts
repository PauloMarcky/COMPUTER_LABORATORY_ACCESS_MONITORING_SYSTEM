import type { AttendanceEntry } from '../types';

const SCHOOL_TIME_ZONE = import.meta.env.VITE_SCHOOL_TIME_ZONE || 'Asia/Manila';

export function formatSchoolDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function timeToMinutes(time: string): number | null {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return hour * 60 + Number(match[2]);
}

export function getAttendanceStatus(
  now: Date,
  classStartTime: string,
  classEndTime: string,
): AttendanceEntry['status'] {
  const start = timeToMinutes(classStartTime);
  const end = timeToMinutes(classEndTime);
  if (start === null || end === null || end <= start) return 'On-Time';

  const lateAfter = start + (end - start) * 0.25;
  const currentTime = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  return currentTime >= lateAfter ? 'Late' : 'On-Time';
}

// "PC-1 → PC-2" when a student changed PCs, otherwise the single PC (or "None").
export function formatPcChain(
  entry: Pick<AttendanceEntry, 'pcNumber' | 'pcHistory'>,
  separator = ' → ',
): string {
  const history = entry.pcHistory ?? [];
  return history.length > 1 ? history.map((h) => h.pcNumber).join(separator) : entry.pcNumber;
}

// One line per PC with claim/release times, for tooltips and wide export columns.
export function formatPcTimeline(entry: Pick<AttendanceEntry, 'pcNumber' | 'pcHistory'>): string[] {
  const history = entry.pcHistory ?? [];
  if (history.length === 0) return [entry.pcNumber];
  return history.map((h) => `${h.pcNumber} (${h.claimedAt}${h.releasedAt ? ` – ${h.releasedAt}` : ' – in use'})`);
}

export function formatAttendanceTime(time: Date): string {
  return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}
