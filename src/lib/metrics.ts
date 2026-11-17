import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
  subDays,
} from 'date-fns';
import type { CategoryId, Goal, Milestone } from '@/types';
import { categoryOf } from './catalog';
import { daysUntil, isOverdue, parse } from './dates';
import { pct } from './utils';
import { nextMilestone, urgencyScore } from './planner';

export type GoalStatus = 'achieved' | 'overdue' | 'active' | 'archived' | 'soon';

export interface GoalStats {
  total: number;
  done: number;
  pending: number;
  overdue: number;
  percent: number;
  daysLeft: number;
  status: GoalStatus;
  next: Milestone | null;
  minutesRemaining: number;
}

export const goalStats = (goal: Goal, milestones: Milestone[], now = new Date()): GoalStats => {
  const own = milestones.filter((m) => m.goalId === goal.id);
  const done = own.filter((m) => m.done).length;
  const pending = own.length - done;
  const overdue = own.filter((m) => !m.done && isOverdue(m.date, now)).length;
  const daysLeft = daysUntil(goal.deadline, now);
  const allDone = own.length > 0 && done === own.length;
  const isPast = parse(goal.deadline).getTime() <= now.getTime();
  const status: GoalStatus = goal.archived
    ? 'archived'
    : goal.achievedAt || allDone
      ? 'achieved'
      : isPast
        ? 'overdue'
        : daysLeft <= 3
          ? 'soon'
          : 'active';

  return {
    total: own.length,
    done,
    pending,
    overdue,
    percent: pct(done, own.length),
    daysLeft,
    status,
    next: nextMilestone(own, now),
    minutesRemaining: own.filter((m) => !m.done).reduce((sum, m) => sum + m.duration, 0),
  };
};

export interface OverallStats {
  activeGoals: number;
  totalGoals: number;
  completedMilestones: number;
  pendingMilestones: number;
  overdueMilestones: number;
  averagePercent: number;
  nextDeadline: { goal: Goal; daysLeft: number } | null;
  completedThisWeek: number;
  focusMinutes: number;
}

export const overallStats = (goals: Goal[], milestones: Milestone[], now = new Date()): OverallStats => {
  const active = goals.filter((g) => !g.archived);
  const activeIds = new Set(active.map((g) => g.id));
  const relevant = milestones.filter((m) => activeIds.has(m.goalId));
  const completed = relevant.filter((m) => m.done).length;
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const completedThisWeek = relevant.filter(
    (m) => m.done && m.completedAt && parse(m.completedAt).getTime() >= weekStart.getTime(),
  ).length;

  const stats = active.map((g) => goalStats(g, relevant, now));
  const averagePercent =
    stats.length === 0 ? 0 : Math.round(stats.reduce((sum, s) => sum + s.percent, 0) / stats.length);

  const sorted = active
    .map((goal) => ({ goal, daysLeft: daysUntil(goal.deadline, now) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    activeGoals: active.length,
    totalGoals: goals.length,
    completedMilestones: completed,
    pendingMilestones: relevant.length - completed,
    overdueMilestones: relevant.filter((m) => !m.done && isOverdue(m.date, now)).length,
    averagePercent,
    nextDeadline: sorted.find((item) => item.daysLeft >= 0) ?? sorted[0] ?? null,
    completedThisWeek,
    focusMinutes: relevant.filter((m) => !m.done).reduce((sum, m) => sum + m.duration, 0),
  };
};

export interface WeeklyPoint {
  label: string;
  completed: number;
  due: number;
  plannedMinutes: number;
}

export const weeklyProgress = (
  milestones: Milestone[],
  now = new Date(),
  days = 7,
): WeeklyPoint[] => {
  const start = subDays(startOfDay(now), days - 1);
  return Array.from({ length: days }, (_, index) => {
    const day = addDays(start, index);
    const due = milestones.filter((m) => isSameDay(parse(m.date), day)).length;
    const completed = milestones.filter(
      (m) => m.done && m.completedAt && isSameDay(parse(m.completedAt), day),
    ).length;
    const plannedMinutes = milestones
      .filter((m) => isSameDay(parse(m.date), day))
      .reduce((sum, m) => sum + m.duration, 0);
    return {
      label: format(day, 'EEE'),
      completed,
      due,
      plannedMinutes,
    };
  });
};

export interface VelocityPoint {
  label: string;
  completion: number;
  created: number;
}

export const completionByGoal = (
  goals: Goal[],
  milestones: Milestone[],
  limit = 5,
): { name: string; percent: number; done: number; total: number; accent: string }[] =>
  goals
    .filter((g) => !g.archived)
    .slice(0, limit)
    .map((goal) => {
      const own = milestones.filter((m) => m.goalId === goal.id);
      const done = own.filter((m) => m.done).length;
      return {
        name: goal.name.length > 22 ? `${goal.name.slice(0, 21)}…` : goal.name,
        percent: pct(done, own.length),
        done,
        total: own.length,
        accent: categoryOf(goal.category).accent,
      };
    });

export const categoryMix = (
  goals: Goal[],
): { id: CategoryId; name: string; value: number; color: string }[] => {
  const counts = new Map<CategoryId, number>();
  goals.filter((g) => !g.archived).forEach((g) => counts.set(g.category, (counts.get(g.category) ?? 0) + 1));
  return Array.from(counts.entries())
    .map(([id, value]) => ({
      id,
      name: categoryOf(id).short,
      value,
      color: categoryOf(id).accent,
    }))
    .sort((a, b) => b.value - a.value);
};

export interface PriorityItem {
  milestone: Milestone;
  goal: Goal;
  score: number;
}

export const priorityQueue = (
  goals: Goal[],
  milestones: Milestone[],
  now = new Date(),
  limit = 6,
): PriorityItem[] => {
  const active = new Set(goals.filter((g) => !g.archived).map((g) => g.id));
  return milestones
    .filter((m) => !m.done && active.has(m.goalId))
    .map((milestone) => {
      const goal = goals.find((g) => g.id === milestone.goalId);
      return goal
        ? { milestone, goal, score: urgencyScore(milestone, goal, now) }
        : null;
    })
    .filter((item): item is PriorityItem => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

export const milestoneCountdownDays = (milestone: Milestone, now = new Date()): number =>
  differenceInCalendarDays(startOfDay(parse(milestone.date)), startOfDay(now));

export const monthlyCompletionRate = (milestones: Milestone[], now = new Date()): number => {
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const relevant = milestones.filter((m) => parse(m.date).getTime() >= monthStart.getTime());
  return pct(relevant.filter((m) => m.done).length, relevant.length);
};
