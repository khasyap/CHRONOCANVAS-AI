import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDays, format, subDays } from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CircleAlert,
  Laptop,
  Loader2,
  Monitor,
  Plus,
  Smartphone,
  Sparkles,
  Tablet,
  Wand2,
} from 'lucide-react';
import type {
  CategoryId,
  DeviceId,
  Goal,
  Importance,
  Milestone,
  PlanDraft,
  Priority,
} from '@/types';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { CATEGORIES, DEVICES, PREP_OPTIONS, categoryOf, PRIORITY_META } from '@/lib/catalog';
import {
  buildLocalPlan,
  draftToMilestones,
  getPlanningQuestions,
} from '@/lib/planner';
import { generatePlanWithAI, generateQuestionsWithAI, isAIConfigured } from '@/lib/ai';
import { fmtDateShort, getCountdown, pad2, uid } from '@/lib/dates';
import { cn } from '@/lib/utils';

interface FormState {
  name: string;
  date: string;
  time: string;
  category: CategoryId;
  importance: Importance;
  prepMinutes: number;
  reminderTime: string;
  device: DeviceId;
  notes: string;
}

const deviceIcons = {
  iphone: Smartphone,
  android: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
  laptop: Laptop,
};

const steps = [
  { id: 1, label: 'The moment' },
  { id: 2, label: 'The rhythm' },
  { id: 3, label: 'The plan' },
];

const priorityTone = (priority: Priority): string => PRIORITY_META[priority].color;

