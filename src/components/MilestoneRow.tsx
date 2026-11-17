import { Bell, BellOff, Calendar, Check, ChevronDown, ChevronUp, Clock, Pencil, Trash2 } from 'lucide-react';
import type { Milestone } from '@/types';
import { PRIORITY_META } from '@/lib/catalog';
import { fmtDateShort, fmtTime, isOverdue, offsetLabel, parse } from '@/lib/dates';
import { fmtDuration } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface MilestoneRowProps {
  milestone: Milestone;
  goalName?: string;
  onToggle?: (id: string) => void;
  onEdit?: (milestone: Milestone) => void;
  onDelete?: (milestone: Milestone) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  compact?: boolean;
  className?: string;
}

export const MilestoneRow = ({
  milestone,
  goalName,
  onToggle,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  compact = false,
  className,
}: MilestoneRowProps) => {
  const priority = PRIORITY_META[milestone.priority];
  const overdue = !milestone.done && isOverdue(milestone.date);
  const isDeadline = milestone.offsetDays === 0;

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 rounded-2xl border border-transparent px-2.5 py-3 transition-colors sm:gap-4 sm:px-3.5',
        'hover:border-stroke hover:bg-surface/60',
        milestone.done && 'opacity-60',
        className,
      )}
    >
      {(onMoveUp || onMoveDown) && (
        <div className="mt-0.5 flex flex-col items-center opacity-40 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!onMoveUp}
            className="rounded p-0.5 text-faint transition-colors hover:text-ink disabled:opacity-20"
            aria-label="Move milestone up in the sequence"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!onMoveDown}
            className="rounded p-0.5 text-faint transition-colors hover:text-ink disabled:opacity-20"
            aria-label="Move milestone down in the sequence"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => onToggle?.(milestone.id)}
        className={cn(
          'mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border transition-all',
          milestone.done
            ? 'border-accent bg-accent text-[color:var(--accent-ink)]'
            : 'border-stroke-strong bg-surface hover:border-accent',
        )}
        aria-label={milestone.done ? `Mark ${milestone.title} incomplete` : `Complete ${milestone.title}`}
        aria-pressed={milestone.done}
      >
        {milestone.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-md border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.08em]',
              isDeadline ? 'border-accent/40 text-accent' : 'border-stroke text-faint',
            )}
          >
            {offsetLabel(milestone.offsetDays)}
          </span>
          {goalName && <span className="text-[10px] uppercase tracking-[0.12em] text-faint">{goalName}</span>}
          {milestone.priority !== 'medium' && (
            <span
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em]"
              style={{ color: priority.color, background: priority.bg }}
            >
              {priority.label}
            </span>
          )}
          {overdue && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(255,139,139,0.12)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[color:var(--danger)]">
              Overdue
            </span>
          )}
        </div>

        <p className={cn('mt-1.5 text-sm leading-snug text-ink', milestone.done && 'line-through')}>
          {milestone.title}
        </p>

        {!compact && milestone.description && (
          <p className="mt-1 clamp-2 text-xs leading-relaxed text-muted">{milestone.description}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[10px] text-faint">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            {fmtDateShort(milestone.date)} · {fmtTime(parse(milestone.date))}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {fmtDuration(milestone.duration)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {milestone.reminderEnabled ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
            {milestone.reminderEnabled
              ? milestone.reminderLead >= 1440
                ? '1 day before'
                : milestone.reminderLead >= 60
                  ? `${Math.round(milestone.reminderLead / 60)}h before`
                  : milestone.reminderLead > 0
                    ? `${milestone.reminderLead}m before`
                    : 'At the time'
              : 'No reminder'}
          </span>
        </div>
      </div>

      {(onEdit || onDelete) && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(milestone)}
              className="icon-btn h-8 w-8 border-transparent bg-transparent"
              aria-label={`Edit ${milestone.title}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(milestone)}
              className="icon-btn h-8 w-8 border-transparent bg-transparent hover:text-[color:var(--danger)]"
              aria-label={`Delete ${milestone.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
