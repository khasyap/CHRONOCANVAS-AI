import { useId } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const ChronoMark = ({ size = 30, className }: { size?: number; className?: string }) => {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`mark-${id}`} x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EAD5A9" />
          <stop offset="0.52" stopColor="#B8914F" />
          <stop offset="1" stopColor="#5E8C63" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="17.5" stroke={`url(#mark-${id})`} strokeWidth="1.6" opacity="0.9" />
      <ellipse
        cx="32"
        cy="32"
        rx="26"
        ry="9.5"
        transform="rotate(-28 32 32)"
        stroke={`url(#mark-${id})`}
        strokeWidth="1.1"
        opacity="0.55"
      />
      <circle cx="32" cy="32" r="4.4" fill={`url(#mark-${id})`} />
      <circle cx="50.5" cy="19.5" r="1.9" fill="#D9B678" />
    </svg>
  );
};

interface LogoProps {
  compact?: boolean;
  tagline?: boolean;
  className?: string;
  to?: string;
}

export const Logo = ({ compact = false, tagline = false, className, to = '/' }: LogoProps) => (
  <Link to={to} className={cn('group inline-flex items-center gap-2.5', className)} aria-label="ChronoCanvas AI home">
    <ChronoMark size={compact ? 26 : 30} className="transition-transform duration-500 group-hover:rotate-12" />
    <span className="flex flex-col leading-none">
      <span className="flex items-baseline gap-1">
        <span
          className={cn(
            'display font-normal tracking-[-0.03em] text-ink',
            compact ? 'text-[1.05rem]' : 'text-[1.28rem]',
          )}
        >
          ChronoCanvas
        </span>
        <span className="rounded-full border border-accent/30 bg-accent/10 px-1.5 py-[2px] font-mono text-[8px] uppercase tracking-[0.14em] text-accent">
          AI
        </span>
      </span>
      {tagline && (
        <span className="mt-1.5 text-[8px] uppercase tracking-[0.32em] text-faint">Your time. Your story.</span>
      )}
    </span>
  </Link>
);
