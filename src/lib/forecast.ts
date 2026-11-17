import { addDays, differenceInCalendarDays } from 'date-fns';
import type { Goal, Milestone } from '@/types';
import { daysUntil, fmtDateShort, parse } from './dates';
import { fmtDuration } from './utils';

export type ForecastStatus =
  | 'complete'
  | 'ahead'
  | 'on-track'
  | 'tight'
  | 'at-risk'
  | 'overdue'
  | 'empty';

export interface ForecastMeta {
  label: string;
  color: string;
  bg: string;
}

export const FORECAST_META: Record<ForecastStatus, ForecastMeta> = {
  complete: {
    label: 'Ready early',
    color: 'var(--success)',
    bg: 'rgba(143,211,168,0.12)',
  },
  ahead: {
    label: 'Ahead',
    color: 'var(--success)',
    bg: 'rgba(143,211,168,0.12)',
  },
  'on-track': {
    label: 'On track',
    color: 'var(--accent)',
    bg: 'rgba(217,182,120,0.12)',
  },
  tight: {
    label: 'Tight',
    color: 'var(--warning)',
    bg: 'rgba(232,194,123,0.12)',
  },
  'at-risk': {
    label: 'At risk',
    color: 'var(--danger)',
    bg: 'rgba(232,154,139,0.12)',
  },
  overdue: {
    label: 'Past due',
    color: 'var(--danger)',
    bg: 'rgba(232,154,139,0.12)',
  },
  empty: {
    label: 'No plan',
    color: 'var(--faint)',
    bg: 'var(--surface)',
  },
};

export interface MomentumForecast {
  status: ForecastStatus;
  label: string;
  total: number;
  done: number;
  remaining: number;
  workloadMinutes: number;
  availableMinutes: number;
  capacityRatio: number;
  recommendedDailyMinutes: number;
  completedLast14: number;
  velocityPerWeek: number;
  requiredPerWeek: number;
  projectedFinish: string | null;
  projectedLateDays: number | null;
  summary: string;
  capacityNote: string;
  paceNote: string;
  projectionNote: string;
}

/**
 * A transparent, local-only projection. It contrasts the work left with the
 * preparation time the user actually has, then uses recent completion pace to
 * estimate a finish date. No AI call and no invented productivity score.
 */
