import {
  addDays,
  addMinutes,
  differenceInCalendarDays,
  differenceInMinutes,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { CountdownParts } from '@/types';

export const uid = (prefix = 'id'): string => {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoObj && 'randomUUID' in cryptoObj) {
    return `${prefix}_${cryptoObj.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
};

export const parse = (iso: string | Date): Date => (iso instanceof Date ? iso : parseISO(iso));

export const toLocalInput = (iso: string): string => {
  const d = parse(iso);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, "yyyy-MM-dd'T'HH:mm");
};

export const fromLocalInput = (value: string): string => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

export const fmtDateLong = (iso: string | Date, pattern = 'EEEE, d MMMM yyyy'): string => {
  const d = parse(iso);
  return Number.isNaN(d.getTime()) ? '—' : format(d, pattern);
};

export const fmtDateShort = (iso: string | Date): string => {
  const d = parse(iso);
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'd MMM');
};

export const fmtDateMedium = (iso: string | Date): string => {
  const d = parse(iso);
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'd MMM yyyy');
};

export const fmtTime = (iso: string | Date): string => {
  const d = parse(iso);
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'h:mm a');
};

export const fmtDateTime = (iso: string | Date): string => `${fmtDateMedium(iso)} · ${fmtTime(iso)}`;

export const fmtWeekday = (iso: string | Date): string => {
  const d = parse(iso);
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'EEE');
};

export const monthLabel = (date: Date): string => format(date, 'MMMM yyyy');

export const daysBetween = (from: Date, to: Date): number =>
  differenceInCalendarDays(startOfDay(to), startOfDay(from));

export const daysUntil = (iso: string, now = new Date()): number => daysBetween(now, parse(iso));

export const startOfDayIso = (iso: string): string => startOfDay(parse(iso)).toISOString();

export const getCountdown = (deadlineIso: string, now = new Date()): CountdownParts => {
  const deadline = parse(deadlineIso);
  const totalMs = deadline.getTime() - now.getTime();
  const clamped = Math.max(0, totalMs);
  const totalSeconds = Math.floor(clamped / 1000);
  return {
    totalMs,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    isPast: totalMs <= 0,
    isToday: isSameDay(deadline, now),
  };
};

export const pad2 = (n: number): string => String(Math.max(0, n)).padStart(2, '0');

export const compactCountdown = (iso: string, now = new Date()): string => {
  const c = getCountdown(iso, now);
  if (c.isPast) return 'Closed';
  if (c.days > 0) return `${c.days}d ${pad2(c.hours)}h`;
  if (c.hours > 0) return `${c.hours}h ${pad2(c.minutes)}m`;
  return `${c.minutes}m ${pad2(c.seconds)}s`;
};

export const relativeDay = (iso: string | Date, now = new Date()): string => {
  const d = parse(iso);
  const diff = daysBetween(now, d);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  if (diff < 7) return `In ${diff} days`;
  return fmtDateShort(d);
};

export const offsetLabel = (offsetDays: number): string => (offsetDays === 0 ? 'T-0' : `T-${offsetDays}`);

export const offsetDayWord = (offsetDays: number): string => {
  if (offsetDays === 0) return 'Deadline day';
  if (offsetDays === 1) return 'The day before';
  return `${offsetDays} days out`;
};

export const monthGrid = (month: Date, weekStartsOn: 0 | 1): Date[] => {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn });
  const days: Date[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
};

export const isInMonth = (day: Date, month: Date): boolean => isSameMonth(day, month);

export const dayKey = (iso: string | Date): string => {
  const d = parse(iso);
  return Number.isNaN(d.getTime()) ? '' : format(d, 'yyyy-MM-dd');
};

export const isTodayIso = (iso: string): boolean => isToday(parse(iso));

export const isOverdue = (iso: string, now = new Date()): boolean => parse(iso).getTime() < now.getTime();

export const minutesFromNow = (iso: string, now = new Date()): number =>
  differenceInMinutes(parse(iso), now);

export const nextOccurrence = (time: string, now = new Date()): Date => {
  const [h, m] = time.split(':').map(Number);
  const candidate = new Date(now);
  candidate.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  if (candidate.getTime() <= now.getTime()) return addDays(candidate, 1);
  return candidate;
};

export const addMinutesIso = (iso: string, minutes: number): string =>
  addMinutes(parse(iso), minutes).toISOString();

export const sameDay = (a: string | Date, b: string | Date): boolean => isSameDay(parse(a), parse(b));

export const greeting = (now = new Date()): string => {
  const h = now.getHours();
  if (h < 5) return 'Still awake';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
};

export const weekdayShort = (date: Date, weekStartsOn: 0 | 1): string[] => {
  const base = startOfWeek(date, { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => format(addDays(base, i), 'EE'));
};
