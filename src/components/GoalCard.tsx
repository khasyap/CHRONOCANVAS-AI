import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, Mail, Sparkles } from 'lucide-react';
import type { Goal, Milestone } from '@/types';
import { categoryOf } from '@/lib/catalog';
import { CompactCountdown } from './LiveCountdown';
import { goalStats } from '@/lib/metrics';
import { fmtDateShort, relativeDay } from '@/lib/dates';
import { cn } from '@/lib/utils';

const statusMeta = {
  achieved: { label: 'Achieved', color: 'var(--success)', bg: 'rgba(125,211,168,0.12)' },
  overdue: { label: 'Overdue', color: 'var(--danger)', bg: 'rgba(255,139,139,0.12)' },
  active: { label: 'In motion', color: 'var(--lavender)', bg: 'rgba(169,192,164,0.12)' },
  soon: { label: 'Final stretch', color: 'var(--warning)', bg: 'rgba(232,194,123,0.12)' },
  archived: { label: 'Archived', color: 'var(--faint)', bg: 'var(--surface)' },
};

export const GoalCard = ({ goal, milestones }: { goal: Goal; milestones: Milestone[] }) => {
  const category = categoryOf(goal.category);
  const Icon = category.icon;
  const stats = goalStats(goal, milestones);
  const status = statusMeta[stats.status];

  return (
    <Link
      to={`/app/goal/${goal.id}`}
      className="glass glass-hover group relative flex h-full flex-col overflow-hidden rounded-3xl p-5 sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
        style={{ background: category.accent }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-stroke"
            style={{ background: category.soft, color: category.accent }}
          >
            <Icon className="h-4 w-4" strokeWidth={1.6} />
          </span>
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-faint">{category.short}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
              {fmtDateShort(goal.deadline)}
              {goal.capsule?.sealedAt && (
                <span
                  className="inline-flex text-accent"
                  aria-label="Time capsule sealed"
                  title="Time capsule sealed"
                >
                  <Mail className="h-2.5 w-2.5" />
                </span>
              )}
            </p>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] uppercase tracking-[0.12em]"
          style={{ color: status.color, background: status.bg }}
        >
          <span className="h-1 w-1 rounded-full" style={{ background: status.color }} />
          {status.label}
        </span>
      </div>

      <div className="relative mt-5 flex items-end justify-between gap-3">
        <h3 className="display clamp-2 max-w-[75%] text-[1.32rem] leading-[1.15] text-ink transition-colors group-hover:text-accent">
          {goal.name}
        </h3>
        <CompactCountdown deadline={goal.deadline} className="shrink-0" />
      </div>

      <div className="relative mt-5">
        <div className="flex items-center justify-between text-[10px] text-faint">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            {stats.done} of {stats.total} milestones
          </span>
          <span className="num text-muted">{stats.percent}%</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[color:var(--stroke)]">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${stats.percent}%`,
              background: `linear-gradient(90deg, ${category.accent}, var(--accent))`,
            }}
          />
        </div>
      </div>

      <div className="relative mt-auto flex items-center justify-between gap-3 pt-5">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-muted">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span className="clamp-1">
            {stats.next
              ? `Next · ${stats.next.title} · ${relativeDay(stats.next.date)}`
              : stats.percent === 100
                ? 'Every milestone complete'
                : 'No milestones yet'}
          </span>
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stroke text-faint transition-all group-hover:border-accent group-hover:text-accent">
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
};

export const GoalStatusPill = ({ status }: { status: keyof typeof statusMeta }) => {
  const meta = statusMeta[status];
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] uppercase tracking-[0.14em]')}
      style={{ color: meta.color, background: meta.bg }}
    >
      <span className="h-1 w-1 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
};
