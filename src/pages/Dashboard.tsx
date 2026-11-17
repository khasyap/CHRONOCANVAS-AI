import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Compass,
  ListChecks,
  Palette,
  Plus,
  Sparkles,
  Timer,
  TriangleAlert,
  Wand2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/PageHeader';
import { CountdownDigits } from '@/components/LiveCountdown';
import { GoalCard, GoalStatusPill } from '@/components/GoalCard';
import { MilestoneRow } from '@/components/MilestoneRow';
import { ProgressRing } from '@/components/ProgressRing';
import { EmptyState } from '@/components/EmptyState';
import { categoryOf } from '@/lib/catalog';
import { buildLocalCoach, nextMilestone } from '@/lib/planner';
import { goalStats, overallStats, weeklyProgress } from '@/lib/metrics';
import { daysUntil, fmtDateLong, fmtDateShort, greeting, relativeDay } from '@/lib/dates';
import { fmtDuration } from '@/lib/utils';

export const Dashboard = () => {
  const { user, goals, milestones, toggleMilestone, loadDemoWorkspace } = useApp();
  const activeGoals = useMemo(() => goals.filter((goal) => !goal.archived), [goals]);
  const stats = useMemo(() => overallStats(goals, milestones), [goals, milestones]);

  const sortedGoals = useMemo(
    () =>
      activeGoals
        .slice()
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()),
    [activeGoals],
  );

  const primary = useMemo(
    () => sortedGoals.find((goal) => daysUntil(goal.deadline) >= 0) ?? sortedGoals[0] ?? null,
    [sortedGoals],
  );

  const primaryMilestones = useMemo(
    () => (primary ? milestones.filter((m) => m.goalId === primary.id) : []),
    [primary, milestones],
  );

  const primaryStats = useMemo(
    () => (primary ? goalStats(primary, primaryMilestones) : null),
    [primary, primaryMilestones],
  );

  const coach = useMemo(
    () => (primary ? buildLocalCoach(primary, primaryMilestones) : null),
    [primary, primaryMilestones],
  );

  const upcoming = useMemo(() => {
    const activeIds = new Set(activeGoals.map((goal) => goal.id));
    return milestones
      .filter((m) => !m.done && activeIds.has(m.goalId))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }, [milestones, activeGoals]);

  const week = useMemo(() => weeklyProgress(milestones), [milestones]);
  const completedThisWeek = week.reduce((sum, day) => sum + day.completed, 0);
  const dueThisWeek = week.reduce((sum, day) => sum + day.due, 0);

  if (!user) return null;

  const firstName = user.name.split(' ')[0];
  const category = primary ? categoryOf(primary.category) : null;
  const next = primary ? nextMilestone(primaryMilestones) : null;

  const tiles = [
    {
      label: 'Active deadlines',
      value: stats.activeGoals,
      note: stats.nextDeadline ? `Next ${fmtDateShort(stats.nextDeadline.goal.deadline)}` : 'A clear horizon',
      icon: Compass,
    },
    {
      label: 'Milestones complete',
      value: stats.completedMilestones,
      note: `${stats.pendingMilestones} still in motion`,
      icon: CheckCircle2,
    },
    {
      label: 'Needing attention',
      value: stats.overdueMilestones,
      note: stats.overdueMilestones > 0 ? 'Reschedule without moving the date' : 'Nothing overdue',
      icon: TriangleAlert,
    },
    {
      label: 'Planned focus',
      value: `${Math.round(stats.focusMinutes / 60)}h`,
      note: 'Across your open milestones',
      icon: Timer,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`Overview · ${fmtDateLong(new Date(), 'EEEE, d MMMM')}`}
        title={`${greeting()}, ${firstName}.`}
        description={
          stats.activeGoals > 0
            ? `${stats.activeGoals} deadline${stats.activeGoals === 1 ? '' : 's'} in motion. ${stats.pendingMilestones} milestones remain — one clear next step is enough.`
            : 'Your canvas is empty and the horizon is clear. Create a moment worth counting toward.'
        }
        actions={
          <>
            <Link to="/app/studio" className="btn btn-outline">
              <Wand2 className="h-4 w-4" />
              Wallpaper studio
            </Link>
            <Link to="/app/new" className="btn btn-gold">
              <Plus className="h-4 w-4" />
              New goal
            </Link>
          </>
        }
      />

      {!primary || !primaryStats || !category || !coach ? (
        <div className="space-y-6">
          <section className="glass relative overflow-hidden rounded-4xl p-7 sm:p-10">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 12% 0%, rgba(217,182,120,0.16), transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(79,124,86,0.2), transparent 55%)',
              }}
            />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1.25fr_0.75fr]">
              <div>
                <p className="eyebrow-bright">Your first canvas</p>
                <h2 className="display mt-3 max-w-xl text-[clamp(1.9rem,4vw,3rem)] leading-[1.05] text-ink">
                  Your first deadline
                  <br />
                  <span className="italic text-gold-gradient">deserves a beautiful plan.</span>
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted">
                  Name the moment, choose the rhythm, and let ChronoCanvas build a backward schedule and a
                  countdown wallpaper around it.
                </p>
                <div className="mt-7 flex flex-wrap gap-2.5">
                  <Link to="/app/new" className="btn btn-gold">
                    Create your first goal
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <button type="button" onClick={loadDemoWorkspace} className="btn btn-outline">
                    <Sparkles className="h-4 w-4" />
                    Load a sample workspace
                  </button>
                </div>
                <div className="mt-8 grid max-w-lg gap-3 sm:grid-cols-3">
                  {[
                    { icon: ListChecks, label: 'Smart milestones' },
                    { icon: Palette, label: '10 wallpaper themes' },
                    { icon: CalendarDays, label: 'Calendar export' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-2 rounded-xl border border-stroke bg-surface/40 px-3 py-2.5"
                    >
                      <item.icon className="h-3.5 w-3.5 text-accent" strokeWidth={1.6} />
                      <span className="text-[10px] text-muted">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative mx-auto w-full max-w-[250px]">
                <div
                  aria-hidden="true"
                  className="absolute -inset-6 rounded-full opacity-40 blur-3xl"
                  style={{ background: 'radial-gradient(circle, #B8914F, transparent 70%)' }}
                />
                <div className="relative rounded-[2rem] border border-white/15 bg-[#06100b] p-2 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]">
                  <div className="flex aspect-[9/17] flex-col justify-between overflow-hidden rounded-[1.55rem] bg-[linear-gradient(160deg,#243724,#132115_55%,#08100a)] p-5">
                    <div>
                      <p className="text-[7px] uppercase tracking-[0.22em] text-[#D9B678]/70">Countdown to</p>
                      <p className="display mt-2 text-lg leading-tight text-[#F8EDDB]">The moment</p>
                      <p className="mt-1 text-[7px] uppercase tracking-[0.14em] text-[#F8EDDB]/40">
                        Your deadline here
                      </p>
                    </div>
                    <div>
                      <p className="display num text-5xl leading-none text-[#D9B678]">00</p>
                      <p className="mt-1.5 text-[7px] uppercase tracking-[0.22em] text-[#F8EDDB]/50">
                        Days to go
                      </p>
                      <div className="mt-3 h-[2px] w-2/3 rounded-full bg-[#D9B678]/30" />
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
                      <p className="text-[6.5px] uppercase tracking-[0.18em] text-[#D9B678]/70">Next moment</p>
                      <p className="mt-1 text-[8px] text-[#F8EDDB]/80">Your first milestone</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: ListChecks,
                title: 'Plan backward',
                body: 'A realistic schedule from today to the deadline, with editable T-minus milestones.',
              },
              {
                icon: Wand2,
                title: 'Design the countdown',
                body: 'Turn the plan into a high-resolution lock screen with a theme that matches the moment.',
              },
              {
                icon: Sparkles,
                title: 'Arrive prepared',
                body: 'Live countdowns, reminders, calendar export and a celebration when the clock reaches zero.',
              },
            ].map((item) => (
              <div key={item.title} className="glass-soft rounded-2xl p-5">
                <item.icon className="h-4 w-4 text-accent" strokeWidth={1.6} />
                <p className="display mt-3 text-lg text-ink">{item.title}</p>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5 sm:space-y-6">
          <div className="grid gap-5 xl:grid-cols-[1.62fr_1fr]">
            <section className="glass relative overflow-hidden rounded-4xl p-6 sm:p-8">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-30 blur-3xl"
                style={{ background: category.accent }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04), transparent 55%)' }}
              />

              <div className="relative flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-stroke"
                    style={{ background: category.soft, color: category.accent }}
                  >
                    <category.icon className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-faint">{category.label}</p>
                    <p className="mt-0.5 text-[10px] text-muted">{fmtDateLong(primary.deadline, 'd MMMM yyyy · h:mm a')}</p>
                  </div>
                </div>
                <GoalStatusPill status={primaryStats.status} />
              </div>

              <div className="relative mt-8">
                <p className="eyebrow-bright">Your next big moment</p>
                <h2 className="display mt-2 max-w-[18ch] text-[clamp(1.85rem,3.6vw,2.75rem)] leading-[1.06] text-ink">
                  {primary.name}
                </h2>
              </div>

              <div className="relative mt-7">
                <CountdownDigits deadline={primary.deadline} size="hero" />
              </div>

              <div className="relative mt-8 max-w-xl">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-faint">
                    {primaryStats.percent}% preparation complete
                  </p>
                  <p className="num text-[10px] text-muted">
                    {primaryStats.done} / {primaryStats.total} milestones
                  </p>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--stroke)]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${primaryStats.percent}%`,
                      background: `linear-gradient(90deg, ${category.accent}, var(--accent))`,
                    }}
                  />
                </div>
              </div>

              <div className="relative mt-7 flex flex-wrap items-center gap-2.5">
                <Link to={`/app/goal/${primary.id}`} className="btn btn-gold btn-sm">
                  Open the countdown
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                <Link to={`/app/studio?goal=${primary.id}`} className="btn btn-outline btn-sm">
                  <Wand2 className="h-3.5 w-3.5" />
                  Design wallpaper
                </Link>
                <Link
                  to={`/app/planner/${primary.id}`}
                  className="btn btn-ghost btn-sm text-muted"
                >
                  Refine plan
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </section>

            <section className="glass relative flex flex-col overflow-hidden rounded-4xl p-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse at 100% 0%, rgba(169,192,164,0.16), transparent 55%)',
                }}
              />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow-bright">Deadline coach</p>
                  <p className="mt-1.5 text-[10px] text-faint">
                    {coach.priorities.length} priorities · updated live
                  </p>
                </div>
                <ProgressRing value={primaryStats.percent} size={58} stroke={4}>
                  <span className="num text-[11px] text-ink">{primaryStats.percent}%</span>
                </ProgressRing>
              </div>

              <h3 className="display relative mt-5 text-[1.35rem] leading-snug text-ink">{coach.headline}</h3>
              <p className="relative mt-2.5 text-[12px] leading-relaxed text-muted">{coach.body}</p>

              <div className="relative mt-5 space-y-2">
                {coach.priorities.slice(0, 2).map((priority) => {
                  const milestone = primaryMilestones.find((m) => m.id === priority.milestoneId);
                  if (!milestone) return null;
                  return (
                    <button
                      type="button"
                      key={priority.milestoneId}
                      onClick={() => toggleMilestone(milestone.id)}
                      className="group flex w-full items-start gap-2.5 rounded-xl border border-stroke bg-surface/50 p-3 text-left transition-colors hover:border-stroke-strong hover:bg-surface2/60"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-stroke-strong text-transparent transition-colors group-hover:border-accent group-hover:text-accent">
                        <CheckCircle2 className="h-3 w-3" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11.5px] leading-snug text-ink">{priority.label}</span>
                        <span className="mt-0.5 block text-[9.5px] text-faint">{priority.why}</span>
                      </span>
                    </button>
                  );
                })}
                {coach.priorities.length === 0 && (
                  <div className="rounded-xl border border-stroke bg-surface/50 p-3 text-[11px] text-muted">
                    Nothing pending. Open the plan to add the next meaningful step.
                  </div>
                )}
              </div>

              <div className="relative mt-auto border-t border-stroke pt-4">
                <p className="text-[11px] italic leading-relaxed text-muted">“{coach.tip}”</p>
                <Link
                  to={`/app/planner/${primary.id}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-accent transition-opacity hover:opacity-80"
                >
                  <Sparkles className="h-3 w-3" />
                  {primary.plan?.generatedBy === 'ai' ? 'Refine with Gemini' : 'Open the planner'}
                </Link>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {tiles.map((tile) => (
              <div key={tile.label} className="glass-soft rounded-2xl p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="eyebrow">{tile.label}</p>
                  <tile.icon className="h-3.5 w-3.5 text-faint" strokeWidth={1.6} />
                </div>
                <p className="display num mt-3 text-[2rem] leading-none text-ink">{tile.value}</p>
                <p className="mt-2 clamp-1 text-[9.5px] text-faint">{tile.note}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.38fr_1fr]">
            <section className="glass rounded-3xl p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow-bright">Coming up</p>
                  <h3 className="display mt-1.5 text-xl text-ink">Upcoming milestones</h3>
                </div>
                <Link
                  to="/app/calendar"
                  className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink"
                >
                  Calendar
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="mt-4 space-y-0.5">
                {upcoming.map((milestone) => (
                  <MilestoneRow
                    key={milestone.id}
                    milestone={milestone}
                    goalName={goals.find((g) => g.id === milestone.goalId)?.name}
                    onToggle={toggleMilestone}
                    compact
                  />
                ))}
                {upcoming.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-stroke p-8 text-center">
                    <p className="text-sm text-muted">No pending milestones across your active goals.</p>
                    <Link to="/app/planner" className="link-underline mt-2 inline-block text-[11px]">
                      Build the next plan
                    </Link>
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-stroke pt-4">
                <Link
                  to={`/app/planner/${primary.id}`}
                  className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink"
                >
                  Open the full plan
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </section>

            <section className="glass rounded-3xl p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow-bright">Momentum</p>
                  <h3 className="display mt-1.5 text-xl text-ink">This week</h3>
                </div>
                <div className="text-right">
                  <p className="display num text-2xl text-ink">{completedThisWeek}</p>
                  <p className="text-[8px] uppercase tracking-[0.16em] text-faint">completed</p>
                </div>
              </div>
              <div className="mt-4 h-[170px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={week} margin={{ top: 6, right: 0, bottom: 0, left: 0 }} barCategoryGap={16}>
                    <defs>
                      <linearGradient id="dashboardBars" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D9B678" />
                        <stop offset="100%" stopColor="#B8914F" stopOpacity={0.24} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="2 6" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'var(--faint)', fontSize: 9 }}
                      dy={5}
                    />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: 'var(--surface)' }}
                      contentStyle={{
                        background: 'var(--elevated)',
                        border: '1px solid var(--stroke)',
                        borderRadius: 12,
                        fontSize: 11,
                        color: 'var(--ink)',
                        boxShadow: '0 18px 50px -22px rgba(0,0,0,0.5)',
                      }}
                      labelStyle={{ color: 'var(--muted)' }}
                    />
                    <Bar dataKey="completed" name="Completed" fill="url(#dashboardBars)" radius={[5, 5, 2, 2]} />
                    <Bar dataKey="due" name="Due" fill="var(--stroke-strong)" radius={[5, 5, 2, 2]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-stroke pt-3">
                <div className="flex items-center gap-4 text-[9px] text-faint">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Completed
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--stroke-strong)]" /> Due
                  </span>
                  <span>{dueThisWeek} scheduled</span>
                </div>
                <Link to="/app/analytics" className="text-[9px] uppercase tracking-[0.14em] text-muted hover:text-ink">
                  Analytics
                </Link>
              </div>
            </section>
          </div>

          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow-bright">In motion</p>
                <h3 className="display mt-1.5 text-xl text-ink">Your countdowns</h3>
              </div>
              <Link
                to="/app/new"
                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink"
              >
                <Plus className="h-3 w-3" />
                New goal
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sortedGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} milestones={milestones} />
              ))}
              <Link
                to="/app/new"
                className="group flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-stroke p-6 text-center transition-colors hover:border-accent/50 hover:bg-surface/40"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-stroke bg-surface text-faint transition-colors group-hover:border-accent/50 group-hover:text-accent">
                  <Plus className="h-5 w-5" />
                </span>
                <p className="display mt-4 text-lg text-ink">Add another moment</p>
                <p className="mt-1.5 max-w-[26ch] text-[10.5px] leading-relaxed text-faint">
                  A trip, a wedding, an exam, or a promise to yourself.
                </p>
              </Link>
            </div>
          </section>

          {next && (
            <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-stroke bg-surface/40 p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: category.soft, color: category.accent }}
                >
                  <ListChecks className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] text-ink">
                    Next up · {next.title}
                  </p>
                  <p className="text-[9.5px] text-faint">
                    {relativeDay(next.date)} · {fmtDuration(next.duration)} planned
                  </p>
                </div>
              </div>
              <Link to={`/app/goal/${primary.id}`} className="btn btn-outline btn-sm">
                View details
              </Link>
            </div>
          )}

          {activeGoals.length === 0 && (
            <EmptyState
              icon={Compass}
              title="Everything is archived"
              description="Your past countdowns are safely stored. Start a new moment or restore an archived goal from its detail page."
              action={
                <Link to="/app/new" className="btn btn-gold btn-sm">
                  Create a new goal
                </Link>
              }
            />
          )}
        </div>
      )}
    </div>
  );
};
