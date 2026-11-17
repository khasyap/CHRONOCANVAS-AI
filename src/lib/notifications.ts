import { differenceInCalendarDays, format } from 'date-fns';
import type { Goal, LogKind, Milestone, NotificationSettings } from '@/types';
import { daysUntil, fmtDateShort, fmtTime, isOverdue, parse, relativeDay } from './dates';
import { isWithinQuietHours, timeToMinutes } from './utils';

export interface ReminderCandidate {
  key: string;
  kind: LogKind;
  title: string;
  body: string;
  goalId?: string;
}

export const notificationsSupported = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window;

export const notificationPermission = (): NotificationPermission | 'unsupported' =>
  notificationsSupported() ? Notification.permission : 'unsupported';

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!notificationsSupported()) return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
};

export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
};

export const showBrowserNotification = async (
  title: string,
  body: string,
  tag?: string,
): Promise<boolean> => {
  if (notificationPermission() !== 'granted') return false;
  const options: NotificationOptions = {
    body,
    tag,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    silent: false,
  };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return true;
    }
    new Notification(title, options);
    return true;
  } catch {
    try {
      new Notification(title, options);
      return true;
    } catch {
      return false;
    }
  }
};

const minutesOfDay = (date: Date): number => date.getHours() * 60 + date.getMinutes();

const dailySlotOffsets = (frequency: NotificationSettings['frequency']): number[] => {
  if (frequency === 'balanced') return [0, 8 * 60];
  if (frequency === 'persistent') return [0, 3 * 60, 6 * 60, 9 * 60];
  return [0];
};

const digestBody = (goals: Goal[], milestones: Milestone[], now: Date): string => {
  const activeIds = new Set(goals.filter((g) => !g.archived).map((g) => g.id));
  const dueSoon = milestones
    .filter((m) => !m.done && activeIds.has(m.goalId))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 2);

  if (dueSoon.length === 0) {
    return 'Nothing pending on the plan today. A clear horizon is still progress — enjoy it.';
  }
  return dueSoon
    .map((m) => {
      const goal = goals.find((g) => g.id === m.goalId);
      return `${m.title}${goal ? ` · ${goal.name}` : ''} · ${isOverdue(m.date, now) ? 'overdue' : relativeDay(m.date, now)}`;
    })
    .join('\n');
};

export const collectReminders = (
  goals: Goal[],
  milestones: Milestone[],
  settings: NotificationSettings,
  now = new Date(),
): ReminderCandidate[] => {
  if (!settings.enabled || settings.paused) return [];
  if (isWithinQuietHours(now, settings.quietStart, settings.quietEnd)) return [];

  const candidates: ReminderCandidate[] = [];
  const activeGoals = goals.filter((g) => !g.archived);
  const activeIds = new Set(activeGoals.map((g) => g.id));
  const todayKey = format(now, 'yyyy-MM-dd');
  const nowMinutes = minutesOfDay(now);

  if (settings.daily) {
    const base = timeToMinutes(settings.dailyTime);
    dailySlotOffsets(settings.frequency).forEach((offset, index) => {
      const slot = (base + offset) % (24 * 60);
      const withinSlot = nowMinutes >= slot && nowMinutes < slot + 30;
      if (!withinSlot) return;
      candidates.push({
        key: `daily:${todayKey}:${index}`,
        kind: 'daily',
        title: 'Your ChronoCanvas briefing',
        body: digestBody(activeGoals, milestones, now),
      });
    });
  }

  milestones
    .filter((m) => !m.done && activeIds.has(m.goalId))
    .forEach((milestone) => {
      const goal = goals.find((g) => g.id === milestone.goalId);
      if (!goal) return;
      const due = parse(milestone.date);
      const leadMs = Math.max(0, milestone.reminderLead) * 60_000;
      const windowStart = due.getTime() - leadMs;
      const windowEnd = due.getTime() + 60 * 60_000;

      if (
        settings.milestoneReminders &&
        milestone.reminderEnabled &&
        now.getTime() >= windowStart &&
        now.getTime() <= windowEnd
      ) {
        candidates.push({
          key: `ms:${milestone.id}:${milestone.date}:${milestone.reminderLead}`,
          kind: 'milestone',
          title: `${milestone.title}`,
          body: `${goal.name} · ${milestone.offsetDays === 0 ? 'Deadline day' : `T-${milestone.offsetDays}`} · due ${fmtTime(
            due,
          )}. ${milestone.duration} min planned.`,
          goalId: goal.id,
        });
      }

      const overdueDays = differenceInCalendarDays(now, due);
      if (
        settings.overdue &&
        isOverdue(milestone.date, now) &&
        overdueDays >= 0 &&
        overdueDays <= 14
      ) {
        candidates.push({
          key: `od:${milestone.id}:${todayKey}`,
          kind: 'overdue',
          title: `Still open: ${milestone.title}`,
          body: `${goal.name} · due ${fmtDateShort(milestone.date)}. Open the planner to reschedule without moving the deadline.`,
          goalId: goal.id,
        });
      }
    });

  if (settings.deadlineAlerts) {
    activeGoals.forEach((goal) => {
      const days = daysUntil(goal.deadline, now);
      if (days > 1 || days < 0) return;
      if (nowMinutes < 8 * 60) return;
      candidates.push({
        key: `dl:${goal.id}:${days}`,
        kind: 'deadline',
        title: days === 0 ? `Today is the day: ${goal.name}` : `Tomorrow: ${goal.name}`,
        body:
          days === 0
            ? 'The countdown has reached zero. Take a breath, review the final checklist, and finish well.'
            : 'Final day before the deadline. Keep only the essential moves and protect your sleep.',
        goalId: goal.id,
      });
    });
  }

  return candidates;
};

export const testNotification = async (): Promise<boolean> => {
  const ok = await showBrowserNotification(
    'ChronoCanvas AI is listening',
    'This is how your deadline briefings will appear. You can change the rhythm in Notifications.',
    'chronocanvas-test',
  );
  return ok;
};
