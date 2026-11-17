import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addDays, format, setHours, setMinutes, subDays } from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Download,
  Lightbulb,
  ListChecks,
  Plus,
  RefreshCw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { CoachPlan, Goal, Milestone, Priority } from '@/types';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { MilestoneRow } from '@/components/MilestoneRow';
import { ProgressRing } from '@/components/ProgressRing';
import { EmptyState } from '@/components/EmptyState';
import { Toggle } from '@/components/Toggle';
import { categoryOf, PRIORITY_META } from '@/lib/catalog';
import {
  buildLocalCoach,
  buildLocalPlan,
  draftToMilestones,
  getPlanningQuestions,
  nextMilestone,
  offsetForDate,
  rescheduleMilestones,
  suggestMissingMilestones,
  type RescheduleResult,
} from '@/lib/planner';
import { generateCoachWithAI, isAIConfigured } from '@/lib/ai';
import { downloadGoalCalendar } from '@/lib/ics';
import { goalStats } from '@/lib/metrics';
import {
  fmtDateShort,
  fromLocalInput,
  relativeDay,
  toLocalInput,
} from '@/lib/dates';
import { cn, fmtDuration } from '@/lib/utils';

interface EditorProps {
  open: boolean;
  initial: Milestone | null;
  goal: Goal;
  onClose: () => void;
}

const defaultDateFor = (goal: Goal): Date => {
  const [hour, minute] = goal.reminderTime.split(':').map(Number);
  const base = setMinutes(setHours(addDays(new Date(), 3), Number.isFinite(hour) ? hour : 9), Number.isFinite(minute) ? minute : 0);
  return base.getTime() > new Date(goal.deadline).getTime()
    ? new Date(new Date(goal.deadline).getTime() - 60 * 60 * 1000)
    : base;
};

