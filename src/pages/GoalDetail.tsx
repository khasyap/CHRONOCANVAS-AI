import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Archive,
  ArrowUpRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Download,
  Heart,
  Lock,
  Mail,
  Pencil,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import type { CategoryId, DeviceId, Goal, Importance, Milestone } from '@/types';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/PageHeader';
import { CountdownDigits, useNow } from '@/components/LiveCountdown';
import { ProgressRing } from '@/components/ProgressRing';
import { MilestoneRow } from '@/components/MilestoneRow';
import { GoalStatusPill } from '@/components/GoalCard';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Confetti } from '@/components/Confetti';
import { EmptyState } from '@/components/EmptyState';
import { CATEGORIES, DEVICES, IMPORTANCE_OPTIONS, PREP_OPTIONS, categoryOf } from '@/lib/catalog';
import { goalStats } from '@/lib/metrics';
import { nextMilestone } from '@/lib/planner';
import { FORECAST_META, forecastFor } from '@/lib/forecast';
import { downloadGoalCalendar, googleCalendarUrl } from '@/lib/ics';
import {
  fmtDateLong,
  fmtDateShort,
  fmtTime,
  fromLocalInput,
  getCountdown,
  relativeDay,
  toLocalInput,
} from '@/lib/dates';
import { cn, fmtDuration } from '@/lib/utils';

interface EditForm {
  name: string;
  deadline: string;
  category: CategoryId;
  importance: Importance;
  prepMinutes: number;
  reminderTime: string;
  device: DeviceId;
  notes: string;
}

const toEditForm = (goal: Goal): EditForm => ({
  name: goal.name,
  deadline: toLocalInput(goal.deadline),
  category: goal.category,
  importance: goal.importance,
  prepMinutes: goal.prepMinutes,
  reminderTime: goal.reminderTime,
  device: goal.device,
  notes: goal.notes,
});