export const CreateGoal = () => {
  const { user, settings, createGoal, pushToast } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(() => ({
    name: '',
    date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    time: '18:00',
    category: 'project',
    importance: 'professional',
    prepMinutes: 60,
    reminderTime: '09:00',
    device: settings.defaultDevice,
    notes: '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [questionsStatus, setQuestionsStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [plan, setPlan] = useState<PlanDraft | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const deadlineIso = useMemo(() => {
    const date = new Date(`${form.date}T${form.time || '18:00'}`);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }, [form.date, form.time]);

  const deadlineDate = useMemo(() => new Date(deadlineIso), [deadlineIso]);
  const category = categoryOf(form.category);
  const countdown = getCountdown(deadlineIso);
  const aiReady = isAIConfigured(settings);

  const buildTempGoal = useCallback(
    (id = 'draft'): Goal => ({
      id,
      name: form.name.trim() || 'Untitled moment',
      deadline: deadlineIso,
      category: form.category,
      importance: form.importance,
      prepMinutes: form.prepMinutes,
      reminderTime: form.reminderTime,
      device: form.device,
      notes: form.notes.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
    }),
    [form, deadlineIso],
  );

  const loadQuestions = useCallback(async () => {
    if (questionsStatus !== 'idle') return;
    setQuestionsStatus('loading');
    setAiNote(null);
    const temp = buildTempGoal();
    if (aiReady) {
      try {
        const generated = await generateQuestionsWithAI(temp, settings);
        setQuestions(generated);
        setAnswers(generated.map(() => ''));
        setQuestionsStatus('ready');
        return;
      } catch (error) {
        setAiNote(
          `${error instanceof Error ? error.message : 'Gemini could not be reached.'} Using the on-device questions instead.`,
        );
      }
    }
    const local = getPlanningQuestions(temp);
    setQuestions(local);
    setAnswers(local.map(() => ''));
    setQuestionsStatus('ready');
  }, [questionsStatus, buildTempGoal, aiReady, settings]);

  useEffect(() => {
    if (step === 3) void loadQuestions();
  }, [step, loadQuestions]);

  useEffect(() => {
    setQuestionsStatus('idle');
    setQuestions([]);
    setAnswers([]);
    setPlan(null);
    setAiNote(null);
  }, [form.category, form.importance, form.prepMinutes, form.device]);

  const validateStep = (current: number): boolean => {
    const next: Record<string, string> = {};
    if (current === 1) {
      if (form.name.trim().length < 3) next.name = 'Give the moment a name of at least 3 characters.';
      if (Number.isNaN(deadlineDate.getTime())) next.deadline = 'Choose a valid date and time.';
      else if (deadlineDate.getTime() <= Date.now()) next.deadline = 'The deadline needs to be in the future.';
    }
    if (current === 2) {
      if (!form.reminderTime) next.reminder = 'Choose a reminder time.';
      if (![30, 60, 120, 240].includes(form.prepMinutes)) next.prep = 'Choose a preparation rhythm.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const next = () => {
    if (!validateStep(step)) return;
    setStep((value) => Math.min(3, value + 1));
  };

  const back = () => setStep((value) => Math.max(1, value - 1));

  const generatePlan = async () => {
    setPlanLoading(true);
    setAiNote(null);
    const temp = buildTempGoal();
    const cleanedAnswers = answers.map((answer) => answer.trim()).filter(Boolean);
    try {
      if (aiReady) {
        const draft = await generatePlanWithAI(temp, cleanedAnswers, settings);
        setPlan(draft);
      } else {
        setPlan(buildLocalPlan(temp, cleanedAnswers));
      }
    } catch (error) {
      setAiNote(
        `${error instanceof Error ? error.message : 'Gemini could not build the plan.'} Falling back to the on-device planner.`,
      );
      setPlan(buildLocalPlan(temp, cleanedAnswers));
    } finally {
      setPlanLoading(false);
    }
  };

  const create = () => {
    if (!plan) return;
    setCreating(true);
    const goal = buildTempGoal(uid('goal'));
    const finalGoal: Goal = {
      ...goal,
      plan: {
        summary: plan.summary,
        rationale: plan.rationale,
        questions,
        answers: answers.map((answer) => answer.trim()).filter(Boolean),
        generatedBy: plan.generatedBy,
        generatedAt: new Date().toISOString(),
      },
    };
    const milestones: Milestone[] = draftToMilestones(finalGoal, plan);
    createGoal(finalGoal, milestones);
    pushToast(
      'Your countdown is live',
      `${milestones.length} milestones planned. The wallpapers are waiting in the studio.`,
      'success',
    );
    navigate(`/app/goal/${finalGoal.id}`);
  };

  if (!user) return null;

  return (
    <div>
      <PageHeader
        eyebrow="New countdown"
        title="Give the moment a plan."
        description="Three short steps. The planner handles the backward schedule; you keep the final say on every step."
        backTo="/app"
        backLabel="Back to overview"
      />

      <div className="mb-7 flex items-center">
        {steps.map((item, index) => (
          <div key={item.id} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              onClick={() => {
                if (item.id < step) setStep(item.id);
                else if (item.id === step + 1) next();
              }}
              className="group flex items-center gap-2.5"
              aria-current={step === item.id ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border text-[11px] transition-all',
                  step > item.id
                    ? 'border-accent bg-accent text-[color:var(--accent-ink)]'
                    : step === item.id
                      ? 'border-accent text-accent'
                      : 'border-stroke text-faint',
                )}
              >
                {step > item.id ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : item.id}
              </span>
              <span
                className={cn(
                  'hidden text-[10px] uppercase tracking-[0.16em] sm:block',
                  step === item.id ? 'text-ink' : 'text-faint',
                )}
              >
                {item.label}
              </span>
            </button>
            {index < steps.length - 1 && (
              <div className="mx-3 h-px flex-1 bg-[color:var(--stroke)] sm:mx-4">
                <div
                  className="h-px bg-accent transition-all duration-500"
                  style={{ width: step > item.id ? '100%' : '0%' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1.55fr_0.9fr]">
        <div className="glass rounded-4xl p-6 sm:p-8">
          {step === 1 && (
            <div className="page-enter">
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-accent">
                <span className="h-1 w-1 rounded-full bg-accent" />
                Step one
              </div>
              <h2 className="display mt-3 text-2xl text-ink sm:text-[1.8rem]">What are you counting toward?</h2>

              <div className="mt-7 space-y-6">
                <div>
                  <label className="field-label" htmlFor="goal-name">
                    Goal or event name <span className="text-faint">required</span>
                  </label>
                  <input
                    id="goal-name"
                    className={cn('field', errors.name && 'field-error')}
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Aurora Product Launch"
                    maxLength={80}
                    autoFocus
                  />
                  <div className="mt-1.5 flex items-center justify-between">
                    {errors.name ? (
                      <p className="text-[10.5px] text-[color:var(--danger)]">{errors.name}</p>
                    ) : (
                      <p className="text-[10px] text-faint">You can refine this any time.</p>
                    )}
                    <span className="text-[9px] text-faint">{form.name.length}/80</span>
                  </div>
                </div>

                <div>
                  <p className="field-label">Category</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {CATEGORIES.map((item) => {
                      const selected = form.category === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, category: item.id }))}
                          className={cn(
                            'flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all',
                            selected
                              ? 'border-accent/60 bg-accent/[0.07]'
                              : 'border-stroke bg-surface/40 hover:border-stroke-strong',
                          )}
                        >
                          <item.icon
                            className="h-4 w-4"
                            style={{ color: selected ? item.accent : 'var(--muted)' }}
                            strokeWidth={1.6}
                          />
                          <span className={cn('text-[10px] leading-tight', selected ? 'text-ink' : 'text-muted')}>
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="field-label" htmlFor="goal-date">
                      Deadline date
                    </label>
                    <input
                      id="goal-date"
                      type="date"
                      className={cn('field', errors.deadline && 'field-error')}
                      value={form.date}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="goal-time">
                      Time
                    </label>
                    <input
                      id="goal-time"
                      type="time"
                      className="field"
                      value={form.time}
                      onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))}
                    />
                  </div>
                </div>
                {errors.deadline && (
                  <p className="-mt-3 flex items-center gap-1.5 text-[10.5px] text-[color:var(--danger)]">
                    <CircleAlert className="h-3 w-3" />
                    {errors.deadline}
                  </p>
                )}

                <div>
                  <p className="field-label">Importance</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      {
                        value: 'personal' as const,
                        label: 'Personal',
                        hint: 'Meaningful to you, your people, or your own rhythm.',
                      },
                      {
                        value: 'professional' as const,
                        label: 'Professional',
                        hint: 'Tied to work, reputation, or a team commitment.',
                      },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, importance: option.value }))}
                        className={cn(
                          'rounded-xl border p-3.5 text-left transition-all',
                          form.importance === option.value
                            ? 'border-accent/60 bg-accent/[0.06]'
                            : 'border-stroke bg-surface/40 hover:border-stroke-strong',
                        )}
                      >
                        <p className="text-[12px] text-ink">{option.label}</p>
                        <p className="mt-1 text-[10px] leading-relaxed text-faint">{option.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="page-enter">
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-accent">
                <span className="h-1 w-1 rounded-full bg-accent" />
                Step two
              </div>
              <h2 className="display mt-3 text-2xl text-ink sm:text-[1.8rem]">How much time can you truly give it?</h2>
              <p className="mt-2 max-w-lg text-[12px] leading-relaxed text-muted">
                Realistic beats heroic. The planner sizes each milestone around this rhythm.
              </p>

              <div className="mt-7 space-y-6">
                <div>
                  <p className="field-label">Available preparation</p>
                  <div className="grid gap-2 sm:grid-cols-4">
                    {PREP_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, prepMinutes: option.value }))}
                        className={cn(
                          'rounded-xl border p-3 text-left transition-all',
                          form.prepMinutes === option.value
                            ? 'border-accent/60 bg-accent/[0.07]'
                            : 'border-stroke bg-surface/40 hover:border-stroke-strong',
                        )}
                      >
                        <p className="text-[12px] text-ink">{option.label}</p>
                        <p className="mt-1 text-[9.5px] leading-relaxed text-faint">{option.hint}</p>
                      </button>
                    ))}
                  </div>
                  {errors.prep && <p className="mt-2 text-[10.5px] text-[color:var(--danger)]">{errors.prep}</p>}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="field-label" htmlFor="reminder-time">
                      Preferred reminder time
                    </label>
                    <input
                      id="reminder-time"
                      type="time"
                      className={cn('field', errors.reminder && 'field-error')}
                      value={form.reminderTime}
                      onChange={(event) => setForm((prev) => ({ ...prev, reminderTime: event.target.value }))}
                    />
                    <p className="mt-1.5 text-[10px] text-faint">When a daily briefing should find you.</p>
                  </div>
                  <div>
                    <p className="field-label">Countdown wallpaper device</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {DEVICES.map((device) => {
                        const Icon = deviceIcons[device.id];
                        const selected = form.device === device.id;
                        return (
                          <button
                            key={device.id}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, device: device.id }))}
                            className={cn(
                              'flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 transition-all',
                              selected
                                ? 'border-accent/60 bg-accent/[0.07] text-accent'
                                : 'border-stroke bg-surface/40 text-faint hover:border-stroke-strong',
                            )}
                            title={device.label}
                          >
                            <Icon className="h-4 w-4" strokeWidth={1.6} />
                            <span className="text-[8px] uppercase tracking-[0.06em]">{device.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="field-label" htmlFor="goal-notes">
                    Context for the planner <span className="text-faint">optional</span>
                  </label>
                  <textarea
                    id="goal-notes"
                    className="field"
                    rows={4}
                    value={form.notes}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="What does done look like? What has stopped you before? Anything the planner should know about the week of the deadline…"
                    maxLength={600}
                  />
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-faint">
                    <span>This becomes part of the plan's context.</span>
                    <span>{form.notes.length}/600</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-xl border border-stroke bg-surface/40 p-3.5">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <p className="text-[10.5px] leading-relaxed text-faint">
                    Estimated preparation before the deadline: about{' '}
                    <span className="text-ink">
                      {Math.max(0, countdown.days) * form.prepMinutes >= 60
                        ? `${Math.round((Math.max(0, countdown.days) * form.prepMinutes) / 60)} hours`
                        : `${Math.max(0, countdown.days) * form.prepMinutes} minutes`}
                    </span>{' '}
                    across {Math.max(0, countdown.days)} days. The plan will stay inside this rhythm.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="page-enter">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-accent">
                  <span className="h-1 w-1 rounded-full bg-accent" />
                  Step three
                </div>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[8px] uppercase tracking-[0.14em]',
                    aiReady
                      ? 'border-accent/30 bg-accent/10 text-accent'
                      : 'border-stroke text-faint',
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  {aiReady ? 'Gemini connected' : 'On-device planner'}
                </span>
              </div>
              <h2 className="display mt-3 text-2xl text-ink sm:text-[1.8rem]">
                {plan ? 'A plan shaped around the date.' : 'A few questions, then a plan.'}
              </h2>
              <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-muted">
                {plan
                  ? 'Every step is editable after you create the goal. This is a starting shape, not a contract.'
                  : 'A little context produces a much sharper schedule. You can skip any question.'}
              </p>

              {!plan && (
                <>
                  {questionsStatus === 'loading' && (
                    <div className="mt-7 space-y-3">
                      {[0, 1, 2].map((index) => (
                        <div key={index} className="rounded-xl border border-stroke bg-surface/40 p-4">
                          <div className="skeleton h-3 w-2/3" />
                          <div className="skeleton mt-3 h-12 w-full" />
                        </div>
                      ))}
                      <p className="flex items-center justify-center gap-2 text-[10px] text-faint">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Reading the shape of this deadline…
                      </p>
                    </div>
                  )}

                  {aiNote && (
                    <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[rgba(232,194,123,0.3)] bg-[rgba(232,194,123,0.08)] p-3.5">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning)]" />
                      <div>
                        <p className="text-[11px] leading-relaxed text-[color:var(--warning)]">{aiNote}</p>
                        <Link to="/app/settings" className="mt-1.5 inline-block text-[10px] text-accent">
                          Review AI settings
                        </Link>
                      </div>
                    </div>
                  )}

                  {questionsStatus === 'ready' && (
                    <div className="mt-7 space-y-4">
                      {questions.map((question, index) => (
                        <div key={question}>
                          <label className="mb-2 flex items-start gap-2 text-[11.5px] text-ink" htmlFor={`question-${index}`}>
                            <span className="mt-0.5 font-mono text-[9px] text-accent">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            {question}
                          </label>
                          <textarea
                            id={`question-${index}`}
                            rows={2}
                            className="field"
                            value={answers[index] ?? ''}
                            onChange={(event) =>
                              setAnswers((prev) => {
                                const nextAnswers = [...prev];
                                nextAnswers[index] = event.target.value;
                                return nextAnswers;
                              })
                            }
                            placeholder="A sentence is enough…"
                          />
                        </div>
                      ))}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          type="button"
                          variant="gold"
                          onClick={() => void generatePlan()}
                          loading={planLoading}
                          icon={!planLoading ? <Wand2 className="h-4 w-4" /> : undefined}
                        >
                          {planLoading ? 'Shaping your plan…' : 'Generate my plan'}
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            setAnswers(questions.map(() => ''));
                            void generatePlan();
                          }}
                          disabled={planLoading}
                          className="btn btn-ghost btn-sm text-muted"
                        >
                          Skip questions and plan now
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {plan && (
                <div className="mt-6">
                  <div className="rounded-2xl border border-stroke bg-surface/50 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-accent">
                        {plan.generatedBy === 'ai' ? 'Gemini plan' : 'On-device plan'}
                      </p>
                      <span className="text-[9px] text-faint">
                        {plan.milestones.length} milestones · deadline fixed
                      </span>
                    </div>
                    <p className="mt-3 text-[12.5px] leading-relaxed text-ink">{plan.summary}</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-muted">{plan.rationale}</p>
                  </div>

                  <div className="mt-4 space-y-2">
                    {plan.milestones.map((milestone, index) => {
                      const date = subDays(deadlineDate, milestone.offsetDays);
                      return (
                        <div
                          key={`${milestone.title}-${index}`}
                          className="flex items-start gap-3 rounded-xl border border-stroke bg-surface/30 p-3"
                        >
                          <span className="mt-0.5 w-9 shrink-0 rounded-md border border-stroke px-1 py-0.5 text-center font-mono text-[8px] text-accent">
                            T-{milestone.offsetDays}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11.5px] leading-snug text-ink">{milestone.title}</p>
                            <p className="mt-0.5 clamp-1 text-[10px] text-faint">{milestone.description}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[9px] text-muted">{fmtDateShort(date)}</p>
                            <p
                              className="mt-1 text-[8px] uppercase tracking-[0.08em]"
                              style={{ color: priorityTone(milestone.priority) }}
                            >
                              {PRIORITY_META[milestone.priority].label}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <Button variant="gold" onClick={create} loading={creating} icon={<Check className="h-4 w-4" />}>
                      Create the countdown
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPlan(null);
                        setQuestionsStatus('idle');
                        void loadQuestions();
                      }}
                    >
                      Start the questions again
                    </Button>
                  </div>
                  <p className="mt-3 text-[9.5px] text-faint">
                    You can edit, reorder, delete or add milestones once the goal is created.
                  </p>
                </div>
              )}
            </div>
          )}

          {step < 3 && (
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-stroke pt-5">
              <button
                type="button"
                onClick={step === 1 ? () => navigate('/app') : back}
                className="btn btn-ghost btn-sm text-muted"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {step === 1 ? 'Cancel' : 'Back'}
              </button>
              <Button type="button" variant="gold" onClick={next} iconRight={<ArrowRight className="h-4 w-4" />}>
                {step === 1 ? 'Set the rhythm' : 'Shape my plan'}
              </Button>
            </div>
          )}
          {step === 3 && !plan && (
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-stroke pt-5">
              <button type="button" onClick={back} className="btn btn-ghost btn-sm text-muted">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <p className="text-[9.5px] text-faint">Nothing is saved until you create the countdown.</p>
            </div>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24">
          <div className="glass overflow-hidden rounded-3xl p-3">
            <div
              className="relative overflow-hidden rounded-2xl p-5"
              style={{
                background: `linear-gradient(160deg, ${category.accent}2e, var(--elevated) 55%, var(--bg-deep))`,
                minHeight: 310,
              }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full opacity-40 blur-3xl"
                style={{ background: category.accent }}
              />
              <div className="relative flex h-full flex-col">
                <p className="text-[8px] uppercase tracking-[0.24em] text-accent">Countdown to</p>
                <p className="display mt-2 clamp-2 text-[1.35rem] leading-tight text-ink">
                  {form.name.trim() || 'Your next big moment'}
                </p>
                <p className="mt-1.5 text-[9px] uppercase tracking-[0.14em] text-faint">
                  {deadlineDate ? format(deadlineDate, 'd MMMM yyyy') : 'Choose a date'} · {category.short}
                </p>

                <div className="mt-auto pt-8">
                  <p className="display num text-[3.8rem] leading-none text-gold-gradient">
                    {countdown.days < 100 ? pad2(countdown.days) : countdown.days}
                  </p>
                  <p className="mt-1.5 text-[8px] uppercase tracking-[0.22em] text-faint">
                    {countdown.days === 1 ? 'day to go' : 'days to go'}
                  </p>
                  <p className="display mt-3 text-base text-ink/85">
                    {pad2(countdown.hours)}{' '}
                    <span className="text-[8px] uppercase tracking-[0.16em] text-faint">hrs</span>{' '}
                    {pad2(countdown.minutes)}{' '}
                    <span className="text-[8px] uppercase tracking-[0.16em] text-faint">min</span>
                  </p>
                  <div className="mt-5 h-[2px] overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-0 rounded-full bg-accent" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-2 py-3">
              <span className="text-[8px] uppercase tracking-[0.16em] text-faint">A live preview</span>
              <div className="flex gap-1">
                {categoryOf(form.category).accent && (
                  <>
                    <span className="h-3 w-3 rounded-full border border-white/20" style={{ background: category.accent }} />
                    <span className="h-3 w-3 rounded-full border border-white/20 bg-[#D9B678]" />
                    <span className="h-3 w-3 rounded-full border border-white/20 bg-[#A9C0A4]" />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="glass-soft rounded-2xl p-4">
            <p className="eyebrow">What happens next</p>
            <div className="mt-3 space-y-2.5">
              {[
                { icon: Sparkles, text: 'A backward plan with editable milestones' },
                { icon: CalendarDays, text: 'A calendar-ready schedule and reminders' },
                { icon: Wand2, text: 'A high-resolution countdown wallpaper' },
                { icon: Smartphone, text: `Designed for your ${DEVICES.find((d) => d.id === form.device)?.label}` },
              ].map((item) => (
                <div key={item.text} className="flex items-start gap-2.5">
                  <item.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.7} />
                  <span className="text-[10.5px] leading-relaxed text-muted">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl border border-stroke bg-surface/40 p-4">
            <Plus className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
            <p className="text-[10px] leading-relaxed text-faint">
              Everything is stored privately on this device. You can export a backup from settings at any
              time.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
