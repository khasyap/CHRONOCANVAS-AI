import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isSameDay, startOfDay, subDays } from 'date-fns';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Flame,
  Sparkles,
  Target,
  Timer,
  TriangleAlert,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/PageHeader';
import { ProgressRing } from '@/components/ProgressRing';
import { EmptyState } from '@/components/EmptyState';
import { categoryOf, PRIORITY_META } from '@/lib/catalog';
import {
  categoryMix,
  completionByGoal,
  overallStats,
  priorityQueue,
  weeklyProgress,
} from '@/lib/metrics';
import { buildLocalCoach } from '@/lib/planner';
import { FORECAST_META, forecastGoals } from '@/lib/forecast';
import { daysUntil, fmtDateShort, parse, relativeDay } from '@/lib/dates';
import { fmtDuration, pct } from '@/lib/utils';
import { cn } from '@/lib/utils';

const tooltipStyle = {
  background: 'var(--elevated)',
  border: '1px solid var(--stroke)',
  borderRadius: 12,
  fontSize: 11,
  color: 'var(--ink)',
  boxShadow: '0 18px 50px -22px rgba(0,0,0,0.5)',
};

export const Analytics = () => {
  const { user, goals, milestones } = useApp();
  const now = useMemo(() => new Date(), []);
  const [range, setRange] = useState<7 | 30>(7);

  const activeGoals = useMemo(() => goals.filter((goal) => !goal.archived), [goals]);
  const activeIds = useMemo(() => new Set(activeGoals.map((goal) => goal.id)), [activeGoals]);
  const relevant = useMemo(
    () => milestones.filter((milestone) => activeIds.has(milestone.goalId)),
    [milestones, activeIds],
  );
  const stats = useMemo(() => overallStats(goals, milestones, now), [goals, milestones, now]);

  const primary = useMemo(
    () =>
      activeGoals
        .slice()
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
        .find((goal) => daysUntil(goal.deadline, now) >= 0) ?? activeGoals[0] ?? null,
    [activeGoals, now],
  );

  const primaryMilestones = useMemo(
    () => (primary ? milestones.filter((milestone) => milestone.goalId === primary.id) : []),
    [primary, milestones],
  );
  const coach = useMemo(
    () => (primary ? buildLocalCoach(primary, primaryMilestones, now) : null),
    [primary, primaryMilestones, now],
  );

  const rangeData = useMemo(
    () =>
      Array.from({ length: range }, (_, index) => {
        const day = subDays(startOfDay(now), range - 1 - index);
        const due = relevant.filter((milestone) => isSameDay(parse(milestone.date), day));
        const completed = relevant.filter(
          (milestone) =>
            milestone.done &&
            milestone.completedAt &&
            isSameDay(parse(milestone.completedAt), day),
        );
        return {
          label: range === 30 ? format(day, 'd') : format(day, 'EEE'),
          completed: completed.length,
          due: due.length,
          minutes: due.reduce((sum, milestone) => sum + milestone.duration, 0),
        };
      }),
    [relevant, range, now],
  );

  const rangeCompleted = rangeData.reduce((sum, day) => sum + day.completed, 0);
  const rangeDue = rangeData.reduce((sum, day) => sum + day.due, 0);
  const monthRate = pct(
    relevant.filter(
      (milestone) =>
        milestone.done &&
        milestone.completedAt &&
        parse(milestone.completedAt).getMonth() === now.getMonth(),
    ).length,
    relevant.filter((milestone) => parse(milestone.date).getMonth() === now.getMonth()).length,
  );

  const prioritised = useMemo(
    () => priorityQueue(goals, milestones, now, 6),
    [goals, milestones, now],
  );
  const byGoal = useMemo(() => completionByGoal(activeGoals, milestones, 6), [activeGoals, milestones]);
  const mix = useMemo(() => categoryMix(goals), [goals]);
  const week = useMemo(() => weeklyProgress(milestones, now), [milestones, now]);
  const forecasts = useMemo(
    () => forecastGoals(activeGoals, milestones, now),
    [activeGoals, milestones, now],
  );

  if (!user) return null;

  if (activeGoals.length === 0) {
    return (
      <div>
        <PageHeader
          eyebrow="Progress analytics"
          title="Progress becomes visible here."
          description="Create a deadline and the charts will fill with real completion data, momentum and focus time."
          backTo="/app"
        />
        <EmptyState
          icon={BarChart3}
          title="Nothing to measure yet"
          description="Analytics are computed from your milestones. Start with one deadline worth preparing for."
          action={
            <Link to="/app/new" className="btn btn-gold">
              Create your first goal
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Progress analytics"
        title="A clearer view of the climb."
        description="Completion, momentum, priorities and focus time across every active countdown. All measured from your real milestones."
        actions={
          <>
            <div className="flex rounded-full border border-stroke bg-surface/60 p-0.5">
              {([7, 30] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRange(value)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[9px] uppercase tracking-[0.1em] transition-colors',
                    range === value ? 'bg-accent text-[color:var(--accent-ink)]' : 'text-muted hover:text-ink',
                  )}
                >
                  {value} days
                </button>
              ))}
            </div>
            <Link to="/app/calendar" className="btn btn-outline">
              Calendar view
            </Link>
          </>
        }
      />

      <section className="glass relative overflow-hidden rounded-4xl p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 10% 0%, rgba(217,182,120,0.14), transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(79,124,86,0.16), transparent 55%)',
          }}
        />
        <div className="relative grid items-center gap-8 lg:grid-cols-[auto_1fr_auto]">
          <ProgressRing value={stats.averagePercent} size={148} stroke={9} color="var(--accent)">
            <span className="display num text-[2.1rem] leading-none text-ink">{stats.averagePercent}%</span>
            <span className="mt-1 text-[7px] uppercase tracking-[0.18em] text-faint">average prepared</span>
          </ProgressRing>

          <div>
            <p className="eyebrow-bright">Across {stats.activeGoals} active countdowns</p>
            <h2 className="display mt-2 max-w-xl text-[clamp(1.5rem,3vw,2.2rem)] leading-[1.12] text-ink">
              {stats.overdueMilestones > 0
                ? `${stats.overdueMilestones} milestone${stats.overdueMilestones === 1 ? ' needs' : 's need'} a gentle rescue.`
                : stats.averagePercent >= 75
                  ? 'The final stretch is in sight.'
                  : 'Steady progress. The plan is holding.'}
            </h2>
            <p className="mt-2.5 max-w-xl text-[12px] leading-relaxed text-muted">
              {stats.completedMilestones} of {stats.completedMilestones + stats.pendingMilestones} milestones
              complete, {fmtDuration(stats.focusMinutes)} of intentional work remaining. This month's
              completion rate is {monthRate}%.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
            {[
              { label: 'This week', value: stats.completedThisWeek, icon: Flame },
              { label: 'Open work', value: stats.pendingMilestones, icon: Target },
              { label: 'Overdue', value: stats.overdueMilestones, icon: TriangleAlert },
              { label: 'Focus left', value: `${Math.round(stats.focusMinutes / 60)}h`, icon: Timer },
            ].map((tile) => (
              <div key={tile.label} className="rounded-xl border border-stroke bg-surface/50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[8px] uppercase tracking-[0.12em] text-faint">{tile.label}</p>
                  <tile.icon className="h-3 w-3 text-faint" />
                </div>
                <p className="display num mt-1.5 text-xl leading-none text-ink">{tile.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="glass relative mt-5 overflow-hidden rounded-3xl p-5 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 8% 0%, rgba(217,182,120,0.1), transparent 50%), radial-gradient(ellipse at 94% 100%, rgba(79,124,86,0.12), transparent 52%)',
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow-bright">Momentum forecast</p>
            <h2 className="display mt-1.5 text-xl leading-snug text-ink">
              The calendar, read against your real pace.
            </h2>
            <p className="mt-1.5 max-w-xl text-[10.5px] leading-relaxed text-faint">
              Each countdown compares the focus minutes left with the preparation time you actually have,
              then projects a finish from your recent completions. No invented score.
            </p>
          </div>
          <span className="text-[8.5px] uppercase tracking-[0.14em] text-faint">
            {forecasts.length} active · sorted by risk
          </span>
        </div>

        <div className="relative mt-4 grid gap-2.5 md:grid-cols-2">
          {forecasts.slice(0, 4).map(({ goal, forecast }) => {
            const meta = FORECAST_META[forecast.status];
            const category = categoryOf(goal.category);
            const capacity = Number.isFinite(forecast.capacityRatio)
              ? Math.min(100, Math.round(forecast.capacityRatio * 100))
              : 100;
            return (
              <Link
                key={goal.id}
                to={`/app/goal/${goal.id}`}
                className="group rounded-2xl border border-stroke bg-surface/40 p-3.5 transition-colors hover:border-stroke-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="clamp-1 text-[11.5px] text-ink transition-colors group-hover:text-accent">
                      {goal.name}
                    </p>
                    <p className="mt-0.5 text-[8.5px] text-faint">
                      {category.short} · {forecast.remaining} step
                      {forecast.remaining === 1 ? '' : 's'} left
                    </p>
                  </div>
                  <span
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[8px] uppercase tracking-[0.1em]"
                    style={{ color: meta.color, background: meta.bg }}
                  >
                    <span className="h-1 w-1 rounded-full" style={{ background: meta.color }} />
                    {meta.label}
                  </span>
                </div>
                <p className="clamp-2 mt-2 text-[9.5px] leading-relaxed text-muted">
                  {forecast.summary}
                </p>
                <div className="mt-2.5 flex items-center justify-between text-[8px] uppercase tracking-[0.08em] text-faint">
                  <span>{fmtDuration(forecast.workloadMinutes)} left</span>
                  <span>{fmtDuration(forecast.availableMinutes)} available</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[color:var(--stroke)]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${capacity}%`, background: meta.color }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[8.5px] text-faint">
                  <span>
                    {forecast.projectedFinish
                      ? `Lands ${fmtDateShort(forecast.projectedFinish)}`
                      : 'Needs pace data'}
                  </span>
                  <span>
                    {forecast.remaining > 0
                      ? `${forecast.requiredPerWeek.toFixed(1)}/wk needed`
                      : 'Complete'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <section className="glass rounded-3xl p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow-bright">Completion rhythm</p>
              <h3 className="display mt-1.5 text-xl text-ink">Completed vs scheduled</h3>
            </div>
            <div className="text-right">
              <p className="display num text-2xl text-ink">
                {rangeCompleted}
                <span className="text-sm text-faint">/{rangeDue}</span>
              </p>
              <p className="text-[8px] uppercase tracking-[0.12em] text-faint">last {range} days</p>
            </div>
          </div>
          <div className="mt-5 h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rangeData} margin={{ top: 6, right: 0, bottom: 0, left: 0 }} barCategoryGap={range === 30 ? 4 : 18}>
                <defs>
                  <linearGradient id="analyticsBars" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D9B678" />
                    <stop offset="100%" stopColor="#B8914F" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="2 6" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--faint)', fontSize: 9 }}
                  dy={6}
                  interval={range === 30 ? 4 : 0}
                />
                <YAxis hide allowDecimals={false} />
                <Tooltip cursor={{ fill: 'var(--surface)' }} contentStyle={tooltipStyle} labelStyle={{ color: 'var(--muted)' }} />
                <Bar dataKey="completed" name="Completed" fill="url(#analyticsBars)" radius={[5, 5, 2, 2]} />
                <Bar dataKey="due" name="Scheduled" fill="var(--stroke-strong)" radius={[5, 5, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stroke pt-3 text-[9px] text-faint">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Completed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--stroke-strong)]" /> Scheduled
              </span>
            </div>
            <span>{rangeDue - rangeCompleted} still open in this window</span>
          </div>
        </section>

        <section className="glass rounded-3xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow-bright">Composition</p>
              <h3 className="display mt-1.5 text-xl text-ink">Where your attention goes</h3>
            </div>
            <Activity className="h-4 w-4 text-faint" />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-[170px] w-[170px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {mix.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {mix.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-[10px] text-muted">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color }} />
                    <span className="truncate">{entry.name}</span>
                  </span>
                  <span className="num text-[10px] text-faint">{entry.value}</span>
                </div>
              ))}
              {mix.length === 0 && <p className="text-[10px] text-faint">No active categories yet.</p>}
            </div>
          </div>
          <div className="mt-3 border-t border-stroke pt-3">
            <p className="text-[9px] leading-relaxed text-faint">
              Category mix is based on active countdowns. Use it to notice when one kind of deadline is
              crowding out the rest.
            </p>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <section className="glass rounded-3xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow-bright">By countdown</p>
              <h3 className="display mt-1.5 text-xl text-ink">Completion by goal</h3>
            </div>
            <Link to="/app/planner" className="text-[9px] uppercase tracking-[0.12em] text-muted hover:text-ink">
              Planner
            </Link>
          </div>
          <div className="mt-5 space-y-4">
            {byGoal.map((entry) => (
              <div key={entry.name}>
                <div className="flex items-center justify-between gap-3">
                  <p className="clamp-1 text-[11px] text-ink">{entry.name}</p>
                  <span className="num text-[10px] text-faint">
                    {entry.done}/{entry.total} · {entry.percent}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--stroke)]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${entry.percent}%`,
                      background: `linear-gradient(90deg, ${entry.accent}, var(--accent))`,
                    }}
                  />
                </div>
              </div>
            ))}
            {byGoal.length === 0 && (
              <p className="text-[11px] text-muted">No active countdowns to compare.</p>
            )}
          </div>

          <div className="mt-6 border-t border-stroke pt-4">
            <p className="eyebrow">Recent rhythm</p>
            <div className="mt-3 flex items-end gap-1.5">
              {week.map((day) => (
                <div key={day.label} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-16 w-full items-end">
                    <div
                      className="w-full rounded-sm bg-[linear-gradient(180deg,#D9B678,rgba(184,145,79,0.15))]"
                      style={{ height: `${Math.max(4, (day.completed / Math.max(1, ...week.map((d) => d.completed))) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[7.5px] text-faint">{day.label.slice(0, 1)}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[9px] text-faint">Completed milestones over the last seven days.</p>
          </div>
        </section>

        <section className="glass rounded-3xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow-bright">Smart priority</p>
              <h3 className="display mt-1.5 text-xl text-ink">What deserves attention</h3>
            </div>
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-faint">
            Urgency combines proximity, priority and the weight of the goal — not just the nearest date.
          </p>
          <div className="mt-4 space-y-2">
            {prioritised.map((item) => {
              const category = categoryOf(item.goal.category);
              return (
                <div key={item.milestone.id} className="rounded-xl border border-stroke bg-surface/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="clamp-1 text-[11px] text-ink">{item.milestone.title}</p>
                      <p className="mt-0.5 text-[8.5px] text-faint">
                        {item.goal.name} · {relativeDay(item.milestone.date)} ·{' '}
                        {PRIORITY_META[item.milestone.priority].label}
                      </p>
                    </div>
                    <span className="display num shrink-0 text-sm" style={{ color: category.accent }}>
                      {item.score}
                    </span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-[color:var(--stroke)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${item.score}%`,
                        background: `linear-gradient(90deg, ${category.accent}, var(--accent))`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {prioritised.length === 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-stroke p-3 text-[10px] text-muted">
                <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--success)]" />
                Nothing pending. A genuinely clear horizon.
              </div>
            )}
          </div>
        </section>
      </div>

      {coach && (
        <section className="glass relative mt-5 overflow-hidden rounded-3xl p-5 sm:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 100% 0%, rgba(169,192,164,0.14), transparent 55%)' }}
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow-bright">The coach's read</p>
              <h3 className="display mt-2 text-xl leading-snug text-ink">{coach.headline}</h3>
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted">{coach.body}</p>
              <p className="mt-3 border-l border-accent/30 pl-3 text-[10.5px] italic leading-relaxed text-faint">
                “{coach.tip}”
              </p>
            </div>
            <Link to="/app/planner" className="btn btn-outline btn-sm shrink-0">
              Open the plan
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
};
