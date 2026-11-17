import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addMonths, format, isToday, startOfMonth, subMonths } from 'date-fns';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutList,
  Plus,
  Sparkles,
} from 'lucide-react';
import type { Milestone } from '@/types';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { MilestoneRow } from '@/components/MilestoneRow';
import { categoryOf } from '@/lib/catalog';
import { downloadAllCalendars } from '@/lib/ics';
import {
  dayKey,
  fmtDateLong,
  fmtTime,
  isInMonth,
  monthGrid,
  monthLabel,
  parse,
  relativeDay,
  weekdayShort,
} from '@/lib/dates';
import { cn } from '@/lib/utils';

type View = 'month' | 'agenda';

export const CalendarPage = () => {
  const { user, goals, milestones, settings, toggleMilestone } = useApp();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState<View>('month');
  const [goalFilter, setGoalFilter] = useState<'all' | string>('all');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const activeGoals = useMemo(() => goals.filter((goal) => !goal.archived), [goals]);
  const visibleGoals = useMemo(
    () => (goalFilter === 'all' ? activeGoals : activeGoals.filter((goal) => goal.id === goalFilter)),
    [activeGoals, goalFilter],
  );
  const goalIds = useMemo(() => new Set(visibleGoals.map((goal) => goal.id)), [visibleGoals]);
  const visible = useMemo(
    () =>
      milestones
        .filter((milestone) => goalIds.has(milestone.goalId))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [milestones, goalIds],
  );

  const goalMap = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);
  const days = useMemo(() => monthGrid(month, settings.weekStartsOn), [month, settings.weekStartsOn]);
  const weekdays = useMemo(() => weekdayShort(month, settings.weekStartsOn), [month, settings.weekStartsOn]);

  const byDay = useMemo(() => {
    const map = new Map<string, Milestone[]>();
    visible.forEach((milestone) => {
      const key = dayKey(milestone.date);
      map.set(key, [...(map.get(key) ?? []), milestone]);
    });
    return map;
  }, [visible]);

  const agendaGroups = useMemo(() => {
    const map = new Map<string, Milestone[]>();
    visible
      .filter((milestone) => !milestone.done)
      .forEach((milestone) => {
        const key = dayKey(milestone.date);
        map.set(key, [...(map.get(key) ?? []), milestone]);
      });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 40)
      .map(([key, items]) => ({ key, date: parse(key), items }));
  }, [visible]);

  const monthItems = useMemo(
    () => visible.filter((milestone) => isInMonth(parse(milestone.date), month)),
    [visible, month],
  );
  const deadlinesThisMonth = monthItems.filter((milestone) => milestone.offsetDays === 0).length;
  const selectedItems = selectedDay ? byDay.get(dayKey(selectedDay)) ?? [] : [];

  if (!user) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Milestone calendar"
        title="The month, mapped."
        description="Every deadline, milestone and quiet stretch in one view. Click a day to see what it holds."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => downloadAllCalendars(goals, milestones)}
              icon={<Download className="h-3.5 w-3.5" />}
              disabled={milestones.length === 0}
            >
              Export .ics
            </Button>
            <Link to="/app/new" className="btn btn-gold">
              <Plus className="h-4 w-4" />
              New goal
            </Link>
          </>
        }
      />

      <div className="glass rounded-3xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonth((value) => subMonths(value, 1))}
              className="icon-btn"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-[150px] text-center">
              <p className="display text-lg text-ink sm:text-xl">{monthLabel(month)}</p>
              <p className="text-[9px] uppercase tracking-[0.14em] text-faint">
                {monthItems.length} milestones · {deadlinesThisMonth} deadlines
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMonth((value) => addMonths(value, 1))}
              className="icon-btn"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setMonth(startOfMonth(new Date()))}
              className="btn btn-ghost btn-sm ml-1 text-muted"
            >
              Today
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border border-stroke bg-surface/60 p-0.5">
              {(
                [
                  { id: 'month', label: 'Month', icon: CalendarDays },
                  { id: 'agenda', label: 'Agenda', icon: LayoutList },
                ] as { id: View; label: string; icon: typeof CalendarDays }[]
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setView(option.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.08em] transition-colors',
                    view === option.id ? 'bg-accent text-[color:var(--accent-ink)]' : 'text-muted hover:text-ink',
                  )}
                >
                  <option.icon className="h-3 w-3" />
                  {option.label}
                </button>
              ))}
            </div>
            <Link to="/app/planner" className="btn btn-outline btn-sm">
              Open planner
            </Link>
          </div>
        </div>

        <div className="scroll-thin mt-4 flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setGoalFilter('all')}
            className={cn('chip shrink-0', goalFilter === 'all' && 'chip-active')}
          >
            All countdowns
          </button>
          {activeGoals.map((goal) => {
            const category = categoryOf(goal.category);
            const selected = goalFilter === goal.id;
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => setGoalFilter(goal.id)}
                className={cn('chip shrink-0', selected && 'chip-active')}
                style={selected ? undefined : { color: 'var(--muted)' }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: selected ? category.accent : 'var(--faint)' }} />
                <span className="max-w-[150px] truncate">{goal.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeGoals.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-3xl border border-dashed border-stroke px-6 py-16 text-center">
          <Sparkles className="h-6 w-6 text-accent" />
          <h3 className="display mt-4 text-xl text-ink">The calendar is waiting for a moment.</h3>
          <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-muted">
            Create a countdown and its milestones will appear here, ready to export to any calendar.
          </p>
          <Link to="/app/new" className="btn btn-gold mt-5">
            Create a goal
          </Link>
        </div>
      ) : view === 'month' ? (
        <div className="glass mt-4 overflow-hidden rounded-3xl p-2.5 sm:p-4">
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {weekdays.map((day) => (
              <div key={day} className="px-1 pb-2 text-center text-[8px] uppercase tracking-[0.16em] text-faint sm:text-[9px]">
                {day}
              </div>
            ))}
            {days.map((day) => {
              const key = dayKey(day);
              const items = byDay.get(key) ?? [];
              const inMonth = isInMonth(day, month);
              const today = isToday(day);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    'group relative flex min-h-[70px] flex-col rounded-xl border p-1.5 text-left transition-all sm:min-h-[104px] sm:p-2',
                    inMonth ? 'border-stroke bg-surface/30' : 'border-transparent opacity-35',
                    'hover:border-accent/40 hover:bg-surface/70',
                  )}
                >
                  <span
                    className={cn(
                      'num flex h-5 w-5 items-center justify-center rounded-full text-[10px] sm:h-6 sm:w-6 sm:text-[11px]',
                      today ? 'bg-accent font-medium text-[color:var(--accent-ink)]' : 'text-muted',
                    )}
                  >
                    {format(day, 'd')}
                  </span>

                  <div className="mt-1 hidden flex-1 space-y-1 overflow-hidden sm:block">
                    {items.slice(0, 2).map((item) => {
                      const goal = goalMap.get(item.goalId);
                      const accent = goal ? categoryOf(goal.category).accent : 'var(--accent)';
                      return (
                        <div
                          key={item.id}
                          className="truncate rounded-[5px] border-l-2 px-1.5 py-0.5 text-[8px] leading-snug"
                          style={{
                            background: `${accent}12`,
                            borderColor: accent,
                            color: item.done ? 'var(--faint)' : 'var(--muted)',
                            textDecoration: item.done ? 'line-through' : undefined,
                          }}
                        >
                          {item.title}
                        </div>
                      );
                    })}
                    {items.length > 2 && (
                      <p className="pl-1 text-[7.5px] text-faint">+{items.length - 2} more</p>
                    )}
                  </div>

                  <div className="mt-auto flex flex-wrap gap-1 pt-1 sm:hidden">
                    {items.slice(0, 3).map((item) => {
                      const goal = goalMap.get(item.goalId);
                      return (
                        <span
                          key={item.id}
                          className="h-1 w-1 rounded-full"
                          style={{
                            background: goal ? categoryOf(goal.category).accent : 'var(--accent)',
                            opacity: item.done ? 0.35 : 1,
                          }}
                        />
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {agendaGroups.map((group) => (
            <div key={group.key} className="glass rounded-3xl p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3 border-b border-stroke pb-3">
                <div>
                  <p className="display text-base text-ink">
                    {isToday(group.date) ? 'Today' : fmtDateLong(group.date, 'EEEE d MMMM')}
                  </p>
                  <p className="text-[9px] uppercase tracking-[0.14em] text-faint">{relativeDay(group.date)}</p>
                </div>
                <span className="text-[9px] text-faint">
                  {group.items.length} milestone{group.items.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="mt-1">
                {group.items.map((milestone) => (
                  <MilestoneRow
                    key={milestone.id}
                    milestone={milestone}
                    goalName={goalMap.get(milestone.goalId)?.name}
                    onToggle={toggleMilestone}
                  />
                ))}
              </div>
            </div>
          ))}
          {agendaGroups.length === 0 && (
            <div className="rounded-3xl border border-dashed border-stroke px-6 py-16 text-center">
              <CalendarDays className="mx-auto h-6 w-6 text-faint" />
              <h3 className="display mt-4 text-xl text-ink">Nothing scheduled ahead.</h3>
              <p className="mt-2 text-[12px] text-muted">Open the planner to add the next meaningful step.</p>
              <Link to="/app/planner" className="btn btn-outline btn-sm mt-5">
                Open planner
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stroke bg-surface/40 px-4 py-3">
        <p className="text-[10px] text-faint">
          Calendar exports include each milestone with a 30-minute reminder. Import the .ics into Google
          Calendar, Apple Calendar or Outlook.
        </p>
        <button
          type="button"
          onClick={() => downloadAllCalendars(goals, milestones)}
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-accent hover:opacity-80"
        >
          <Download className="h-3 w-3" />
          Download all
        </button>
      </div>

      <Modal
        open={Boolean(selectedDay)}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? fmtDateLong(selectedDay, 'EEEE d MMMM') : 'Selected day'}
        description={
          selectedItems.length > 0
            ? `${selectedItems.length} milestone${selectedItems.length === 1 ? '' : 's'} on this day.`
            : 'A clear day. A good place for quiet work.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelectedDay(null)}>
              Close
            </Button>
            <Link to="/app/planner" className="btn btn-gold btn-sm">
              <Plus className="h-3.5 w-3.5" />
              Add a milestone
            </Link>
          </>
        }
      >
        <div className="space-y-2">
          {selectedItems.map((milestone) => (
            <div key={milestone.id} className="rounded-xl border border-stroke bg-surface/40 px-2">
              <MilestoneRow
                milestone={milestone}
                goalName={goalMap.get(milestone.goalId)?.name}
                onToggle={toggleMilestone}
              />
            </div>
          ))}
          {selectedItems.length === 0 && (
            <div className="rounded-2xl border border-dashed border-stroke p-8 text-center">
              <p className="text-[12px] text-muted">No milestones scheduled here yet.</p>
              <Link to="/app/planner" className="link-underline mt-2 inline-block text-[10px]">
                Plan something for this day
              </Link>
            </div>
          )}
          {selectedItems.length > 0 && (
            <p className="pt-1 text-[9px] text-faint">
              First task at {fmtTime(selectedItems[0].date)}. Tap a checkbox to mark it complete.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
};
