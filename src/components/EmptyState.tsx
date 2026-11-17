import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}

export const EmptyState = ({ icon: Icon, title, description, action, compact = false }: EmptyStateProps) => (
  <div
    className={`relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-stroke bg-surface/40 text-center ${
      compact ? 'px-6 py-10' : 'px-6 py-16 sm:py-20'
    }`}
  >
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-60"
      style={{
        background:
          'radial-gradient(circle at 50% 0%, var(--accent-soft), transparent 55%), radial-gradient(circle at 80% 100%, rgba(169,192,164,0.09), transparent 50%)',
      }}
    />
    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-stroke bg-surface2 text-accent">
      <Icon className="h-6 w-6" strokeWidth={1.4} />
    </div>
    <h3 className="display relative mt-5 text-xl text-ink">{title}</h3>
    <p className="relative mt-2 max-w-md text-sm leading-relaxed text-muted">{description}</p>
    {action && <div className="relative mt-6">{action}</div>}
  </div>
);
