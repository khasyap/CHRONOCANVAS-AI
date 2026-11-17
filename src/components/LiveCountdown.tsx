import { useEffect, useState } from 'react';
import { getCountdown, pad2 } from '@/lib/dates';
import { cn } from '@/lib/utils';

export const useNow = (intervalMs = 1000): Date => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
};

type CountdownSize = 'hero' | 'lg' | 'md' | 'sm';

const numberClass: Record<CountdownSize, string> = {
  hero: 'text-[clamp(2rem,6.4vw,4.35rem)]',
  lg: 'text-[clamp(1.7rem,4.4vw,2.9rem)]',
  md: 'text-[clamp(1.4rem,3.2vw,2rem)]',
  sm: 'text-[1.35rem]',
};

const labelClass: Record<CountdownSize, string> = {
  hero: 'text-[8px] sm:text-[9px] tracking-[0.26em]',
  lg: 'text-[8px] tracking-[0.24em]',
  md: 'text-[7.5px] tracking-[0.2em]',
  sm: 'text-[7px] tracking-[0.18em]',
};

interface CountdownDigitsProps {
  deadline: string;
  size?: CountdownSize;
  showSeconds?: boolean;
  className?: string;
  labels?: [string, string, string, string];
  align?: 'start' | 'center';
}

export const CountdownDigits = ({
  deadline,
  size = 'hero',
  showSeconds = true,
  className,
  labels = ['Days', 'Hours', 'Minutes', 'Seconds'],
  align = 'start',
}: CountdownDigitsProps) => {
  const now = useNow(1000);
  const countdown = getCountdown(deadline, now);
  const units = [
    { value: countdown.days, label: labels[0] },
    { value: countdown.hours, label: labels[1] },
    { value: countdown.minutes, label: labels[2] },
    ...(showSeconds ? [{ value: countdown.seconds, label: labels[3] }] : []),
  ];

  return (
    <div
      className={cn('flex w-full items-start gap-2 sm:gap-3', align === 'center' && 'justify-center', className)}
      role="timer"
      aria-live="off"
      aria-label={`${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes remaining`}
    >
      {units.map((unit, index) => (
        <div key={unit.label} className="flex items-start gap-2 sm:gap-3">
          {index > 0 && (
            <span
              className={cn(
                'display select-none leading-none text-faint',
                numberClass[size],
                size === 'hero' ? 'pt-0' : 'pt-0.5',
              )}
              aria-hidden="true"
            >
              :
            </span>
          )}
          <div className="flex min-w-0 flex-col">
            <span
              className={cn(
                'display num leading-none tracking-[-0.04em] text-gold-gradient',
                numberClass[size],
              )}
            >
              {pad2(unit.value)}
            </span>
            <span className={cn('mt-2.5 font-medium uppercase text-faint', labelClass[size])}>{unit.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

interface CompactCountdownProps {
  deadline: string;
  className?: string;
}

export const CompactCountdown = ({ deadline, className }: CompactCountdownProps) => {
  const now = useNow(30_000);
  const countdown = getCountdown(deadline, now);
  return (
    <span className={cn('num inline-flex items-baseline gap-1.5', className)}>
      <span className="display text-[2.35rem] leading-none text-ink">
        {countdown.days < 100 ? pad2(countdown.days) : countdown.days}
      </span>
      <span className="text-[9px] uppercase tracking-[0.22em] text-faint">
        {countdown.isPast ? 'arrived' : countdown.days === 1 ? 'day' : 'days'}
      </span>
    </span>
  );
};
