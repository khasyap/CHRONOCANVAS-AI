import { useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { addDays, setHours, setMinutes } from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { CountdownDigits } from '@/components/LiveCountdown';
import { Button } from '@/components/Button';
import { useApp } from '@/store/AppContext';
import { validateEmail, passwordStrength } from '@/lib/utils';
import { cn } from '@/lib/utils';

type Mode = 'signin' | 'signup';

export const AuthPage = () => {
  const { user, signIn, signUp } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { mode?: Mode; from?: string } | null;
  const [mode, setMode] = useState<Mode>(routeState?.mode ?? 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const demoDeadline = useMemo(
    () => setMinutes(setHours(addDays(new Date(), 23), 18), 0).toISOString(),
    [],
  );
  const strength = passwordStrength(password);

  if (user) {
    return <Navigate to={routeState?.from ?? '/app'} replace />;
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setFormError(null);
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (mode === 'signup' && name.trim().length < 2) next.name = 'Tell us what to call you (at least 2 characters).';
    if (!validateEmail(email)) next.email = 'Enter a valid email address.';
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    if (mode === 'signup' && confirm !== password) next.confirm = 'The two passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(name, email, password);
      } else {
        await signIn(email, password);
      }
      const from = routeState?.from;
      navigate(from && from.startsWith('/app') ? from : '/app', { replace: true });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="app-bg" aria-hidden="true">
        <div
          className="aurora animate-drift"
          style={{ width: 620, height: 620, left: '-12%', top: '-18%', background: 'rgba(79,124,86,0.24)' }}
        />
        <div
          className="aurora animate-drift"
          style={{
            width: 520,
            height: 520,
            right: '-8%',
            bottom: '-14%',
            background: 'rgba(184,145,79,0.2)',
            animationDelay: '-8s',
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between">
          <Logo tagline />
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[11px] text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to the atelier
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1fr_0.95fr] lg:gap-14">
          <div className="page-enter w-full max-w-[460px]">
            <p className="eyebrow-bright">{mode === 'signup' ? 'Begin your canvas' : 'Welcome back'}</p>
            <h1 className="display mt-3 text-[clamp(2.1rem,4.5vw,3rem)] leading-[1.03] text-ink">
              {mode === 'signup' ? (
                <>
                  Your time deserves
                  <br />
                  <span className="italic text-gold-gradient">a beautiful plan.</span>
                </>
              ) : (
                <>
                  The countdown
                  <br />
                  <span className="italic text-gold-gradient">kept going.</span>
                </>
              )}
            </h1>
            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              {mode === 'signup'
                ? 'Create a private studio on this device. No email verification, no cloud sync, no waiting.'
                : 'Sign in to pick up your milestones, wallpapers and reminders exactly where you left them.'}
            </p>

            <div className="glass mt-7 rounded-3xl p-5 sm:p-6">
              <div className="flex rounded-full border border-stroke bg-surface/60 p-1">
                {(
                  [
                    { id: 'signup', label: 'Create account' },
                    { id: 'signin', label: 'Sign in' },
                  ] as { id: Mode; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => switchMode(tab.id)}
                    className={cn(
                      'flex-1 rounded-full px-3 py-2 text-[11.5px] transition-all',
                      mode === tab.id
                        ? 'bg-accent text-[color:var(--accent-ink)] shadow-sm'
                        : 'text-muted hover:text-ink',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4" noValidate>
                {mode === 'signup' && (
                  <div>
                    <label className="field-label" htmlFor="auth-name">
                      Your name
                    </label>
                    <input
                      id="auth-name"
                      className={cn('field', errors.name && 'field-error')}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Maya Laurent"
                      autoComplete="name"
                      aria-invalid={Boolean(errors.name)}
                    />
                    {errors.name && <p className="mt-1.5 text-[10.5px] text-[color:var(--danger)]">{errors.name}</p>}
                  </div>
                )}

                <div>
                  <label className="field-label" htmlFor="auth-email">
                    Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    className={cn('field', errors.email && 'field-error')}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-invalid={Boolean(errors.email)}
                  />
                  {errors.email && <p className="mt-1.5 text-[10.5px] text-[color:var(--danger)]">{errors.email}</p>}
                </div>

                <div>
                  <label className="field-label" htmlFor="auth-password">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      className={cn('field pr-11', errors.password && 'field-error')}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      aria-invalid={Boolean(errors.password)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-faint transition-colors hover:text-ink"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1.5 text-[10.5px] text-[color:var(--danger)]">{errors.password}</p>
                  )}
                  {mode === 'signup' && password.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex flex-1 gap-1">
                        {[0, 1, 2, 3, 4].map((index) => (
                          <span
                            key={index}
                            className="h-1 flex-1 rounded-full transition-colors"
                            style={{
                              background:
                                index < strength.score
                                  ? strength.score >= 4
                                    ? 'var(--success)'
                                    : 'var(--accent)'
                                  : 'var(--stroke)',
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-[9px] uppercase tracking-[0.12em] text-faint">{strength.label}</span>
                    </div>
                  )}
                </div>

                {mode === 'signup' && (
                  <div>
                    <label className="field-label" htmlFor="auth-confirm">
                      Confirm password
                    </label>
                    <input
                      id="auth-confirm"
                      type={showPassword ? 'text' : 'password'}
                      className={cn('field', errors.confirm && 'field-error')}
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      placeholder="One more time"
                      autoComplete="new-password"
                      aria-invalid={Boolean(errors.confirm)}
                    />
                    {errors.confirm && (
                      <p className="mt-1.5 text-[10.5px] text-[color:var(--danger)]">{errors.confirm}</p>
                    )}
                  </div>
                )}

                {formError && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-[rgba(255,139,139,0.3)] bg-[rgba(255,139,139,0.08)] p-3">
                    <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--danger)]" />
                    <p className="text-[11px] leading-relaxed text-[color:var(--danger)]">{formError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="gold"
                  size="lg"
                  loading={loading}
                  className="w-full"
                  iconRight={<ArrowRight className="h-4 w-4" />}
                >
                  {mode === 'signup' ? 'Create my studio' : 'Open my studio'}
                </Button>
              </form>

              <div className="mt-6 flex items-start gap-2.5 border-t border-stroke pt-4">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <p className="text-[10px] leading-relaxed text-faint">
                  Accounts and plans are stored locally in this browser. Passwords are salted and hashed with
                  PBKDF2. Nothing is uploaded unless you connect a Gemini API key and request AI features.
                </p>
              </div>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="relative flex min-h-[610px] flex-col justify-between overflow-hidden rounded-[2.5rem] border border-stroke bg-[linear-gradient(165deg,rgba(255,255,255,0.07),rgba(255,255,255,0.015))] p-9 backdrop-blur-2xl">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse at 20% 0%, rgba(217,182,120,0.18), transparent 55%), radial-gradient(ellipse at 90% 80%, rgba(79,124,86,0.24), transparent 55%)',
                }}
              />
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid-lines opacity-30" />

              <div className="relative">
                <div className="flex items-center justify-between">
                  <p className="eyebrow-bright">A moment, kept</p>
                  <Sparkles className="h-4 w-4 text-accent" />
                </div>
                <h2 className="display mt-6 text-[2rem] leading-[1.15] text-ink">
                  “The days before
                  <br />
                  something that matters
                  <br />
                  <span className="italic text-gold-gradient">deserve a shape.”</span>
                </h2>
                <p className="mt-4 max-w-sm text-[11.5px] leading-relaxed text-muted">
                  ChronoCanvas gives the waiting a rhythm — a plan you can follow, a countdown you can feel,
                  and a canvas that holds the whole arc in one glance.
                </p>
              </div>

              <div className="relative mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[8px] uppercase tracking-[0.22em] text-accent">A live demo countdown</p>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[7px] uppercase tracking-[0.14em] text-faint">
                    Aurora launch
                  </span>
                </div>
                <CountdownDigits deadline={demoDeadline} size="lg" className="mt-4" />
                <div className="mt-5 h-[3px] overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[68%] rounded-full bg-[linear-gradient(90deg,#D9B678,#A9C0A4)]" />
                </div>
                <div className="mt-3 flex items-center justify-between text-[8px] uppercase tracking-[0.16em] text-faint">
                  <span>68% prepared</span>
                  <span>13 of 19 milestones</span>
                </div>
              </div>

              <div className="relative mt-6 flex items-center justify-between">
                <div className="flex gap-2">
                  {['#D9B678', '#A9C0A4', '#5E8C63', '#EAD5A9', '#F2EDE2'].map((color) => (
                    <span
                      key={color}
                      className="h-5 w-5 rounded-full border border-white/20"
                      style={{ background: color }}
                    />
                  ))}
                </div>
                <span className="text-[8px] uppercase tracking-[0.2em] text-faint">
                  Plan · Design · Achieve
                </span>
              </div>
            </div>

            <div className="absolute -right-3 top-10 hidden animate-float xl:block">
              <div className="glass flex items-center gap-2 rounded-full px-3 py-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="text-[10px] text-ink">Private, local studio</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 border-t border-stroke pt-5 text-[9px] uppercase tracking-[0.16em] text-faint sm:flex-row">
          <span>© {new Date().getFullYear()} ChronoCanvas AI</span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" /> Your time. Your story.
          </span>
        </div>
      </div>
    </div>
  );
};