export const forecastFor = (
  goal: Goal,
  milestones: Milestone[],
  now = new Date(),
): MomentumForecast => {
  const own = milestones.filter((milestone) => milestone.goalId === goal.id);
  const total = own.length;
  const done = own.filter((milestone) => milestone.done).length;
  const remaining = total - done;
  const open = own.filter((milestone) => !milestone.done);
  const workloadMinutes = open.reduce((sum, milestone) => sum + Math.max(0, milestone.duration), 0);
  const daysLeft = daysUntil(goal.deadline, now);
  const isPast = parse(goal.deadline).getTime() <= now.getTime();
  const availableDays = Math.max(1, daysLeft);
  const availableMinutes = availableDays * Math.max(0, goal.prepMinutes);
  const capacityRatio =
    availableMinutes > 0
      ? workloadMinutes / availableMinutes
      : workloadMinutes > 0
        ? Number.POSITIVE_INFINITY
        : 0;
  const recommendedDailyMinutes = remaining > 0 ? Math.ceil(workloadMinutes / availableDays) : 0;

  const cutoff = now.getTime() - 14 * 86400_000;
  const completedLast14 = own.filter(
    (milestone) =>
      milestone.done &&
      milestone.completedAt &&
      parse(milestone.completedAt).getTime() >= cutoff,
  ).length;
  const velocityPerWeek = completedLast14 / 2;
  const requiredPerWeek = remaining / Math.max(0.5, availableDays / 7);
  const projected =
    velocityPerWeek > 0 && remaining > 0
      ? addDays(now, Math.max(1, Math.ceil((remaining / velocityPerWeek) * 7)))
      : null;
  const projectedLateDays = projected
    ? differenceInCalendarDays(projected, parse(goal.deadline))
    : null;

  let status: ForecastStatus;
  if (total === 0) status = 'empty';
  else if (remaining === 0) status = 'complete';
  else if (isPast) status = 'overdue';
  else if (
    (projectedLateDays !== null && projectedLateDays > 1) ||
    capacityRatio > 1.15
  )
    status = 'at-risk';
  else if (
    (projectedLateDays !== null && projectedLateDays > 0) ||
    capacityRatio > 0.82 ||
    (velocityPerWeek === 0 && daysLeft <= 5 && remaining > 0)
  )
    status = 'tight';
  else if (projectedLateDays !== null && projectedLateDays < -2 && capacityRatio < 0.7)
    status = 'ahead';
  else status = 'on-track';

  const summary: Record<ForecastStatus, string> = {
    complete: 'The whole plan is finished before the moment.',
    ahead: 'The pace is comfortably ahead of the deadline.',
    'on-track': 'The current pace fits the time that is left.',
    tight: 'Possible, but the next few days have to hold.',
    'at-risk': 'The remaining work needs more room than the calendar gives it.',
    overdue: 'The date has passed with work still open.',
    empty: 'No milestones yet, so there is nothing to project.',
  };

  const capacityNote =
    workloadMinutes === 0
      ? 'Every planned minute of work is accounted for.'
      : `You have about ${fmtDuration(availableMinutes)} of prep time and ${fmtDuration(
          workloadMinutes,
        )} of work left${Number.isFinite(capacityRatio) ? ` (${Math.round(capacityRatio * 100)}% of capacity)` : ''}.`;

  const paceNote =
    remaining === 0
      ? 'Nothing left to schedule.'
      : velocityPerWeek > 0
        ? `${completedLast14} milestone${completedLast14 === 1 ? '' : 's'} in the last 14 days — roughly ${velocityPerWeek.toFixed(
            1,
          )}/week against a required ${requiredPerWeek.toFixed(1)}/week.`
        : `No completions in the last 14 days. The remaining plan needs about ${requiredPerWeek.toFixed(
            1,
          )} milestone${requiredPerWeek > 1 ? 's' : ''}/week from here.`;

  const projectionNote =
    projected === null
      ? remaining === 0
        ? 'Nothing left to project.'
        : 'Complete a milestone to unlock a finish-date projection.'
      : `At this pace, the plan lands around ${fmtDateShort(projected)}${
          projectedLateDays !== null && projectedLateDays > 0
            ? ` — ${projectedLateDays} day${projectedLateDays === 1 ? '' : 's'} after the deadline.`
            : projectedLateDays !== null && projectedLateDays < 0
              ? ` — ${Math.abs(projectedLateDays)} day${Math.abs(projectedLateDays) === 1 ? '' : 's'} early.`
              : ' — right on the deadline.'
        }`;

  return {
    status,
    label: FORECAST_META[status].label,
    total,
    done,
    remaining,
    workloadMinutes,
    availableMinutes,
    capacityRatio,
    recommendedDailyMinutes,
    completedLast14,
    velocityPerWeek,
    requiredPerWeek,
    projectedFinish: projected ? projected.toISOString() : null,
    projectedLateDays,
    summary: summary[status],
    capacityNote,
    paceNote,
    projectionNote,
  };
};

export interface GoalForecast {
  goal: Goal;
  forecast: MomentumForecast;
  daysLeft: number;
}

const statusRank: Record<ForecastStatus, number> = {
  'at-risk': 0,
  overdue: 1,
  tight: 2,
  'on-track': 3,
  ahead: 4,
  complete: 5,
  empty: 6,
};

export const forecastGoals = (
  goals: Goal[],
  milestones: Milestone[],
  now = new Date(),
): GoalForecast[] =>
  goals
    .filter((goal) => !goal.archived)
    .map((goal) => ({
      goal,
      forecast: forecastFor(goal, milestones, now),
      daysLeft: daysUntil(goal.deadline, now),
    }))
    .sort(
      (a, b) =>
        statusRank[a.forecast.status] - statusRank[b.forecast.status] ||
        a.daysLeft - b.daysLeft,
    );
