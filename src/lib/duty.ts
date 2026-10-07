// Shift times, and how planned shifts compare with when people actually clocked in.

import { addDays, differenceInMinutes, format, parseISO, startOfWeek } from 'date-fns';
import type { AttendanceEntry, ShiftType, StaffShift } from '@/types/duty';

export const SHIFT_TYPES: ShiftType[] = ['Morning', 'Evening', 'Night', 'Day', 'On Call', 'Custom'];

// Usual times for each shift type; they can be changed per shift.
export const SHIFT_PRESETS: Record<ShiftType, { start: string; end: string }> = {
  Morning: { start: '07:00', end: '15:00' },
  Evening: { start: '15:00', end: '23:00' },
  Night: { start: '23:00', end: '07:00' },
  Day: { start: '09:00', end: '17:00' },
  'On Call': { start: '08:00', end: '08:00' },
  Custom: { start: '09:00', end: '13:00' },
};

export const SHIFT_COLORS: Record<ShiftType, string> = {
  Morning: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800',
  Evening: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-100 dark:border-orange-800',
  Night: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-100 dark:border-indigo-800',
  Day: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-800',
  'On Call': 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-100 dark:border-rose-800',
  Custom: 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600',
};

// Minutes of leeway before someone counts as late or as leaving early.
export const GRACE_MINUTES = 10;

export const dateKey = (date: Date) => format(date, 'yyyy-MM-dd');
export const weekStartOf = (date: Date) => startOfWeek(date, { weekStartsOn: 1 });

// Start and end of a shift as local Date objects. An end time not after the start
// means the shift ends the next day (equal times = 24 hours).
export function shiftWindow(shift: Pick<StaffShift, 'shiftDate' | 'startTime' | 'endTime'>): { start: Date; end: Date } {
  const start = parseISO(`${shift.shiftDate}T${shift.startTime}`);
  let end = parseISO(`${shift.shiftDate}T${shift.endTime}`);
  if (end <= start) end = addDays(end, 1);
  return { start, end };
}

export const shiftHours = (shift: Pick<StaffShift, 'shiftDate' | 'startTime' | 'endTime'>) => {
  const { start, end } = shiftWindow(shift);
  return differenceInMinutes(end, start) / 60;
};

export const overlaps = (a: { start: Date; end: Date }, b: { start: Date; end: Date }) => a.start < b.end && b.start < a.end;

export function entryWindow(entry: AttendanceEntry, now = new Date()): { start: Date; end: Date } {
  return { start: new Date(entry.clockIn), end: entry.clockOut ? new Date(entry.clockOut) : now };
}

export const formatHours = (hours: number) => {
  const minutes = Math.round(hours * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h${m ? ` ${String(m).padStart(2, '0')}m` : ''}`;
};

// 25 -> "25m", 130 -> "2h 10m".
export const formatMinutes = (minutes: number) => (minutes < 60 ? `${minutes}m` : formatHours(minutes / 60));

// A clock-in belongs to a shift when it covers a real part of it: 30 minutes, or half the
// clock-in if that is shorter. A night shift that runs a few minutes into the next
// morning shift doesn't count towards it.
export function coversShift(shift: { start: Date; end: Date }, entry: { start: Date; end: Date }) {
  if (!overlaps(shift, entry)) return false;
  const overlapMinutes = differenceInMinutes(
    new Date(Math.min(shift.end.getTime(), entry.end.getTime())),
    new Date(Math.max(shift.start.getTime(), entry.start.getTime())),
  );
  return overlapMinutes >= Math.min(30, differenceInMinutes(entry.end, entry.start) / 2);
}

export type ShiftStatusTone = 'ok' | 'warn' | 'bad' | 'neutral' | 'live';

// How a planned shift went, judged against that person's attendance entries.
export function shiftStatus(shift: StaffShift, entries: AttendanceEntry[], now = new Date()): { label: string; tone: ShiftStatusTone; matched: AttendanceEntry[] } {
  const window = shiftWindow(shift);
  const matched = entries
    .filter(e => e.staffId === shift.staffId && coversShift(window, entryWindow(e, now)))
    .sort((a, b) => a.clockIn.localeCompare(b.clockIn));

  if (matched.length === 0) {
    if (window.start > now) return { label: 'Upcoming', tone: 'neutral', matched };
    if (window.end <= now) return { label: 'Absent', tone: 'bad', matched };
    const late = differenceInMinutes(now, window.start);
    return { label: late > GRACE_MINUTES ? `Not clocked in (${formatMinutes(late)})` : 'Starting', tone: late > GRACE_MINUTES ? 'bad' : 'neutral', matched };
  }

  const notes: string[] = [];
  let tone: ShiftStatusTone = 'ok';
  const lateBy = differenceInMinutes(new Date(matched[0].clockIn), window.start);
  if (lateBy > GRACE_MINUTES) { notes.push(`Late ${formatMinutes(lateBy)}`); tone = 'warn'; }
  const last = matched[matched.length - 1];
  if (!last.clockOut) {
    return { label: notes.length ? `${notes.join(', ')} · on duty` : 'On duty', tone: notes.length ? 'warn' : 'live', matched };
  }
  const earlyBy = differenceInMinutes(window.end, new Date(last.clockOut));
  if (earlyBy > GRACE_MINUTES) { notes.push(`Left ${formatMinutes(earlyBy)} early`); tone = 'warn'; }
  return { label: notes.length ? notes.join(', ') : 'On time', tone, matched };
}