const MilestoneEditor = ({ open, initial, goal, onClose }: EditorProps) => {
  const { addMilestone, updateMilestone, pushToast } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [duration, setDuration] = useState(60);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderLead, setReminderLead] = useState(1440);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setDateTime(toLocalInput(initial?.date ?? defaultDateFor(goal).toISOString()));
    setPriority(initial?.priority ?? 'medium');
    setDuration(initial?.duration ?? goal.prepMinutes);
    setReminderEnabled(initial?.reminderEnabled ?? true);
    setReminderLead(initial?.reminderLead ?? 1440);
    setError(null);
  }, [open, initial, goal]);

  const save = () => {
    if (title.trim().length < 2) {
      setError('Give this milestone a short, clear title.');
      return;
    }
    const date = new Date(dateTime);
    if (Number.isNaN(date.getTime())) {
      setError('Choose a valid date and time.');
      return;
    }
    const iso = fromLocalInput(dateTime);
    if (initial) {
      updateMilestone(initial.id, {
        title: title.trim(),
        description: description.trim(),
        date: iso,
        priority,
        duration,
        reminderEnabled,
        reminderLead,
      });
      pushToast('Milestone updated', 'The plan and countdown have both been refreshed.', 'success');
    } else {
      addMilestone(goal.id, {
        title: title.trim(),
        description: description.trim(),
        date: iso,
        offsetDays: offsetForDate(goal.deadline, iso),
        priority,
        duration,
        done: false,
        reminderEnabled,
        reminderLead,
        generatedBy: 'user',
      });
      pushToast('Milestone added', 'It is now part of the sequence and the countdown.', 'success');
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit the milestone' : 'Add a milestone'}
      description={
        initial
          ? 'Changes update the live countdown and any wallpaper that references this plan.'
          : 'A small, specific step is more useful than a vague ambition.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="gold" onClick={save} icon={<Check className="h-4 w-4" />}>
            {initial ? 'Save changes' : 'Add to the plan'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="field-label" htmlFor="ms-title">
            Task title
          </label>
          <input
            id="ms-title"
            className="field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Final QA and send-ready check"
            maxLength={100}
            autoFocus
          />
        </div>
        <div>
          <label className="field-label" htmlFor="ms-description">
            Description <span className="text-faint">optional</span>
          </label>
          <textarea
            id="ms-description"
            className="field"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What does done look like for this step?"
            maxLength={400}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="ms-date">
              Date and time
            </label>
            <input
              id="ms-date"
              type="datetime-local"
              className="field"
              value={dateTime}
              onChange={(event) => setDateTime(event.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="ms-priority">
              Priority
            </label>
            <select
              id="ms-priority"
              className="field"
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
            >
              {(['critical', 'high', 'medium', 'low'] as Priority[]).map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_META[value].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="ms-duration">
              Estimated duration
            </label>
            <div className="relative">
              <input
                id="ms-duration"
                type="number"
                min={10}
                max={480}
                step={5}
                className="field pr-14"
                value={duration}
                onChange={(event) => setDuration(Math.max(10, Math.min(480, Number(event.target.value))))}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-faint">
                minutes
              </span>
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="ms-lead">
              Reminder
            </label>
            <select
              id="ms-lead"
              className="field"
              value={reminderLead}
              onChange={(event) => setReminderLead(Number(event.target.value))}
              disabled={!reminderEnabled}
            >
              <option value={0}>At the time</option>
              <option value={15}>15 minutes before</option>
              <option value={60}>1 hour before</option>
              <option value={1440}>1 day before</option>
            </select>
          </div>
        </div>
        <Toggle
          checked={reminderEnabled}
          onChange={setReminderEnabled}
          label="Remind me about this milestone"
          description="Adds a browser reminder when notifications are enabled."
        />
        {error && <p className="text-[11px] text-[color:var(--danger)]">{error}</p>}
      </div>
    </Modal>
  );
};

export const Planner = () => {
  const {
    user,
    goals,
    milestones,
    settings,
    toggleMilestone,
    addMilestone,
    deleteMilestone,
    replaceMilestones,
    updateGoal,
    moveMilestone,
    pushToast,
  } = useApp();
  const { goalId } = useParams<{ goalId: string }>();

  const selectableGoals = useMemo(
    () =>
      goals
        .slice()
        .sort((a, b) => {
          if (a.archived !== b.archived) return a.archived ? 1 : -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }),
    [goals],
  );

  const selected = useMemo(
    () => selectableGoals.find((goal) => goal.id === goalId) ?? selectableGoals[0] ?? null,
    [selectableGoals, goalId],
  );

  const own = useMemo(
    () =>
      selected
        ? milestones
            .filter((m) => m.goalId === selected.id)
            .slice()
            .sort(
              (a, b) =>
                a.order - b.order || new Date(a.date).getTime() - new Date(b.date).getTime(),
            )
        : [],
    [milestones, selected],
  );

  const pending = own.filter((m) => !m.done);
  const completed = own.filter((m) => m.done);
  const stats = selected ? goalStats(selected, own) : null;
  const category = selected ? categoryOf(selected.category) : null;
  const next = selected ? nextMilestone(own) : null;

  const localCoach = useMemo(
    () => (selected ? buildLocalCoach(selected, own) : null),
    [selected, own],
  );
  const [remoteCoach, setRemoteCoach] = useState<CoachPlan | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);

  useEffect(() => {
    setRemoteCoach(null);
  }, [selected?.id]);

  const coach = remoteCoach ?? localCoach;
  const aiReady = isAIConfigured(settings);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Milestone | null>(null);
  const [reschedule, setReschedule] = useState<RescheduleResult | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const originals = useMemo(() => new Map(own.map((m) => [m.id, m])), [own]);
  const changes = useMemo(() => {
    if (!reschedule) return [];
    return reschedule.milestones
      .filter((m) => !m.done && originals.get(m.id)?.date !== m.date)
      .map((m) => ({ after: m, before: originals.get(m.id) ?? null }));
  }, [reschedule, originals]);

  const suggestions = useMemo(
    () => (selected ? suggestMissingMilestones(selected, own) : []),
    [selected, own],
  );

  if (!user) return null;

  if (!selected) {
    return (
      <div>
        <PageHeader
          eyebrow="AI planning assistant"
          title="Every plan needs a moment."
          description="Create a deadline first; the assistant will build the runway, coach the week and keep the calendar honest."
          backTo="/app"
        />
        <EmptyState
          icon={ListChecks}
          title="No countdowns yet"
          description="Start with a name and a date. ChronoCanvas will handle the backward schedule and the visual countdown."
          action={
            <Link to="/app/new" className="btn btn-gold">
              <Plus className="h-4 w-4" />
              Create your first goal
            </Link>
          }
        />
      </div>
    );
  }

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (milestone: Milestone) => {
    setEditing(milestone);
    setEditorOpen(true);
  };

  const openReschedule = () => {
    if (!selected) return;
    setReschedule(rescheduleMilestones(selected, own));
    setRescheduleOpen(true);
  };

  const applyReschedule = () => {
    if (!reschedule || !selected) return;
    replaceMilestones(selected.id, reschedule.milestones);
    pushToast('Plan rebalanced', reschedule.summary, 'success');
    setRescheduleOpen(false);
    setReschedule(null);
  };

  const refreshCoach = async () => {
    if (!selected) return;
    if (!aiReady) {
      pushToast('Gemini is not connected', 'Add an API key in settings to refresh the briefing with AI.', 'info');
      return;
    }
    setCoachLoading(true);
    try {
      const result = await generateCoachWithAI(selected, own, settings);
      setRemoteCoach(result);
      pushToast('Briefing refreshed', 'Gemini has read the current plan and reprioritised the day.', 'success');
    } catch (error) {
      pushToast(
        'Gemini coach unavailable',
        error instanceof Error ? error.message : 'The local briefing is still up to date.',
        'error',
      );
    } finally {
      setCoachLoading(false);
    }
  };

  const generateStarterPlan = () => {
    if (!selected) return;
    const draft = buildLocalPlan(selected, selected.plan?.answers ?? []);
    const list = draftToMilestones(selected, draft);
    replaceMilestones(selected.id, list);
    updateGoal(selected.id, {
      plan: {
        summary: draft.summary,
        rationale: draft.rationale,
        questions: selected.plan?.questions ?? getPlanningQuestions(selected),
        answers: selected.plan?.answers ?? [],
        generatedBy: 'local',
        generatedAt: new Date().toISOString(),
      },
    });
    pushToast('Starter plan created', `${list.length} milestones shaped around your deadline.`, 'success');
  };

  const addSuggestion = (suggestion: { title: string; description: string; offset: number; duration: number }) => {
    if (!selected) return;
    const [hour, minute] = selected.reminderTime.split(':').map(Number);
    const deadline = new Date(selected.deadline);
    const target = subDays(deadline, Math.max(0, Math.min(suggestion.offset, Math.max(0, stats?.daysLeft ?? 0))));
    const date = setMinutes(setHours(target, Number.isFinite(hour) ? hour : 9), Number.isFinite(minute) ? minute : 0);
    const iso = date.toISOString();
    const offsetDays = offsetForDate(selected.deadline, iso);
    const priority: Priority = offsetDays <= 3 ? 'critical' : offsetDays <= 7 ? 'high' : 'medium';
    addMilestone(selected.id, {
      title: suggestion.title,
      description: suggestion.description,
      date: iso,
      offsetDays,
      priority,
      duration: suggestion.duration,
      done: false,
      reminderEnabled: true,
      reminderLead: 1440,
      generatedBy: 'user',
    });
    pushToast('Suggestion added', suggestion.title, 'success');
  };

  return (
    <div>
      <PageHeader
        eyebrow="AI planning assistant"
        title="The plan behind the moment."
        description="A living schedule: edit the steps, recover missed work, and ask for a sharper briefing whenever the week changes."
        backTo="/app"
        backLabel="Back to overview"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => downloadGoalCalendar(selected, milestones)}
              icon={<Download className="h-3.5 w-3.5" />}
              disabled={own.length === 0}
            >
              Export .ics
            </Button>
            <Link to={`/app/studio?goal=${selected.id}`} className="btn btn-gold">
              <Wand2 className="h-4 w-4" />
              Design the wallpaper
            </Link>
          </>
        }
      />

      <div className="scroll-thin -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-2">
        {selectableGoals.map((goal) => {
          const goalCategory = categoryOf(goal.category);
          const goalOwn = milestones.filter((m) => m.goalId === goal.id);
          const goalDone = goalOwn.filter((m) => m.done).length;
          const isActive = goal.id === selected.id;
          return (
            <Link
              key={goal.id}
              to={`/app/planner/${goal.id}`}
              className={cn(
                'flex min-w-[190px] shrink-0 items-center gap-3 rounded-2xl border p-3 transition-all',
                isActive
                  ? 'border-accent/50 bg-accent/[0.06]'
                  : 'border-stroke bg-surface/40 hover:border-stroke-strong',
              )}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: goalCategory.soft, color: goalCategory.accent }}
              >
                <goalCategory.icon className="h-4 w-4" strokeWidth={1.6} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="clamp-1 block text-[11px] text-ink">{goal.name}</span>
                <span className="mt-0.5 block text-[9px] text-faint">
                  {goalDone}/{goalOwn.length} done · {relativeDay(goal.deadline)}
                </span>
              </span>
            </Link>
          );
        })}
        <Link
          to="/app/new"
          className="flex min-w-[120px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-stroke p-3 text-faint transition-colors hover:border-accent/40 hover:text-accent"
        >
          <Plus className="h-4 w-4" />
          <span className="text-[9px] uppercase tracking-[0.12em]">New goal</span>
        </Link>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1.55fr_0.95fr]">
        <div className="space-y-5">
          <section className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl"
              style={{ background: category?.accent }}
            />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color: category?.accent }}>
                    {category?.label}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-faint" />
                  <span className="text-[9px] uppercase tracking-[0.16em] text-faint">
                    {format(new Date(selected.deadline), 'd MMMM yyyy')}
                  </span>
                </div>
                <h2 className="display mt-2 text-[1.7rem] leading-tight text-ink">{selected.name}</h2>
                <p className="mt-1 text-[11px] text-muted">
                  {selected.importance === 'professional' ? 'Professional' : 'Personal'} ·{' '}
                  {selected.prepMinutes} min/day · {next ? `next ${relativeDay(next.date)}` : 'no pending steps'}
                </p>
              </div>
              <ProgressRing value={stats?.percent ?? 0} size={82} stroke={5}>
                <span className="num text-base text-ink">{stats?.percent ?? 0}%</span>
                <span className="text-[6.5px] uppercase tracking-[0.14em] text-faint">prepared</span>
              </ProgressRing>
            </div>

            <p className="relative mt-4 max-w-2xl text-[12px] leading-relaxed text-muted">
              {selected.plan?.summary ??
                `A ${own.length}-step runway ending ${fmtDateShort(selected.deadline)}. Every step is editable, and the deadline never moves on its own.`}
            </p>

            <div className="relative mt-5 grid grid-cols-3 gap-2">
              {[
                { label: 'Complete', value: `${stats?.done ?? 0}` },
                { label: 'Pending', value: `${stats?.pending ?? 0}` },
                { label: 'Overdue', value: `${stats?.overdue ?? 0}` },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-stroke bg-surface/40 px-3 py-2.5">
                  <p className="text-[8px] uppercase tracking-[0.16em] text-faint">{item.label}</p>
                  <p className="display num mt-1 text-xl text-ink">{item.value}</p>
                </div>
              ))}
            </div>

            {selected.plan?.rationale && (
              <p className="relative mt-4 border-l border-accent/30 pl-3 text-[10.5px] leading-relaxed text-faint">
                {selected.plan.rationale}
              </p>
            )}
          </section>

          <section className="glass rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow-bright">The sequence</p>
                <h3 className="display mt-1.5 text-xl text-ink">
                  {pending.length} step{pending.length === 1 ? '' : 's'} remaining
                </h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={openNew}
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                Add milestone
              </Button>
            </div>

            <div className="mt-4 space-y-0.5">
              {pending.map((milestone, index) => (
                <MilestoneRow
                  key={milestone.id}
                  milestone={milestone}
                  onToggle={toggleMilestone}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                  onMoveUp={index > 0 ? () => moveMilestone(selected.id, milestone.id, -1) : undefined}
                  onMoveDown={
                    index < pending.length - 1
                      ? () => moveMilestone(selected.id, milestone.id, 1)
                      : undefined
                  }
                />
              ))}
            </div>

            {pending.length === 0 && (
              <div className="mt-4">
                <EmptyState
                  compact
                  icon={Sparkles}
                  title={completed.length > 0 ? 'Every milestone is complete' : 'This plan has no steps yet'}
                  description={
                    completed.length > 0
                      ? 'The runway is clear. Add a final reflection, or celebrate and mark the goal achieved.'
                      : 'Ask the on-device planner for a starter runway, or add the first step yourself.'
                  }
                  action={
                    completed.length === 0 ? (
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button variant="gold" size="sm" onClick={generateStarterPlan} icon={<Sparkles className="h-3.5 w-3.5" />}>
                          Build a starter plan
                        </Button>
                        <Button variant="outline" size="sm" onClick={openNew} icon={<Plus className="h-3.5 w-3.5" />}>
                          Add manually
                        </Button>
                      </div>
                    ) : (
                      <Link to={`/app/goal/${selected.id}`} className="btn btn-outline btn-sm">
                        Open the countdown
                      </Link>
                    )
                  }
                />
              </div>
            )}

            {completed.length > 0 && (
              <div className="mt-6">
                <div className="mb-2 flex items-center gap-3">
                  <p className="text-[8px] uppercase tracking-[0.2em] text-faint">Completed</p>
                  <span className="h-px flex-1 bg-stroke" />
                  <span className="text-[8px] text-faint">{completed.length}</span>
                </div>
                <div className="space-y-0.5 opacity-75">
                  {completed.map((milestone) => (
                    <MilestoneRow
                      key={milestone.id}
                      milestone={milestone}
                      onToggle={toggleMilestone}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24">
          {coach && (
            <section className="glass rounded-3xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow-bright">Today's briefing</p>
                  <p className="mt-1 text-[9px] text-faint">
                    {coach.generatedBy === 'ai' ? 'From Gemini' : 'From the on-device coach'}
                  </p>
                </div>
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
              <h3 className="display mt-4 text-[1.2rem] leading-snug text-ink">{coach.headline}</h3>
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted">{coach.body}</p>

              <div className="mt-4 space-y-2">
                {coach.priorities.map((priority) => {
                  const item = own.find((m) => m.id === priority.milestoneId);
                  if (!item) return null;
                  return (
                    <button
                      key={priority.milestoneId}
                      type="button"
                      onClick={() => toggleMilestone(item.id)}
                      className="flex w-full items-start gap-2.5 rounded-xl border border-stroke bg-surface/40 p-2.5 text-left transition-colors hover:border-accent/40"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-stroke-strong text-transparent hover:border-accent hover:text-accent">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] leading-snug text-ink">{priority.label}</span>
                        <span className="mt-0.5 block text-[9px] text-faint">{priority.why}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 border-t border-stroke pt-3 text-[10px] italic leading-relaxed text-faint">
                “{coach.tip}”
              </p>

              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => void refreshCoach()}
                  disabled={coachLoading}
                  className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-accent transition-opacity hover:opacity-75 disabled:opacity-40"
                >
                  <RefreshCw className={cn('h-3 w-3', coachLoading && 'animate-spin')} />
                  {aiReady ? 'Refresh with Gemini' : 'Gemini not connected'}
                </button>
                {!aiReady && (
                  <Link to="/app/settings" className="text-[9px] text-faint hover:text-ink">
                    Settings →
                  </Link>
                )}
              </div>
            </section>
          )}

          <section className="glass rounded-3xl p-5">
            <p className="eyebrow">Recovery & suggestions</p>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={openReschedule}
                className="flex w-full items-start gap-3 rounded-xl border border-stroke bg-surface/40 p-3 text-left transition-colors hover:border-accent/40"
              >
                <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>
                  <span className="block text-[11.5px] text-ink">Rebalance the remaining work</span>
                  <span className="mt-0.5 block text-[9.5px] leading-relaxed text-faint">
                    Missed a step? Redistribute what is left without moving the deadline.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSuggestionsOpen(true)}
                className="flex w-full items-start gap-3 rounded-xl border border-stroke bg-surface/40 p-3 text-left transition-colors hover:border-accent/40"
              >
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>
                  <span className="block text-[11.5px] text-ink">Suggest forgotten milestones</span>
                  <span className="mt-0.5 block text-[9.5px] leading-relaxed text-faint">
                    Category-aware steps people commonly leave too late.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={openNew}
                className="flex w-full items-start gap-3 rounded-xl border border-stroke bg-surface/40 p-3 text-left transition-colors hover:border-accent/40"
              >
                <Plus className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>
                  <span className="block text-[11.5px] text-ink">Add your own step</span>
                  <span className="mt-0.5 block text-[9.5px] leading-relaxed text-faint">
                    Give it a date, duration, priority and reminder.
                  </span>
                </span>
              </button>
            </div>
          </section>

          <section className="glass-soft rounded-3xl p-5">
            <p className="eyebrow">Plan details</p>
            <dl className="mt-3 space-y-2.5 text-[10.5px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-faint">Deadline</dt>
                <dd className="text-right text-ink">{format(new Date(selected.deadline), 'EEE d MMM, h:mm a')}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-faint">Time remaining</dt>
                <dd className="text-ink">
                  {stats && stats.daysLeft >= 0 ? `${stats.daysLeft} days` : 'Deadline passed'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-faint">Planned focus</dt>
                <dd className="text-ink">{fmtDuration(stats?.minutesRemaining ?? 0)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-faint">Generated by</dt>
                <dd className="text-ink">
                  {selected.plan?.generatedBy === 'ai' ? 'Gemini' : selected.plan ? 'On-device planner' : 'Manual'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-faint">Reminder rhythm</dt>
                <dd className="text-ink">{selected.reminderTime} daily</dd>
              </div>
            </dl>
            {selected.plan?.questions && selected.plan.questions.length > 0 && (
              <details className="mt-4 border-t border-stroke pt-3">
                <summary className="cursor-pointer text-[9px] uppercase tracking-[0.14em] text-faint hover:text-ink">
                  Planner context ({selected.plan.questions.length})
                </summary>
                <div className="mt-2.5 space-y-2">
                  {selected.plan.questions.map((question, index) => (
                    <div key={question}>
                      <p className="text-[9.5px] leading-relaxed text-muted">{question}</p>
                      <p className="mt-0.5 text-[9.5px] text-ink">
                        {selected.plan?.answers?.[index] || 'Skipped'}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            )}
            <Link
              to={`/app/goal/${selected.id}`}
              className="mt-4 inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-muted hover:text-ink"
            >
              Open live countdown
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </section>
        </aside>
      </div>

      <MilestoneEditor
        open={editorOpen}
        initial={editing}
        goal={selected}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
      />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Remove this milestone?"
        description="The countdown and progress will update immediately. This cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleteTarget) return;
                deleteMilestone(deleteTarget.id);
                pushToast('Milestone removed', deleteTarget.title, 'info');
                setDeleteTarget(null);
              }}
            >
              Remove milestone
            </Button>
          </>
        }
      >
        <div className="rounded-xl border border-stroke bg-surface/50 p-3.5">
          <p className="text-[11px] text-ink">{deleteTarget?.title}</p>
          <p className="mt-1 text-[9.5px] text-faint">
            {deleteTarget ? `${fmtDateShort(deleteTarget.date)} · ${fmtDuration(deleteTarget.duration)}` : ''}
          </p>
        </div>
      </Modal>

      <Modal
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        title="Rebalance the runway"
        description="Completed work stays untouched. The deadline does not move. Only the remaining steps are restaged."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRescheduleOpen(false)}>
              Not now
            </Button>
            <Button variant="gold" onClick={applyReschedule} disabled={!reschedule || changes.length === 0}>
              Apply the new schedule
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="rounded-xl border border-stroke bg-surface/50 p-3 text-[11px] leading-relaxed text-ink">
            {reschedule?.summary}
          </p>
          {changes.length > 0 ? (
            <div className="scroll-thin max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
              {changes.map((change) => (
                <div
                  key={change.after.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-stroke bg-surface/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="clamp-1 text-[10.5px] text-ink">{change.after.title}</p>
                    <p className="mt-0.5 text-[8.5px] text-faint">
                      {change.before ? fmtDateShort(change.before.date) : 'New'} →{' '}
                      {fmtDateShort(change.after.date)} · T-{change.after.offsetDays}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.08em] text-accent">
                    moved
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-stroke p-3 text-[10.5px] text-muted">
              <Check className="h-3.5 w-3.5 text-[color:var(--success)]" />
              Your current schedule already fits the remaining time.
            </div>
          )}
          <p className="text-[9.5px] leading-relaxed text-faint">
            Rescheduling keeps every completed step exactly where it is, preserves the original final
            deadline, and raises the priority of anything that had slipped.
          </p>
        </div>
      </Modal>

      <Modal
        open={suggestionsOpen}
        onClose={() => setSuggestionsOpen(false)}
        title="What might be missing?"
        description="These are common blind spots for this kind of deadline. Add only what earns its place."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuggestionsOpen(false)}>
              Close
            </Button>
            {suggestions.length > 0 && (
              <Button
                variant="gold"
                onClick={() => {
                  suggestions.forEach(addSuggestion);
                  setSuggestionsOpen(false);
                }}
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                Add all {suggestions.length}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-2">
          {suggestions.map((suggestion) => (
            <div key={suggestion.title} className="rounded-xl border border-stroke bg-surface/40 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11.5px] leading-snug text-ink">{suggestion.title}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-faint">{suggestion.description}</p>
                  <p className="mt-2 flex items-center gap-3 text-[8.5px] uppercase tracking-[0.1em] text-faint">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-2.5 w-2.5" /> T-{suggestion.offset}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-2.5 w-2.5" /> {fmtDuration(suggestion.duration)}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addSuggestion(suggestion)}
                  className="icon-btn h-8 w-8 shrink-0"
                  aria-label={`Add ${suggestion.title}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {suggestions.length === 0 && (
            <div className="rounded-xl border border-stroke bg-surface/40 p-5 text-center text-[11px] text-muted">
              You already cover the usual blind spots for this category. Add any remaining detail manually.
            </div>
          )}
        </div>
      </Modal>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link to="/app" className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-faint hover:text-ink">
          <ArrowLeft className="h-3 w-3" />
          Overview
        </Link>
        <div className="flex items-center gap-3">
          <Link to={`/app/calendar`} className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-faint hover:text-ink">
            <CalendarDays className="h-3 w-3" />
            Calendar
          </Link>
          <Link to={`/app/goal/${selected.id}`} className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-accent hover:opacity-80">
            Countdown
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};
