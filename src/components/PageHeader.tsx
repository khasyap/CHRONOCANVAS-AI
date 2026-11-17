import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
}

export const PageHeader = ({ eyebrow, title, description, actions, backTo, backLabel }: PageHeaderProps) => (
  <div className="mb-7 flex flex-col gap-5 sm:mb-9 lg:flex-row lg:items-end lg:justify-between">
    <div className="min-w-0">
      {backTo && (
        <Link
          to={backTo}
          className="mb-4 inline-flex items-center gap-2 text-xs text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel ?? 'Back'}
        </Link>
      )}
      {eyebrow && <p className="eyebrow-bright mb-3">{eyebrow}</p>}
      <h1 className="display text-[clamp(2rem,4.4vw,3.15rem)] leading-[1.02] text-ink">{title}</h1>
      {description && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-[0.95rem]">{description}</p>
      )}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
  </div>
);
