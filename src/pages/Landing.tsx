import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { addDays, setHours, setMinutes, subDays } from 'date-fns';
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Check,
  Clock3,
  Image as ImageIcon,
  Layers,
  Palette,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { Goal, Milestone, ThemeId, WallpaperSpec } from '@/types';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/AppShell';
import { CountdownDigits } from '@/components/LiveCountdown';
import { useApp } from '@/store/AppContext';
import { renderWallpaper, type GoalBundle } from '@/lib/wallpaper';
import { THEMES, themeOf } from '@/lib/catalog';
import { fmtDateLong } from '@/lib/dates';
import { cn } from '@/lib/utils';

const featuredThemes: ThemeId[] = ['autumn', 'glass', 'neon', 'minimal', 'pastel', 'cyberpunk'];

const features = [
  {
    icon: BrainCircuit,
    title: 'A plan that works backward',
    body: 'The planner starts at the deadline and walks toward today, placing the right work at T-30, T-14, T-7, T-3 and T-0 — then adapts when life moves.',
  },
  {
    icon: RefreshCw,
    title: 'Recovery, not guilt',
    body: 'Missed a milestone? The recovery engine redistributes the remaining work while keeping the deadline exactly where it is.',
  },
  {
    icon: ImageIcon,
    title: 'Reference-to-wallpaper',
    body: 'Upload an image you love. ChronoCanvas extracts its palette and tone, then rebuilds it as your own countdown canvas.',
  },
  {
    icon: Sparkles,
    title: 'A coach with context',
    body: 'Your briefing knows which task is overdue, what is next, and how many days are actually left. No generic productivity quotes.',
  },
];

