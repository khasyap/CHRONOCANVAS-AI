import { useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  CalendarClock,
  CheckCheck,
  CircleDot,
  Info,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import type { LogKind } from '@/types';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { NotificationPreferences } from '@/components/NotificationPreferences';
import { EmptyState } from '@/components/EmptyState';
import { nextMilestone } from '@/lib/planner';
import { notificationPermission, notificationsSupported } from '@/lib/notifications';
import { fmtDateShort, nextOccurrence, parse, relativeDay } from '@/lib/dates';
import { cn } from '@/lib/utils';

const kindMeta: Record<LogKind, { icon: typeof Bell; label: string; color: string; bg: string }> = {
  daily: { icon: Sparkles, label: 'Briefing', color: 'var(--accent)', bg: 'rgba(217,182,120,0.12)' },
  milestone: { icon: CalendarClock, label: 'Milestone', color: 'var(--lavender)', bg: 'rgba(169,192,164,0.12)' },
  overdue: { icon: TriangleAlert, label: 'Overdue', color: 'var(--danger)', bg: 'rgba(255,139,139,0.12)' },
  deadline: { icon: BellRing, label: 'Deadline', color: 'var(--warning)', bg: 'rgba(232,194,123,0.12)' },
  system: { icon: Info, label: 'System', color: 'var(--muted)', bg: 'var(--surface)' },
};

const filters: { id: 'all' | LogKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'daily', label: 'Briefings' },
  { id: 'milestone', label: 'Milestones' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'deadline', label: 'Deadlines' },
];

