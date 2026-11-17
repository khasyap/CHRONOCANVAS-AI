import type { Goal, Milestone } from '@/types';
import { fmtDateMedium, parse } from './dates';
import { downloadUrl, slugify } from './utils';

const pad = (value: number): string => String(value).padStart(2, '0');

const toUtcStamp = (date: Date): string =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours(),
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

const escapeIcs = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

const foldLine = (line: string): string => {
  if (line.length <= 74) return line;
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length > 0) {
    chunks.push(` ${rest.slice(0, 73)}`);
    rest = rest.slice(73);
  }
  return chunks.join('\r\n');
};

const eventFor = (goal: Goal, milestone: Milestone): string[] => {
  const start = parse(milestone.date);
  const end = new Date(start.getTime() + milestone.duration * 60_000);
  const description = `${milestone.description}\n\nGoal: ${goal.name}\nPriority: ${milestone.priority}\nCountdown: T-${milestone.offsetDays}\n\nPlanned with ChronoCanvas AI.`;
  return [
    'BEGIN:VEVENT',
    `UID:${milestone.id}@chronocanvas.ai`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    foldLine(`SUMMARY:${escapeIcs(`${goal.name} · ${milestone.title}`)}`),
    foldLine(`DESCRIPTION:${escapeIcs(description)}`),
    foldLine(`CATEGORIES:${escapeIcs(goal.name)}`),
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    foldLine(`DESCRIPTION:${escapeIcs(milestone.title)}`),
    'END:VALARM',
    'END:VEVENT',
  ];
};

export const buildGoalIcs = (goal: Goal, milestones: Milestone[]): string => {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ChronoCanvas AI//Deadline Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeIcs(goal.name)} — ChronoCanvas`),
  ];
  milestones
    .filter((m) => m.goalId === goal.id)
    .forEach((m) => lines.push(...eventFor(goal, m)));
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};

export const buildAllIcs = (goals: Goal[], milestones: Milestone[]): string => {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ChronoCanvas AI//Deadline Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:ChronoCanvas AI — All deadlines',
  ];
  goals
    .filter((g) => !g.archived)
    .forEach((goal) => {
      milestones
        .filter((m) => m.goalId === goal.id)
        .forEach((m) => lines.push(...eventFor(goal, m)));
    });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};

export const downloadGoalCalendar = (goal: Goal, milestones: Milestone[]): void => {
  const content = buildGoalIcs(goal, milestones);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  downloadUrl(url, `${slugify(goal.name)}-chronocanvas.ics`);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

export const downloadAllCalendars = (goals: Goal[], milestones: Milestone[]): void => {
  const content = buildAllIcs(goals, milestones);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  downloadUrl(url, 'chronocanvas-all-deadlines.ics');
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

export const googleCalendarUrl = (goal: Goal, milestone: Milestone): string => {
  const start = parse(milestone.date);
  const end = new Date(start.getTime() + Math.max(30, milestone.duration) * 60_000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${goal.name} · ${milestone.title}`,
    dates: `${toUtcStamp(start)}/${toUtcStamp(end)}`,
    details: `${milestone.description}\n\nGoal deadline: ${fmtDateMedium(goal.deadline)}\nPlanned with ChronoCanvas AI.`,
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const outlookCalendarUrl = (goal: Goal, milestone: Milestone): string => {
  const start = parse(milestone.date);
  const end = new Date(start.getTime() + Math.max(30, milestone.duration) * 60_000);
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: `${goal.name} · ${milestone.title}`,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: milestone.description,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};
