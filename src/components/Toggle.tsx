import { cn } from '@/lib/utils';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export const Toggle = ({ checked, onChange, label, description, disabled, className }: ToggleProps) => (
  <div className={cn('flex items-center justify-between gap-4', className)}>
    {(label || description) && (
      <div className="min-w-0">
        {label && <p className="text-[13px] leading-snug text-ink">{label}</p>}
        {description && <p className="mt-0.5 text-[11px] leading-relaxed text-faint">{description}</p>}
      </div>
    )}
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? 'Toggle'}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[23px] w-[42px] shrink-0 rounded-full border transition-all duration-300 disabled:opacity-40',
        checked ? 'border-accent/60 bg-accent/80' : 'border-stroke-strong bg-surface2',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] h-[17px] w-[17px] rounded-full shadow-sm transition-all duration-300',
          checked ? 'left-[22px] bg-[#172013]' : 'left-[2px] bg-[color:var(--muted)]',
        )}
      />
    </button>
  </div>
);
