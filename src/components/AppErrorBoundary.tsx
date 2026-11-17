import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Keeps a rendering failure inside one recoverable surface. Workspace data is
 * already persisted, so a reload never costs the user their plan.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ChronoCanvas surface error', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
        <div className="app-bg" aria-hidden="true" />
        <div className="glass relative w-full max-w-lg rounded-4xl p-7 text-center sm:p-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(232,154,139,0.3)] bg-[rgba(232,154,139,0.08)] text-[color:var(--danger)]">
            <TriangleAlert className="h-6 w-6" />
          </span>
          <p className="eyebrow-bright mt-6">The canvas caught a loose thread</p>
          <h1 className="display mt-3 text-3xl leading-tight text-ink">
            Something went wrong while drawing this page.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Your account, goals, milestones and wallpapers are still saved on this device. Reloading
            rebuilds the surface without touching them.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-gold"
            >
              <RefreshCw className="h-4 w-4" />
              Reload the studio
            </button>
            <a href="/app" className="btn btn-outline">
              Back to overview
            </a>
          </div>
          <p className="mt-5 text-[9px] uppercase tracking-[0.18em] text-faint">
            Nothing was lost. This is only the screen.
          </p>
        </div>
      </div>
    );
  }
}