export const GoalDetail = () => {
  const {
    user,
    goals,
    milestones,
    designs,
    toggleMilestone,
    updateGoal,
    deleteGoal,
    setGoalArchived,
    markGoalAchieved,
    pushToast,
  } = useApp();
  const { goalId } = useParams<{ goalId: string }>();
  const navigate = useNavigate();
  const now = useNow(1000);

  const goal = goals.find((item) => item.id === goalId) ?? null;
  const own = useMemo(
    () =>
      milestones
        .filter((milestone) => milestone.goalId === goalId)
        .sort(
          (a, b) =>
            a.order - b.order || new Date(a.date).getTime() - new Date(b.date).getTime(),
        ),
    [milestones, goalId],
  );

  const stats = goal ? goalStats(goal, own, now) : null;
  const category = goal ? categoryOf(goal.category) : null;
  const next = nextMilestone(own, now);
  const pending = own.filter((milestone) => !milestone.done);
  const completed = own.filter((milestone) => milestone.done);
  const countdown = goal ? getCountdown(goal.deadline, now) : null;
  const latestDesign = useMemo(
    () =>
      designs
        .filter((design) => design.goalId === goalId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null,
    [designs, goalId],
  );

  const [scoreCelebration, setScoreCelebration] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [capsuleDraft, setCapsuleDraft] = useState('');
  const [capsuleSealOpen, setCapsuleSealOpen] = useState(false);
  const [capsuleError, setCapsuleError] = useState<string | null>(null);
  const pastRef = useRef<boolean>(
    goal ? getCountdown(goal.deadline).isPast : false,
  );

  useEffect(() => {
    if (!goal) return;
    const isPast = getCountdown(goal.deadline).isPast;
    if (!pastRef.current && isPast) {
      setCelebrating(true);
    }
    pastRef.current = isPast;
  }, [goal, goal?.deadline, now]);

  useEffect(() => {
    if (!goal) return;
    setForm(toEditForm(goal));
  }, [goal]);

  useEffect(() => {
    if (!goal) return;
    setCapsuleDraft(goal.capsule?.message ?? '');
    setCapsuleError(null);
  }, [goal?.id, goal?.capsule?.message]);

  if (!user) return null;

  if (!goal || !stats || !category || !countdown) {
    return (
      <div>
        <PageHeader
          eyebrow="Countdown details"
          title="This countdown is not here."
          description="It may have been deleted, or the link may belong to a different account on this device."
          backTo="/app"
        />
        <EmptyState
          icon={CalendarDays}
          title="Countdown not found"
          description="Return to the overview or start a new moment; the rest of your plans are exactly where you left them."
          action={
            <Link to="/app" className="btn btn-gold btn-sm">
              Back to overview
            </Link>
          }
        />
      </div>
    );
  }

  const forecast = forecastFor(goal, own, now);
  const forecastMeta = FORECAST_META[forecast.status];
  const capacityPct = Number.isFinite(forecast.capacityRatio)
    ? Math.round(forecast.capacityRatio * 100)
    : 100;
  const capsule = goal.capsule;
  const capsuleSealed = Boolean(capsule?.sealedAt);
  const capsuleOpened = Boolean(capsule?.openedAt);
  const capsuleWords = capsule
    ? capsule.message.trim().split(/\s+/).filter(Boolean).length
    : 0;

  const sealCapsule = () => {
    const message = capsuleDraft.trim();
    if (message.length < 20) {
      setCapsuleError('Write at least a sentence — 20 characters or more.');
      return;
    }
    const sealedAt = new Date().toISOString();
    updateGoal(goal.id, {
      capsule: {
        message,
        createdAt: capsule?.createdAt ?? sealedAt,
        updatedAt: sealedAt,
        sealedAt,
      },
    });
    setCapsuleSealOpen(false);
    setCapsuleError(null);
    pushToast(
      'Time capsule sealed',
      `It opens on ${fmtDateLong(goal.deadline, 'd MMMM yyyy')}. Until then, the studio keeps it out of sight.`,
      'success',
    );
  };

  const openCapsule = () => {
    if (!capsule) return;
    updateGoal(goal.id, {
      capsule: { ...capsule, openedAt: new Date().toISOString() },
    });
    pushToast('Capsule opened', 'A note from the version of you who began this.', 'info');
  };

  const saveEdits = () => {
    if (!form) return;
    if (form.name.trim().length < 3) {
      setFormError('Give the goal a name of at least 3 characters.');
      return;
    }
    const date = new Date(form.deadline);
    if (Number.isNaN(date.getTime())) {
      setFormError('Choose a valid date and time.');
      return;
    }
    updateGoal(goal.id, {
      name: form.name.trim(),
      deadline: fromLocalInput(form.deadline),
      category: form.category,
      importance: form.importance,
      prepMinutes: form.prepMinutes,
      reminderTime: form.reminderTime,
      device: form.device,
      notes: form.notes.trim(),
    });
    setEditOpen(false);
    setFormError(null);
    pushToast('Goal updated', 'The countdown, plan and wallpaper inputs now share the new details.', 'success');
  };

  const archiveGoal = () => {
    setGoalArchived(goal.id, true);
    setArchiveOpen(false);
    pushToast('Goal archived', 'Its milestones and designs are kept safely on this device.', 'info');
    navigate('/app');
  };

  const deadlineAsMilestone: Milestone = {
    id: `deadline-${goal.id}`,
    goalId: goal.id,
    title: `Deadline: ${goal.name}`,
    description: 'The moment itself.',
    date: goal.deadline,
    offsetDays: 0,
    priority: 'critical',
    duration: 60,
    done: false,
    reminderEnabled: true,
    reminderLead: 120,
    order: 999,
    generatedBy: 'user',
  };

  return (
    <div>
      <Confetti active={celebrating} />

      <PageHeader
        eyebrow={`${category.label} · ${goal.importance === 'professional' ? 'Professional' : 'Personal'}`}
        title={goal.name}
        description={`${fmtDateLong(goal.deadline)} at ${fmtTime(goal.deadline)} · ${
          goal.plan?.generatedBy === 'ai' ? 'Planned with Gemini' : 'Planned on this device'
        }`}
        backTo="/app"
        backLabel="Back to overview"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setForm(toEditForm(goal));
                setFormError(null);
                setEditOpen(true);
              }}
              icon={<Pencil className="h-3.5 w-3.5" />}
            >
              Edit goal
            </Button>
            <Link to={`/app/planner/${goal.id}`} className="btn btn-outline">
              Planner
            </Link>
            <Link to={`/app/studio?goal=${goal.id}`} className="btn btn-gold">
              <Wand2 className="h-4 w-4" />
              Design wallpaper
            </Link>
          </>
        }
      />

      {countdown.isPast && (
        <div className="mb-5 flex flex-col items-start justify-between gap-4 overflow-hidden rounded-3xl border border-accent/25 bg-[linear-gradient(120deg,rgba(217,182,120,0.14),rgba(79,124,86,0.12))] p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-accent">The moment has arrived</p>
              <p className="display mt-1 text-lg text-ink">
                {goal.achievedAt ? 'You marked this one achieved.' : 'Take a breath. Notice what it took.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!goal.achievedAt && (
              <Button
                variant="gold"
                size="sm"
                onClick={() => {
                  markGoalAchieved(goal.id);
                  setCelebrating(true);
                }}
              >
                Mark achieved
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setCelebrating(true)}>
              Celebrate
            </Button>
          </div>
        </div>
      )}

      {!countdown.isPast && stats.total > 0 && stats.done === stats.total && (
        <div className="mb-5 flex flex-col items-start justify-between gap-4 overflow-hidden rounded-3xl border border-[rgba(125,211,168,0.3)] bg-[rgba(125,211,168,0.07)] p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(125,211,168,0.14)] text-[color:var(--success)]">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-[color:var(--success)]">Everything is complete</p>
              <p className="display mt-1 text-lg text-ink">The plan is done before the date.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCelebrating(true)}>
            Celebrate early
          </Button>
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[1.55fr_0.95fr]">
        <div className="space-y-5">
          <section className="glass relative overflow-hidden rounded-4xl p-6 sm:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-25 blur-3xl"
              style={{ background: category.accent }}
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
                  <p className="text-[9px] uppercase tracking-[0.2em] text-faint">
                    {countdown.isPast ? 'The date has arrived' : 'Live countdown'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {countdown.days} days · {countdown.hours} hours · {countdown.minutes} minutes
                  </p>
                </div>
              </div>
              <GoalStatusPill status={stats.status} />
            </div>

            <div className="relative mt-8">
              <CountdownDigits deadline={goal.deadline} size="hero" />
            </div>

            <div className="relative mt-8 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-faint">
                  <span>Preparation</span>
                  <span className="num text-muted">
                    {stats.done} / {stats.total}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--stroke)]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${stats.percent}%`,
                      background: `linear-gradient(90deg, ${category.accent}, var(--accent))`,
                    }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-faint">
                  {stats.percent}% complete · {fmtDuration(stats.minutesRemaining)} of focused work left
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href={googleCalendarUrl(goal, next ?? deadlineAsMilestone)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Google Calendar
                </a>
                <button
                  type="button"
                  onClick={() => downloadGoalCalendar(goal, own)}
                  className="btn btn-outline btn-sm"
                  disabled={own.length === 0}
                >
                  <Download className="h-3.5 w-3.5" />
                  .ics
                </button>
              </div>
            </div>
          </section>

          {next && (
            <section className="glass rounded-3xl p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow-bright">The next moment</p>
                  <h3 className="display mt-1.5 text-xl text-ink">{next.title}</h3>
                </div>
                <span className="rounded-lg border border-stroke px-2 py-1 font-mono text-[9px] text-accent">
                  {next.offsetDays === 0 ? 'T-0' : `T-${next.offsetDays}`}
                </span>
              </div>
              <p className="mt-2 max-w-xl text-[11.5px] leading-relaxed text-muted">{next.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-faint">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3" />
                  {fmtDateLong(next.date, 'EEEE d MMMM')} · {relativeDay(next.date)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ClockIcon /> {fmtDuration(next.duration)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Bell className="h-3 w-3" />
                  {next.reminderEnabled ? 'Reminder on' : 'No reminder'}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant={next.done ? 'outline' : 'gold'}
                  size="sm"
                  onClick={() => toggleMilestone(next.id)}
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                >
                  Mark complete
                </Button>
                <Link to={`/app/planner/${goal.id}`} className="btn btn-ghost btn-sm text-muted">
                  Open in planner
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </section>
          )}

          <section className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 15% 0%, rgba(217,182,120,0.11), transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(79,124,86,0.08), transparent 55%)',
              }}
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
                  <Mail className="h-4 w-4" />
                </span>
                <div>
                  <p className="eyebrow-bright">Time capsule</p>
                  <p className="mt-0.5 text-[9px] text-faint">
                    A private letter to the other side of this deadline
                  </p>
                </div>
              </div>
              {capsuleSealed && <span className="chip">{capsuleOpened ? 'Opened' : 'Sealed'}</span>}
            </div>

            {!capsuleSealed ? (
              countdown.isPast ? (
                <p className="relative mt-4 rounded-2xl border border-dashed border-stroke p-5 text-[11px] leading-relaxed text-muted">
                  No capsule was sealed before this moment. Your milestones, notes and wallpapers still hold
                  the story of how it happened.
                </p>
              ) : (
                <div className="relative mt-4">
                  <h3 className="display text-lg leading-snug text-ink">
                    Write to the person who arrives.
                  </h3>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
                    Put down what you hope they remember. It stays locked until the deadline, then opens
                    for you.
                  </p>
                  <textarea
                    className="field mt-3"
                    rows={5}
                    maxLength={1200}
                    value={capsuleDraft}
                    onChange={(event) => {
                      setCapsuleDraft(event.target.value);
                      if (capsuleError) setCapsuleError(null);
                    }}
                    placeholder="Dear future me…"
                    aria-label="Message for your future self"
                  />
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[9px] text-faint">
                      {capsuleDraft.trim().length} / 1200 · minimum 20
                    </span>
                    <Button
                      variant="gold"
                      size="sm"
                      disabled={capsuleDraft.trim().length < 20}
                      onClick={() => {
                        if (capsuleDraft.trim().length < 20) {
                          setCapsuleError('Write at least a sentence — 20 characters or more.');
                          return;
                        }
                        setCapsuleError(null);
                        setCapsuleSealOpen(true);
                      }}
                      icon={<Lock className="h-3.5 w-3.5" />}
                    >
                      Seal capsule
                    </Button>
                  </div>
                  {capsuleError && (
                    <p className="mt-2 text-[10.5px] text-[color:var(--danger)]">{capsuleError}</p>
                  )}
                  <p className="mt-2 text-[9px] leading-relaxed text-faint">
                    Sealing is final in the studio. The letter is stored on this device and stays out of
                    sight until the deadline.
                  </p>
                </div>
              )
            ) : !countdown.isPast ? (
              <div className="relative mt-4 flex flex-col items-center rounded-2xl border border-dashed border-accent/25 bg-accent/[0.035] p-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/30 bg-gradient-to-br from-accent/25 to-accent/[0.03] text-accent">
                  <Lock className="h-5 w-5" />
                </span>
                <p className="eyebrow-bright mt-4">
                  Sealed until {fmtDateLong(goal.deadline, 'd MMMM')}
                </p>
                <p className="display mt-2 max-w-md text-lg leading-snug text-ink">
                  A letter is waiting on the other side of this countdown.
                </p>
                <p className="mt-2 text-[10px] text-faint">
                  {capsuleWords} word{capsuleWords === 1 ? '' : 's'} · opens in {countdown.days} day
                  {countdown.days === 1 ? '' : 's'}. No peeking through the studio.
                </p>
              </div>
            ) : !capsuleOpened ? (
              <div className="relative mt-4 rounded-2xl border border-accent/30 bg-[linear-gradient(140deg,rgba(217,182,120,0.14),rgba(79,124,86,0.1))] p-6 text-center">
                <Mail className="mx-auto h-6 w-6 text-accent" />
                <p className="eyebrow-bright mt-3">The date has arrived</p>
                <h3 className="display mt-2 text-xl leading-snug text-ink">
                  The version of you who began this left a letter.
                </h3>
                <p className="mt-2 text-[10.5px] text-muted">
                  {capsuleWords} word{capsuleWords === 1 ? '' : 's'}, sealed on{' '}
                  {fmtDateLong(capsule?.sealedAt ?? goal.createdAt, 'd MMMM yyyy')}.
                </p>
                <Button
                  variant="gold"
                  size="sm"
                  className="mt-4"
                  onClick={openCapsule}
                  icon={<Mail className="h-3.5 w-3.5" />}
                >
                  Open the capsule
                </Button>
              </div>
            ) : (
              <div className="relative mt-4 animate-fade-up">
                <div className="rounded-2xl border border-accent/20 bg-[linear-gradient(150deg,rgba(217,182,120,0.1),rgba(79,124,86,0.06))] p-5">
                  <p className="whitespace-pre-wrap font-display text-[1.05rem] italic leading-relaxed text-ink">
                    “{capsule?.message}”
                  </p>
                </div>
                <p className="mt-2.5 text-[8.5px] uppercase tracking-[0.16em] text-faint">
                  Sealed {fmtDateLong(capsule?.sealedAt ?? capsule?.createdAt ?? goal.createdAt, 'd MMMM yyyy')}
                  {capsule?.openedAt
                    ? ` · opened ${fmtDateLong(capsule.openedAt, 'd MMMM yyyy')}`
                    : ''}
                </p>
              </div>
            )}
          </section>

          <section className="glass rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow-bright">The plan</p>
                <h3 className="display mt-1.5 text-xl text-ink">
                  {pending.length} of {own.length} step{own.length === 1 ? '' : 's'} remaining
                </h3>
              </div>
              <Link to={`/app/planner/${goal.id}`} className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted hover:text-ink">
                Edit sequence
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="mt-4 space-y-0.5">
              {pending.map((milestone) => (
                <MilestoneRow key={milestone.id} milestone={milestone} onToggle={toggleMilestone} />
              ))}
              {pending.length === 0 && (
                <div className="rounded-xl border border-dashed border-stroke p-5 text-center text-[11px] text-muted">
                  No pending milestones. Everything on this canvas is complete.
                </div>
              )}
            </div>

            {completed.length > 0 && (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => setShowCompleted((value) => !value)}
                  className="flex w-full items-center gap-3 text-left"
                  aria-expanded={showCompleted}
                >
                  <span className="text-[8px] uppercase tracking-[0.18em] text-faint">
                    Completed ({completed.length})
                  </span>
                  <span className="h-px flex-1 bg-stroke" />
                  <span className="text-[9px] text-faint">{showCompleted ? 'Hide' : 'Show'}</span>
                </button>
                {showCompleted && (
                  <div className="mt-2 space-y-0.5 opacity-70">
                    {completed.map((milestone) => (
                      <MilestoneRow key={milestone.id} milestone={milestone} onToggle={toggleMilestone} compact />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24">
          <section className="glass rounded-3xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Preparation</p>
                <p className="display num mt-2 text-[2.2rem] leading-none text-ink">{stats.percent}%</p>
                <p className="mt-1 text-[10px] text-faint">
                  {stats.done} complete · {stats.pending} open
                </p>
              </div>
              <ProgressRing value={stats.percent} size={82} stroke={5} color={category.accent}>
                <span className="text-[8px] uppercase tracking-[0.1em] text-faint">
                  {stats.overdue > 0 ? `${stats.overdue} late` : 'on track'}
                </span>
              </ProgressRing>
            </div>
            <dl className="mt-5 space-y-2.5 border-t border-stroke pt-4 text-[10.5px]">
              <div className="flex items-center justify-between">
                <dt className="text-faint">Deadline</dt>
                <dd className="text-ink">{format(new Date(goal.deadline), 'd MMM, h:mm a')}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-faint">Days remaining</dt>
                <dd className="text-ink">{countdown.isPast ? 'Arrived' : `${countdown.days}`}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-faint">Planned focus</dt>
                <dd className="text-ink">{fmtDuration(stats.minutesRemaining)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-faint">Daily reminder</dt>
                <dd className="text-ink">{goal.reminderTime}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-faint">Wallpaper format</dt>
                <dd className="text-ink">{DEVICES.find((device) => device.id === goal.device)?.label ?? 'iPhone'}</dd>
              </div>
            </dl>
          </section>

          <section className="glass rounded-3xl p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">Momentum forecast</p>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[8px] uppercase tracking-[0.12em]"
                style={{ color: forecastMeta.color, background: forecastMeta.bg }}
              >
                <span className="h-1 w-1 rounded-full" style={{ background: forecastMeta.color }} />
                {forecast.label}
              </span>
            </div>
            <p className="display mt-3 text-[1.05rem] leading-snug text-ink">{forecast.summary}</p>
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted">{forecast.capacityNote}</p>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.12em] text-faint">
                <span>Time budget</span>
                <span className="num" style={{ color: forecastMeta.color }}>
                  {capacityPct}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--stroke)]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, capacityPct)}%`,
                    background: forecastMeta.color,
                  }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[8.5px] text-faint">
                <span>Work {fmtDuration(forecast.workloadMinutes)}</span>
                <span>Available {fmtDuration(forecast.availableMinutes)}</span>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-stroke pt-3 text-[10px]">
              <div>
                <dt className="text-faint">Projected finish</dt>
                <dd className="mt-0.5 text-ink">
                  {forecast.projectedFinish ? fmtDateShort(forecast.projectedFinish) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-faint">Needed pace</dt>
                <dd className="mt-0.5 text-ink">
                  {forecast.remaining > 0 ? `${forecast.requiredPerWeek.toFixed(1)}/wk` : 'Complete'}
                </dd>
              </div>
              <div>
                <dt className="text-faint">Daily focus</dt>
                <dd className="mt-0.5 text-ink">
                  {forecast.recommendedDailyMinutes > 0
                    ? fmtDuration(forecast.recommendedDailyMinutes)
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-faint">Recent pace</dt>
                <dd className="mt-0.5 text-ink">
                  {forecast.velocityPerWeek > 0
                    ? `${forecast.velocityPerWeek.toFixed(1)}/wk`
                    : 'No data'}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[9px] leading-relaxed text-faint">{forecast.paceNote}</p>
            <p className="mt-1 text-[9px] leading-relaxed text-faint">{forecast.projectionNote}</p>
            <Link
              to={`/app/planner/${goal.id}`}
              className="mt-3 inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.1em] text-accent hover:opacity-80"
            >
              Adjust the plan
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </section>

          <section className="glass overflow-hidden rounded-3xl">
            {latestDesign ? (
              <>
                <div className="relative">
                  <img
                    src={latestDesign.thumbnail}
                    alt={`Latest wallpaper for ${goal.name}`}
                    className="aspect-[9/14] w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <p className="text-[8px] uppercase tracking-[0.18em] text-white/60">Your latest canvas</p>
                    <p className="mt-1 text-[12px] text-white/90">{latestDesign.name}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 p-4">
                  <Link to={`/app/studio?goal=${goal.id}`} className="text-[10px] uppercase tracking-[0.12em] text-accent hover:opacity-80">
                    Refine design
                  </Link>
                  <Link to={`/app/gallery`} className="text-[10px] text-faint hover:text-ink">
                    Gallery
                  </Link>
                </div>
              </>
            ) : (
              <div className="p-5">
                <div className="flex items-center gap-2 text-accent">
                  <Wand2 className="h-4 w-4" />
                  <p className="eyebrow-bright">Your canvas</p>
                </div>
                <div className="mt-4 flex h-32 items-end justify-center overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(160deg,#243724,#132115_55%,#08100a)] p-4">
                  <div className="text-center">
                    <p className="display num text-4xl leading-none text-[#D9B678]">
                      {countdown.days < 100 ? String(countdown.days).padStart(2, '0') : countdown.days}
                    </p>
                    <p className="mt-1 text-[7px] uppercase tracking-[0.22em] text-[#F8EDDB]/50">days to go</p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted">
                  Turn this countdown into a high-resolution lock screen for your{' '}
                  {DEVICES.find((device) => device.id === goal.device)?.label.toLowerCase()}.
                </p>
                <Link to={`/app/studio?goal=${goal.id}`} className="btn btn-gold btn-sm mt-4 w-full">
                  <Wand2 className="h-3.5 w-3.5" />
                  Open the studio
                </Link>
              </div>
            )}
          </section>

          {goal.plan && (
            <section className="glass-soft rounded-3xl p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="eyebrow">Plan rationale</p>
                <span className="chip">{goal.plan.generatedBy === 'ai' ? 'Gemini' : 'On-device'}</span>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-ink">{goal.plan.summary}</p>
              <p className="mt-2 text-[10.5px] leading-relaxed text-muted">{goal.plan.rationale}</p>
              {goal.plan.answers && goal.plan.answers.length > 0 && (
                <p className="mt-3 border-t border-stroke pt-3 text-[9.5px] leading-relaxed text-faint">
                  Shaped with {goal.plan.answers.length} answer
                  {goal.plan.answers.length === 1 ? '' : 's'} from the planning assistant.
                </p>
              )}
            </section>
          )}

          {goal.notes && (
            <section className="glass-soft rounded-3xl p-5">
              <p className="eyebrow">Your note</p>
              <p className="mt-2.5 text-[11px] leading-relaxed text-muted">{goal.notes}</p>
            </section>
          )}

          <section className="rounded-3xl border border-stroke bg-surface/30 p-5">
            <p className="eyebrow">Manage</p>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => setArchiveOpen(true)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] text-muted transition-colors hover:bg-surface2 hover:text-ink"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive this goal
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] text-faint transition-colors hover:bg-[rgba(255,139,139,0.08)] hover:text-[color:var(--danger)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete goal and designs
              </button>
            </div>
          </section>
        </aside>
      </div>

      <Modal
        open={capsuleSealOpen}
        onClose={() => setCapsuleSealOpen(false)}
        title="Seal this letter?"
        description="The studio will keep it hidden until the deadline. You will not be able to read or edit it before then."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCapsuleSealOpen(false)}>
              Keep writing
            </Button>
            <Button variant="gold" onClick={sealCapsule} icon={<Lock className="h-3.5 w-3.5" />}>
              Seal it for {fmtDateLong(goal.deadline, 'd MMMM')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="max-h-48 overflow-y-auto rounded-2xl border border-accent/20 bg-accent/[0.04] p-4">
            <p className="whitespace-pre-wrap font-display text-[13px] italic leading-relaxed text-ink">
              “{capsuleDraft.trim()}”
            </p>
          </div>
          <p className="text-[9.5px] leading-relaxed text-faint">
            {capsuleDraft.trim().split(/\s+/).filter(Boolean).length} words · sealed on this device. The
            letter becomes readable only when the countdown reaches zero.
          </p>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit the moment"
        description="Changing the deadline updates the countdown immediately. Existing milestones keep their dates."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button variant="gold" onClick={saveEdits}>
              Save changes
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="edit-name">
                Goal name
              </label>
              <input
                id="edit-name"
                className="field"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="edit-deadline">
                  Deadline
                </label>
                <input
                  id="edit-deadline"
                  type="datetime-local"
                  className="field"
                  value={form.deadline}
                  onChange={(event) => setForm({ ...form, deadline: event.target.value })}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="edit-reminder">
                  Daily reminder
                </label>
                <input
                  id="edit-reminder"
                  type="time"
                  className="field"
                  value={form.reminderTime}
                  onChange={(event) => setForm({ ...form, reminderTime: event.target.value })}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="edit-category">
                  Category
                </label>
                <select
                  id="edit-category"
                  className="field"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value as CategoryId })}
                >
                  {CATEGORIES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="edit-importance">
                  Importance
                </label>
                <select
                  id="edit-importance"
                  className="field"
                  value={form.importance}
                  onChange={(event) => setForm({ ...form, importance: event.target.value as Importance })}
                >
                  {IMPORTANCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="edit-prep">
                  Daily preparation
                </label>
                <select
                  id="edit-prep"
                  className="field"
                  value={form.prepMinutes}
                  onChange={(event) => setForm({ ...form, prepMinutes: Number(event.target.value) })}
                >
                  {PREP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} — {option.hint}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="edit-device">
                  Wallpaper device
                </label>
                <select
                  id="edit-device"
                  className="field"
                  value={form.device}
                  onChange={(event) => setForm({ ...form, device: event.target.value as DeviceId })}
                >
                  {DEVICES.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.label} · {device.detail}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="edit-notes">
                Notes
              </label>
              <textarea
                id="edit-notes"
                className="field"
                rows={3}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>
            {formError && <p className="text-[11px] text-[color:var(--danger)]">{formError}</p>}
          </div>
        )}
      </Modal>

      <Modal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archive this countdown?"
        description="It will leave your active dashboard and calendar. Milestones and wallpapers stay on this device."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveOpen(false)}>
              Keep it active
            </Button>
            <Button variant="outline" onClick={archiveGoal} icon={<Archive className="h-3.5 w-3.5" />}>
              Archive goal
            </Button>
          </>
        }
      >
        <div className="rounded-xl border border-stroke bg-surface/50 p-3.5">
          <p className="text-[11px] text-ink">{goal.name}</p>
          <p className="mt-1 text-[9.5px] text-faint">
            {fmtDateShort(goal.deadline)} · {stats.percent}% prepared
          </p>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this countdown?"
        description="This removes the goal, its milestones, its notification history and every saved wallpaper for it. It cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteGoal(goal.id);
                pushToast('Countdown deleted', 'The goal and its designs have been removed from this device.', 'info');
                navigate('/app');
              }}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <div className="rounded-xl border border-[rgba(255,139,139,0.3)] bg-[rgba(255,139,139,0.06)] p-3.5">
          <p className="text-[11px] text-ink">{goal.name}</p>
          <p className="mt-1 text-[9.5px] text-[color:var(--danger)]">
            {own.length} milestones · {designs.filter((design) => design.goalId === goal.id).length} designs
          </p>
        </div>
      </Modal>

      <Modal
        open={celebrating}
        onClose={() => {
          setCelebrating(false);
          setScoreCelebration(false);
        }}
        title="You made it to the moment."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setCelebrating(false);
                setScoreCelebration(false);
              }}
            >
              Close
            </Button>
            {!goal.achievedAt ? (
              <Button
                variant="gold"
                onClick={() => {
                  markGoalAchieved(goal.id);
                  setScoreCelebration(true);
                }}
                icon={<Heart className="h-4 w-4" />}
              >
                {scoreCelebration ? 'Marked achieved' : 'Mark achieved'}
              </Button>
            ) : (
              <Link to={`/app/studio?goal=${goal.id}`} className="btn btn-gold btn-sm">
                <Wand2 className="h-3.5 w-3.5" />
                Design a keepsake
              </Link>
            )}
          </>
        }
      >
        <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-[linear-gradient(150deg,rgba(217,182,120,0.16),rgba(79,124,86,0.14))] p-6 text-center">
          <p className="eyebrow-bright">Countdown complete</p>
          <p className="display mt-3 text-2xl leading-tight text-ink">{goal.name}</p>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            {stats.total > 0
              ? `${stats.done} of ${stats.total} milestones finished. Every deliberate step brought you here.`
              : 'The date arrived exactly as planned. Mark the moment and keep the canvas.'}
          </p>
          <div className="mt-5 flex justify-center gap-1.5">
            {[0, 1, 2, 3, 4].map((index) => (
              <span
                key={index}
                className={cn('h-1.5 w-1.5 rounded-full', index < Math.max(1, Math.round(stats.percent / 20)) ? 'bg-accent' : 'bg-white/20')}
              />
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
);