export const NotificationsPage = () => {
  const {
    user,
    goals,
    milestones,
    log,
    settings,
    markNotificationRead,
    markAllRead,
    clearLog,
  } = useApp();
  const [filter, setFilter] = useState<'all' | LogKind>('all');
  const [clearOpen, setClearOpen] = useState(false);
  const permission = notificationPermission();

  const unread = log.filter((entry) => !entry.read).length;
  const visible = useMemo(
    () => (filter === 'all' ? log : log.filter((entry) => entry.kind === filter)),
    [log, filter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, typeof log>();
    visible.forEach((entry) => {
      const key = entry.createdAt.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), entry]);
    });
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [visible]);

  const activeGoals = useMemo(() => goals.filter((goal) => !goal.archived), [goals]);
  const next = useMemo(() => {
    const activeIds = new Set(activeGoals.map((goal) => goal.id));
    const pending = milestones.filter((milestone) => !milestone.done && activeIds.has(milestone.goalId));
    const primary = activeGoals
      .slice()
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0];
    return primary ? nextMilestone(pending.filter((m) => m.goalId === primary.id)) : null;
  }, [activeGoals, milestones]);

  const nextBriefing = nextOccurrence(settings.notifications.dailyTime);

  if (!user) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Notifications centre"
        title="The right nudge, at the right time."
        description="A quiet daily briefing, milestone reminders and deadline alerts — computed on this device, never sent to a server."
        actions={
          <>
            {unread > 0 && (
              <Button variant="outline" onClick={markAllRead} icon={<CheckCheck className="h-3.5 w-3.5" />}>
                Mark all read
              </Button>
            )}
            <a href="#notification-preferences" className="btn btn-gold">
              <Bell className="h-4 w-4" />
              Adjust rhythm
            </a>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="glass-soft rounded-2xl p-4">
          <p className="eyebrow">Unread</p>
          <p className="display num mt-2 text-3xl text-ink">{unread}</p>
          <p className="mt-1 text-[9px] text-faint">of {log.length} notifications</p>
        </div>
        <div className="glass-soft rounded-2xl p-4">
          <p className="eyebrow">Next briefing</p>
          <p className="display mt-2 text-xl text-ink">{settings.notifications.enabled ? settings.notifications.dailyTime : 'Off'}</p>
          <p className="mt-1 text-[9px] text-faint">
            {settings.notifications.enabled
              ? `${nextBriefing.toLocaleDateString([], { weekday: 'short' })} · ${
                  settings.notifications.frequency === 'gentle'
                    ? 'once a day'
                    : settings.notifications.frequency === 'balanced'
                      ? 'morning and evening'
                      : 'every 3 hours'
                }`
              : 'Enable reminders below'}
          </p>
        </div>
        <div className="glass-soft rounded-2xl p-4">
          <p className="eyebrow">Browser permission</p>
          <p className="display mt-2 text-xl capitalize text-ink">
            {permission === 'unsupported' ? 'Unavailable' : permission === 'default' ? 'Not asked' : permission}
          </p>
          <p className="mt-1 text-[9px] text-faint">
            {notificationsSupported()
              ? 'In-app reminders always work.'
              : 'This browser does not support system notifications.'}
          </p>
        </div>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="glass rounded-3xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow-bright">Timeline</p>
              <h2 className="display mt-1.5 text-xl text-ink">Your notifications</h2>
            </div>
            {log.length > 0 && (
              <button
                type="button"
                onClick={() => setClearOpen(true)}
                className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] text-faint transition-colors hover:text-[color:var(--danger)]"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>

          <div className="scroll-thin mt-4 flex gap-1.5 overflow-x-auto pb-1">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn('chip shrink-0', filter === item.id && 'chip-active')}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-5">
            {groups.map(([key, entries]) => {
              const date = parse(key);
              const today = key === new Date().toISOString().slice(0, 10);
              return (
                <div key={key}>
                  <div className="mb-2 flex items-center gap-3">
                    <p className="text-[8px] uppercase tracking-[0.18em] text-faint">
                      {today ? 'Today' : fmtDateShort(date)}
                    </p>
                    <span className="h-px flex-1 bg-stroke" />
                    <span className="text-[8px] text-faint">{entries.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {entries.map((entry) => {
                      const meta = kindMeta[entry.kind];
                      const Icon = meta.icon;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => markNotificationRead(entry.id)}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                            entry.read
                              ? 'border-stroke bg-surface/20 opacity-65'
                              : 'border-stroke bg-surface/50 hover:border-stroke-strong',
                          )}
                        >
                          <span
                            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                            style={{ background: meta.bg, color: meta.color }}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="text-[11.5px] leading-snug text-ink">{entry.title}</span>
                              {!entry.read && <CircleDot className="h-2.5 w-2.5 shrink-0 text-accent" />}
                            </span>
                            <span className="mt-1 block whitespace-pre-line text-[10px] leading-relaxed text-muted">
                              {entry.body}
                            </span>
                            <span className="mt-1.5 flex items-center gap-2 text-[8px] uppercase tracking-[0.1em] text-faint">
                              <span>{meta.label}</span>
                              <span>·</span>
                              <span>
                                {parse(entry.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {visible.length === 0 && (
              <EmptyState
                compact
                icon={Bell}
                title={log.length === 0 ? 'No notifications yet' : 'Nothing in this filter'}
                description={
                  log.length === 0
                    ? 'Enable reminders and ChronoCanvas will log its daily briefings, milestone nudges and overdue alerts here.'
                    : 'Try another category, or wait for your next reminder rhythm.'
                }
              />
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="glass relative overflow-hidden rounded-3xl p-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/15 blur-3xl"
            />
            <p className="eyebrow-bright">Today's preview</p>
            <h3 className="display mt-2 text-xl text-ink">
              {next ? next.title : 'A clear horizon'}
            </h3>
            <p className="mt-1.5 text-[10px] text-faint">
              {next
                ? `${relativeDay(next.date)} · ${parse(next.date).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'No pending milestones across active goals.'}
            </p>
            <div className="mt-4 h-px bg-stroke" />
            <p className="mt-3 text-[10px] leading-relaxed text-faint">
              Your daily briefing gathers the two nearest tasks, then a single specific tip. No streak
              pressure, no calendar noise.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-stroke bg-surface/40 px-3 py-2.5">
              <BellRing className="h-3.5 w-3.5 text-accent" />
              <span className="text-[9.5px] text-muted">
                {settings.notifications.enabled
                  ? settings.notifications.paused
                    ? 'Reminders are paused'
                    : `Next at ${settings.notifications.dailyTime}`
                  : 'Reminders are currently off'}
              </span>
            </div>
          </section>

          <section id="notification-preferences" className="glass scroll-mt-24 rounded-3xl p-5 sm:p-6">
            <p className="eyebrow-bright">Reminder rhythm</p>
            <h3 className="display mt-1.5 text-xl text-ink">Shape the nudges</h3>
            <p className="mt-1.5 text-[10px] leading-relaxed text-faint">
              Turn on browser notifications for system alerts, or keep everything inside ChronoCanvas.
            </p>
            <div className="mt-5">
              <NotificationPreferences />
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Clear notification history?"
        description="This only clears the timeline. Your reminder settings and plans stay untouched."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setClearOpen(false)}>
              Keep history
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearLog();
                setClearOpen(false);
              }}
            >
              Clear {log.length} entries
            </Button>
          </>
        }
      >
        <p className="text-[11px] leading-relaxed text-muted">
          Future reminders will appear here as they fire. Nothing is sent off this device.
        </p>
      </Modal>
    </div>
  );
};