const steps = [
  {
    number: '01',
    label: 'Plan',
    title: 'Shape the arc',
    body: 'Name the moment, choose its rhythm, and let the planner build a realistic runway from today to the deadline.',
    accent: '#A9C0A4',
    visual: (
      <div className="space-y-2">
        {[
          { t: 'T-14', label: 'Map the launch scope', done: true },
          { t: 'T-7', label: 'Final QA and send-ready check', done: false },
          { t: 'T-1', label: 'Prepare the handoff', done: false },
        ].map((row) => (
          <div
            key={row.t}
            className="flex items-center gap-2.5 rounded-xl border border-stroke bg-surface/50 px-2.5 py-2"
          >
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-[5px] border',
                row.done ? 'border-accent bg-accent text-[#171a10]' : 'border-stroke-strong',
              )}
            >
              {row.done && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className="font-mono text-[8px] tracking-[0.08em] text-accent">{row.t}</span>
            <span className="clamp-1 text-[10px] text-muted">{row.label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    number: '02',
    label: 'Design',
    title: 'Paint the countdown',
    body: 'Ten editorial atmospheres, five device formats, real typography and a downloadable high-resolution image.',
    accent: '#D9B678',
    visual: (
      <div className="grid grid-cols-3 gap-1.5">
        {[
          'linear-gradient(150deg,#1b2a1c,#c2a568)',
          'linear-gradient(150deg,#0c0b1a,#8b6bff 60%,#e8cd9a)',
          'linear-gradient(150deg,#04121a,#4de6ff 55%,#b08cff)',
          'linear-gradient(150deg,#f8f2e7,#c9a96a)',
          'linear-gradient(150deg,#1a1220,#f2b6c8)',
          'linear-gradient(150deg,#07130d,#7fa98b)',
        ].map((background) => (
          <div
            key={background}
            className="aspect-[9/14] rounded-lg border border-white/10"
            style={{ background }}
          />
        ))}
      </div>
    ),
  },
  {
    number: '03',
    label: 'Achieve',
    title: 'Stay in the moment',
    body: 'A live countdown, a milestone calendar, reminders at the right rhythm and a celebration when the clock reaches zero.',
    accent: '#8FB6A0',
    visual: (
      <div className="rounded-xl border border-stroke bg-surface/50 p-3">
        <p className="text-[8px] uppercase tracking-[0.2em] text-faint">Aurora launch</p>
        <div className="mt-1 flex items-end gap-1">
          <span className="display num text-2xl leading-none text-gold-gradient">07</span>
          <span className="mb-0.5 text-[9px] uppercase tracking-[0.16em] text-faint">days</span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-[color:var(--stroke)]">
          <div className="h-full w-[72%] rounded-full bg-accent" />
        </div>
        <p className="mt-2 text-[9px] text-faint">72% prepared · next: final QA</p>
      </div>
    ),
  },
];

export const Landing = () => {
  const { user, settings } = useApp();
  const [previewTheme, setPreviewTheme] = useState<ThemeId>('autumn');
  const [canvasError, setCanvasError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const demo = useMemo(() => {
    const now = new Date();
    const deadline = setMinutes(setHours(addDays(now, 23), 18), 0);
    const goal: Goal = {
      id: 'landing-demo',
      name: 'Aurora Product Launch',
      deadline: deadline.toISOString(),
      category: 'project',
      importance: 'professional',
      prepMinutes: 120,
      reminderTime: '09:00',
      device: 'iphone',
      notes: 'A calm, beautiful release.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      archived: false,
    };
    const rows: { offset: number; title: string; done: boolean; priority: Milestone['priority'] }[] = [
      { offset: 23, title: 'Open the runway', done: true, priority: 'medium' },
      { offset: 14, title: 'Lock the launch scope', done: true, priority: 'high' },
      { offset: 7, title: 'Final QA and send-ready check', done: false, priority: 'high' },
      { offset: 3, title: 'Rehearse the launch demo', done: false, priority: 'critical' },
      { offset: 0, title: 'Launch, monitor, and announce', done: false, priority: 'critical' },
    ];
    const milestones: Milestone[] = rows.map((row, index) => ({
      id: `landing-ms-${index}`,
      goalId: goal.id,
      title: row.title,
      description: 'A carefully planned step toward the moment.',
      date: subDays(deadline, row.offset).toISOString(),
      offsetDays: row.offset,
      priority: row.priority,
      duration: 90,
      done: row.done,
      completedAt: row.done ? addDays(now, -4).toISOString() : undefined,
      reminderEnabled: true,
      reminderLead: 1440,
      order: index,
      generatedBy: 'local',
    }));
    return { goal, milestones, bundle: { goal, milestones } satisfies GoalBundle };
  }, []);

  const spec = useMemo<WallpaperSpec>(
    () => ({
      theme: previewTheme,
      palette: 'theme',
      typography: 'editorial',
      layout: 'stacked',
      milestonePlacement: 'bottom',
      decorations: true,
      clockSafe: true,
      appearance: themeOf(previewTheme).appearance,
      transparency: 42,
      showBranding: true,
      showProgress: true,
      goalIds: [demo.goal.id],
    }),
    [previewTheme, demo.goal.id],
  );

  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        await renderWallpaper(canvas, { spec, device: 'iphone', goals: [demo.bundle] }, 'preview');
        if (!cancelled) setCanvasError(false);
      } catch {
        if (!cancelled) setCanvasError(true);
      }
    };
    void draw();
    return () => {
      cancelled = true;
    };
  }, [spec, demo.bundle]);

  const primaryCta = user
    ? { to: '/app', label: 'Open your studio' }
    : { to: '/signin', label: 'Create your countdown' };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="app-bg" aria-hidden="true">
        <div
          className="aurora animate-drift"
          style={{ width: 640, height: 640, left: '-14%', top: '-16%', background: 'rgba(79,124,86,0.26)' }}
        />
        <div
          className="aurora animate-drift"
          style={{
            width: 560,
            height: 560,
            right: '-12%',
            top: '8%',
            background: 'rgba(184,145,79,0.18)',
            animationDelay: '-11s',
          }}
        />
        <div
          className="aurora"
          style={{ width: 480, height: 480, left: '40%', top: '58%', background: 'rgba(169,192,164,0.12)' }}
        />
      </div>

      <header className="sticky top-0 z-50 border-b border-stroke bg-[color:var(--bg)]/55 backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Logo tagline />
          <nav className="hidden items-center gap-7 md:flex">
            {[
              { href: '#product', label: 'The product' },
              { href: '#canvas', label: 'Design studio' },
              { href: '#intelligence', label: 'Intelligence' },
              { href: '#themes', label: 'Themes' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[12.5px] text-muted transition-colors hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:inline-flex" />
            {!user && (
              <Link
                to="/signin"
                state={{ mode: 'signin' }}
                className="hidden text-[12.5px] text-muted transition-colors hover:text-ink sm:inline-flex"
              >
                Sign in
              </Link>
            )}
            <Link to={primaryCta.to} className="btn btn-gold btn-sm">
              {user ? 'Open studio' : 'Start planning'}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:pt-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.04fr_0.96fr] lg:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-stroke bg-surface/60 px-3 py-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              <span className="text-[9px] uppercase tracking-[0.24em] text-muted">
                AI deadline atelier
              </span>
            </div>

            <h1 className="display text-[clamp(2.65rem,6.2vw,4.7rem)] leading-[0.98] text-ink">
              Your next big moment,
              <br />
              <span className="italic text-gold-gradient">beautifully planned.</span>
            </h1>

            <p className="mt-6 max-w-xl text-[0.98rem] leading-relaxed text-muted sm:text-[1.03rem]">
              ChronoCanvas AI turns a date into a calm, backward plan — then shapes it into a live
              countdown, a lock screen you will actually want to look at, and a sealed letter for the
              version of you who arrives.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={primaryCta.to} className="btn btn-gold btn-lg">
                {primaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#canvas" className="btn btn-outline btn-lg">
                <Wand2 className="h-4 w-4" />
                Explore the studio
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-faint">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                Private by design
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                10 wallpaper themes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                5 device formats
              </span>
            </div>
          </motion.div>

          <motion.div
            className="relative mx-auto w-full max-w-[400px]"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-[85%] w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
              style={{ background: 'radial-gradient(circle, #B8914F 0%, #4F7C56 55%, transparent 75%)' }}
            />

            <div className="absolute -left-6 top-[18%] z-20 hidden animate-float sm:block lg:-left-10">
              <div className="glass rounded-2xl px-3.5 py-2.5">
                <p className="text-[8px] uppercase tracking-[0.22em] text-accent">AI plan ready</p>
                <p className="mt-1 text-[11px] text-ink">6 milestones shaped</p>
              </div>
            </div>
            <div
              className="absolute -right-4 top-[34%] z-20 hidden animate-float sm:block lg:-right-8"
              style={{ animationDelay: '-2.4s' }}
            >
              <div className="glass flex items-center gap-2 rounded-full px-3 py-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-[10px] text-ink">72% prepared</span>
              </div>
            </div>
            <div
              className="absolute -bottom-3 left-1/2 z-20 hidden -translate-x-1/2 animate-float md:block"
              style={{ animationDelay: '-4.2s' }}
            >
              <div className="glass rounded-full px-3.5 py-2">
                <span className="text-[9px] uppercase tracking-[0.18em] text-muted">
                  Next moment · T-7 final QA
                </span>
              </div>
            </div>

            <div className="relative mx-auto w-[280px] sm:w-[310px]">
              <div className="rounded-[2.9rem] border border-white/15 bg-[#06100b] p-[9px] shadow-[0_60px_130px_-45px_rgba(0,0,0,0.9)]">
                <div
                  className="relative overflow-hidden rounded-[2.35rem] bg-[#070d09]"
                  style={{ aspectRatio: '9 / 19.5' }}
                >
                  <canvas
                    ref={canvasRef}
                    className="block h-full w-full"
                    aria-label="A live preview of an Autumn Elegance countdown wallpaper"
                  />
                  {canvasError && (
                    <div className="absolute inset-0 flex flex-col justify-end bg-[linear-gradient(160deg,#1b110a,#2d1a10)] p-6">
                      <p className="text-[9px] uppercase tracking-[0.24em] text-[#E8CD9A]">Countdown to</p>
                      <p className="display mt-2 text-2xl text-[#F8EDDB]">Aurora Product Launch</p>
                      <p className="display mt-5 text-6xl leading-none text-[#E8CD9A]">23</p>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.22em] text-[#F8EDDB]/60">days to go</p>
                    </div>
                  )}
                  <div className="pointer-events-none absolute left-1/2 top-2.5 h-[18px] w-[74px] -translate-x-1/2 rounded-full bg-black/85">
                    <span className="absolute right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#121a13]" />
                  </div>
                </div>
              </div>

              <div className="glass mt-5 flex items-center justify-between gap-2 rounded-full p-1.5 pl-3">
                <span className="text-[9px] uppercase tracking-[0.16em] text-muted">
                  {themeOf(previewTheme).label}
                </span>
                <div className="flex items-center gap-1">
                  {featuredThemes.map((id) => {
                    const theme = THEMES.find((t) => t.id === id);
                    if (!theme) return null;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPreviewTheme(id)}
                        className={cn(
                          'h-6 w-6 rounded-full border transition-all',
                          previewTheme === id
                            ? 'scale-110 border-white/70'
                            : 'border-white/15 hover:scale-105',
                        )}
                        style={{
                          background: `linear-gradient(140deg, ${theme.swatches[0]}, ${theme.swatches[2]}, ${theme.swatches[3]})`,
                        }}
                        aria-label={`Preview the ${theme.label} theme`}
                        title={theme.label}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="glass mt-16 flex flex-col gap-5 rounded-3xl p-5 sm:p-6 lg:mt-20 lg:flex-row lg:items-center">
          <div className="shrink-0 lg:w-[215px]">
            <p className="eyebrow-bright">A live countdown</p>
            <p className="mt-2 text-[13px] text-ink">Aurora Product Launch</p>
            <p className="mt-1 text-[10px] text-faint">{fmtDateLong(demo.goal.deadline, 'd MMMM · h:mm a')}</p>
          </div>
          <div className="min-w-0 flex-1 border-y border-stroke py-4 lg:border-x lg:border-y-0 lg:px-7 lg:py-0">
            <CountdownDigits deadline={demo.goal.deadline} size="md" className="max-w-lg" />
          </div>
          <Link to={primaryCta.to} className="btn btn-outline btn-sm shrink-0 self-start lg:self-auto">
            Build yours
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <section id="product" className="mt-24 scroll-mt-24 sm:mt-32">
          <div className="max-w-3xl">
            <p className="eyebrow-bright">Plan · Design · Achieve</p>
            <h2 className="display mt-4 text-[clamp(2.1rem,4.6vw,3.5rem)] leading-[1.03] text-ink">
              A deadline is a shape for your attention.
            </h2>
            <p className="mt-5 max-w-2xl text-[0.98rem] leading-relaxed text-muted">
              Most tools give you a list. ChronoCanvas gives the date a rhythm, a visual language and a
              quiet daily ritual — so the work feels possible long before the final day.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="glass glass-hover relative overflow-hidden rounded-3xl p-6">
                <div
                  aria-hidden="true"
                  className="absolute -right-10 -top-14 h-36 w-36 rounded-full opacity-20 blur-2xl"
                  style={{ background: step.accent }}
                />
                <div className="relative flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-[0.16em] text-faint">{step.number}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[8px] uppercase tracking-[0.16em]"
                    style={{ color: step.accent, background: `${step.accent}18` }}
                  >
                    {step.label}
                  </span>
                </div>
                <h3 className="display relative mt-6 text-2xl text-ink">{step.title}</h3>
                <p className="relative mt-2 text-[12.5px] leading-relaxed text-muted">{step.body}</p>
                <div className="relative mt-6">{step.visual}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="canvas" className="mt-24 scroll-mt-24 sm:mt-32">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="eyebrow-bright">The design studio</p>
              <h2 className="display mt-4 text-[clamp(2.1rem,4.4vw,3.3rem)] leading-[1.04] text-ink">
                Not a mockup.
                <br />
                A real, downloadable canvas.
              </h2>
              <p className="mt-5 max-w-lg text-[0.95rem] leading-relaxed text-muted">
                Every wallpaper is rendered locally at native resolution — up to 3840 × 2160. Choose a
                format, an atmosphere and a palette, then download a lock screen that carries your next
                milestone with it.
              </p>
              <div className="mt-7 space-y-3">
                {[
                  'Context-aware: the canvas highlights your next milestone, not every task.',
                  'Clock-safe layouts keep type clear of the lock-screen clock.',
                  'Multi-goal mode places two or three countdowns in one composition.',
                  'Reference uploads become palettes, typography and mood.',
                ].map((line) => (
                  <div key={line} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    <span className="text-[12.5px] leading-relaxed text-muted">{line}</span>
                  </div>
                ))}
              </div>
              <Link to={primaryCta.to} className="btn btn-gold mt-8">
                Design your first canvas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="relative">
              <div className="glass relative overflow-hidden rounded-4xl p-3 sm:p-4">
                <div className="flex items-center justify-between px-2 pb-3 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ff8b8b]/70" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#f0c27b]/70" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#7dd3a8]/70" />
                  </div>
                  <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-faint">
                    Wallpaper studio · iPhone
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_120px] gap-3 sm:grid-cols-[1fr_150px]">
                  <div
                    className="relative overflow-hidden rounded-2xl border border-white/10"
                    style={{ background: 'linear-gradient(160deg,#1b110a,#2d1a10 55%,#0b0705)' }}
                  >
                    <div className="flex h-full min-h-[300px] flex-col justify-between p-4 sm:min-h-[400px] sm:p-6">
                      <div>
                        <p className="text-[7px] uppercase tracking-[0.24em] text-[#E8CD9A]/80 sm:text-[8px]">
                          Countdown to
                        </p>
                        <p className="display mt-1.5 text-lg leading-tight text-[#F8EDDB] sm:text-2xl">
                          Aurora
                          <br />
                          Product Launch
                        </p>
                        <p className="mt-2 text-[7px] uppercase tracking-[0.14em] text-[#F8EDDB]/45 sm:text-[8px]">
                          21 November · Project delivery
                        </p>
                      </div>
                      <div>
                        <p className="display num text-6xl leading-none text-[#E8CD9A] sm:text-7xl">23</p>
                        <p className="mt-2 text-[7px] uppercase tracking-[0.22em] text-[#F8EDDB]/55 sm:text-[8px]">
                          Days to go
                        </p>
                        <p className="display mt-3 text-sm text-[#F8EDDB]/85 sm:text-lg">
                          04 <span className="text-[8px] uppercase tracking-[0.16em] text-[#F8EDDB]/40">hrs</span>{' '}
                          18{' '}
                          <span className="text-[8px] uppercase tracking-[0.16em] text-[#F8EDDB]/40">min</span>
                        </p>
                        <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-white/10">
                          <div className="h-full w-[72%] rounded-full bg-[#E8CD9A]" />
                        </div>
                        <p className="mt-2 text-[7px] uppercase tracking-[0.16em] text-[#F8EDDB]/35">
                          72% prepared · 13 of 18
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#E8CD9A]/20 bg-white/[0.04] p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[7px] uppercase tracking-[0.2em] text-[#E8CD9A]/80">
                            Next moment
                          </span>
                          <span className="font-mono text-[7px] text-[#E8CD9A]">T-7</span>
                        </div>
                        <p className="mt-1 text-[10px] text-[#F8EDDB]/90">Final QA and send-ready check</p>
                        <p className="mt-0.5 text-[7px] uppercase tracking-[0.12em] text-[#F8EDDB]/35">
                          16 November · 90 min
                        </p>
                      </div>
                    </div>
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0b0705]/80 to-transparent"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-[8px] uppercase tracking-[0.18em] text-faint">Atmosphere</p>
                    {THEMES.slice(0, 6).map((theme) => (
                      <div
                        key={theme.id}
                        className="flex items-center gap-2 rounded-lg border border-stroke bg-surface/60 p-1.5"
                      >
                        <span
                          className="h-6 w-6 shrink-0 rounded-md border border-white/10"
                          style={{
                            background: `linear-gradient(140deg, ${theme.swatches[0]}, ${theme.swatches[2]})`,
                          }}
                        />
                        <span className="clamp-1 text-[8.5px] text-muted">{theme.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 -right-2 hidden sm:block">
                <span className="glass rounded-full px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-muted">
                  Rendered locally · 1290 × 2796
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="themes" className="mt-24 scroll-mt-24 sm:mt-32">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow-bright">Ten atmospheres</p>
              <h2 className="display mt-4 text-[clamp(2.1rem,4.4vw,3.3rem)] leading-[1.04] text-ink">
                A different mood for every kind of deadline.
              </h2>
            </div>
            <p className="max-w-sm text-[12.5px] leading-relaxed text-muted">
              Warm gold for work. Botanical for weddings. Neon for the launch you have been building toward.
              Every theme is a full composition, not a color filter.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {THEMES.map((theme) => (
              <div
                key={theme.id}
                className="group overflow-hidden rounded-2xl border border-stroke bg-surface/50 transition-all hover:border-stroke-strong"
              >
                <div className="flex h-16">
                  {theme.swatches.map((swatch) => (
                    <span key={swatch} className="flex-1" style={{ background: swatch }} />
                  ))}
                </div>
                <div className="p-3.5">
                  <p className="text-[11px] font-medium text-ink">{theme.label}</p>
                  <p className="mt-1 clamp-2 text-[9.5px] leading-relaxed text-faint">{theme.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="intelligence" className="mt-24 scroll-mt-24 sm:mt-32">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="eyebrow-bright">Intelligence with restraint</p>
              <h2 className="display mt-4 text-[clamp(2.1rem,4.4vw,3.3rem)] leading-[1.04] text-ink">
                AI that knows the date, not just the prompt.
              </h2>
              <p className="mt-5 text-[0.95rem] leading-relaxed text-muted">
                ChronoCanvas plans with your category, available time, importance and existing notes in
                mind. Add a Gemini key to unlock deeper planning, coaching and generated art. Without one,
                the on-device planner still builds a genuinely useful runway.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['Category-aware', 'Time-aware', 'Editable', 'Private by default'].map((tag) => (
                  <span key={tag} className="chip">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {features.map((feature) => (
                <div key={feature.title} className="glass glass-hover rounded-2xl p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-stroke bg-accent/8 text-accent">
                    <feature.icon className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                  <h3 className="display mt-4 text-lg leading-snug text-ink">{feature.title}</h3>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-muted">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-24 sm:mt-32">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-stroke bg-surface/40 px-6 py-14 text-center sm:px-12 sm:py-20">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 0%, rgba(217,182,120,0.16), transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(79,124,86,0.2), transparent 55%)',
              }}
            />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid-lines opacity-[0.25]" />
            <p className="eyebrow-bright relative">Your time. Your story.</p>
            <h2 className="display relative mx-auto mt-5 max-w-3xl text-[clamp(2rem,4.8vw,3.6rem)] leading-[1.04] text-ink">
              The date is already on the calendar.
              <br />
              <span className="italic text-gold-gradient">The rest is canvas.</span>
            </h2>
            <p className="relative mx-auto mt-5 max-w-xl text-[0.95rem] leading-relaxed text-muted">
              Plan the arc, design the moment, and arrive with a little more calm. ChronoCanvas AI runs
              privately in your browser.
            </p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to={primaryCta.to} className="btn btn-gold btn-lg">
                {primaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#product" className="btn btn-outline btn-lg">
                See how it works
              </a>
            </div>
            <div className="relative mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[9px] uppercase tracking-[0.16em] text-faint">
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-3 w-3" /> Multiple countdowns
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3" /> High-resolution downloads
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" /> No cloud account needed
              </span>
            </div>
          </div>
        </section>

        <section className="mt-24 border-y border-stroke py-14 sm:mt-28 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="display text-[clamp(1.55rem,3.4vw,2.45rem)] leading-[1.25] text-ink">
              “A deadline is not a threat. It is a shape for your attention — and attention, arranged
              beautifully, becomes progress.”
            </p>
            <p className="mt-6 text-[9px] uppercase tracking-[0.28em] text-faint">The ChronoCanvas principle</p>
          </div>
        </section>

        <footer className="mt-14">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xs">
              <Logo tagline />
              <p className="mt-4 text-[11px] leading-relaxed text-faint">
                An AI deadline atelier and countdown wallpaper studio. Built to make the days before the
                moment feel intentional.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-[11px] sm:grid-cols-3">
              {[
                { href: '#product', label: 'Product' },
                { href: '#canvas', label: 'Studio' },
                { href: '#themes', label: 'Themes' },
                { href: '#intelligence', label: 'Intelligence' },
                { href: '/signin', label: user ? 'Your studio' : 'Sign in' },
                { href: '/app/new', label: 'New goal' },
              ].map((link) =>
                link.href.startsWith('#') ? (
                  <a key={link.label} href={link.href} className="py-1 text-muted transition-colors hover:text-ink">
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    to={link.href}
                    className="py-1 text-muted transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                ),
              )}
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-2 border-t border-stroke pt-6 text-[9px] uppercase tracking-[0.16em] text-faint sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} ChronoCanvas AI</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-[color:var(--success)]" />
              {settings.mode === 'dark' ? 'Forest palette' : 'Ivory palette'} · Local-first
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
};
