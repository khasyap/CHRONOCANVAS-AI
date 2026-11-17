import { useMemo } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CalendarDays,
  Images,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Moon,
  Plus,
  Settings2,
  Sun,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Logo } from './Logo';
import { overallStats } from '@/lib/metrics';
import { categoryOf } from '@/lib/catalog';
import { fmtDateLong, greeting } from '@/lib/dates';
import { initials, cn } from '@/lib/utils';
import { ProgressRing } from './ProgressRing';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const ThemeToggle = ({ className }: { className?: string }) => {
  const { settings, updateSettings } = useApp();
  const dark = settings.mode === 'dark';
  return (
    <button
      type="button"
      onClick={() => updateSettings({ mode: dark ? 'light' : 'dark' })}
      className={cn('icon-btn', className)}
      aria-label={dark ? 'Switch to light appearance' : 'Switch to dark appearance'}
      title={dark ? 'Light appearance' : 'Dark appearance'}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
};

const Avatar = ({ name, hue, size = 36 }: { name: string; hue: number; size?: number }) => (
  <span
    className="inline-flex items-center justify-center rounded-full border border-white/15 font-medium text-white shadow-[0_4px_18px_-6px_rgba(0,0,0,0.6)]"
    style={{
      width: size,
      height: size,
      fontSize: size * 0.33,
      background: `linear-gradient(140deg, hsl(${hue} 52% 46%), hsl(${(hue + 52) % 360} 42% 32%))`,
    }}
    aria-hidden="true"
  >
    {initials(name)}
  </span>
);

export const AppShell = () => {
  const { user, goals, milestones, log, signOut } = useApp();
  const location = useLocation();

  const unread = log.filter((entry) => !entry.read).length;
  const stats = useMemo(() => overallStats(goals, milestones), [goals, milestones]);

  if (!user) return null;

  const navGroups: NavGroup[] = [
    {
      label: 'Your space',
      items: [
        { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/app/planner', label: 'Planner', icon: ListChecks },
        { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
        { to: '/app/analytics', label: 'Progress', icon: BarChart3 },
      ],
    },
    {
      label: 'Design studio',
      items: [
        { to: '/app/studio', label: 'Wallpaper studio', icon: Wand2 },
        { to: '/app/gallery', label: 'Gallery', icon: Images },
      ],
    },
    {
      label: 'You',
      items: [
        { to: '/app/notifications', label: 'Notifications', icon: Bell, badge: unread },
        { to: '/app/settings', label: 'Settings', icon: Settings2 },
      ],
    },
  ];

  const next = stats.nextDeadline;
  const nextCategory = next ? categoryOf(next.goal.category) : null;

  const mobileItems: NavItem[] = [
    { to: '/app', label: 'Home', icon: LayoutDashboard, end: true },
    { to: '/app/planner', label: 'Planner', icon: ListChecks },
    { to: '/app/studio', label: 'Design', icon: Wand2 },
    { to: '/app/analytics', label: 'Progress', icon: BarChart3 },
    { to: '/app/settings', label: 'You', icon: Settings2 },
  ];

  return (
    <div className="min-h-screen">
      <div className="app-bg" aria-hidden="true">
        <div
          className="aurora animate-drift"
          style={{ width: 520, height: 520, left: '-8%', top: '-12%', background: 'rgba(79,124,86,0.26)' }}
        />
        <div
          className="aurora animate-drift"
          style={{
            width: 460,
            height: 460,
            right: '-6%',
            top: '18%',
            background: 'rgba(184,145,79,0.17)',
            animationDelay: '-9s',
          }}
        />
      </div>

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] flex-col border-r border-stroke bg-[color:var(--bg)]/55 backdrop-blur-2xl lg:flex">
        <div className="px-6 pb-6 pt-7">
          <Logo tagline />
        </div>

        <nav className="scroll-thin flex-1 overflow-y-auto px-4 pb-4">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-6">
              <p className="mb-2 px-2.5 text-[9px] uppercase tracking-[0.26em] text-faint">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => cn('nav-link', isActive && 'nav-link-active')}
                  >
                    <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold text-[color:var(--accent-ink)]">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

          <div className="mx-1 mt-2 rounded-2xl border border-stroke bg-surface/60 p-4">
            <p className="eyebrow mb-3">Next moment</p>
            {next && nextCategory ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="clamp-2 text-[12.5px] font-medium leading-snug text-ink">{next.goal.name}</p>
                    <p className="mt-1.5 text-[10px] text-faint">{nextCategory.short}</p>
                  </div>
                  <ProgressRing value={stats.averagePercent} size={38} stroke={3}>
                    <span className="num text-[8px] text-muted">{stats.averagePercent}%</span>
                  </ProgressRing>
                </div>
                <p className="mt-3 display text-xl text-accent">
                  {next.daysLeft < 0 ? 'Arrived' : next.daysLeft === 0 ? 'Today' : `${next.daysLeft} days`}
                </p>
              </>
            ) : (
              <>
                <p className="text-[12.5px] leading-relaxed text-muted">
                  Your next deadline will live here. Give it a date and a name.
                </p>
                <Link to="/app/new" className="btn btn-outline btn-sm mt-3 w-full">
                  <Plus className="h-3.5 w-3.5" />
                  New goal
                </Link>
              </>
            )}
          </div>
        </nav>

        <div className="border-t border-stroke p-4">
          <div className="flex items-center gap-3 rounded-xl px-1 py-1.5">
            <Avatar name={user.name} hue={user.avatarHue} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{user.name}</p>
              <p className="truncate text-[10px] text-faint">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="icon-btn h-8 w-8 shrink-0 border-transparent bg-transparent"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-3 px-1 text-[8px] uppercase tracking-[0.22em] text-faint">
            Plan · Design · Achieve
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-30 border-b border-stroke bg-[color:var(--bg)]/60 backdrop-blur-2xl">
          <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-7 lg:px-9">
            <div className="flex min-w-0 items-center gap-4">
              <div className="lg:hidden">
                <Logo compact />
              </div>
              <div className="hidden min-w-0 lg:block">
                <p className="text-[13px] text-ink">
                  {greeting()}, <span className="font-medium">{user.name.split(' ')[0]}</span>
                </p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-faint">
                  {fmtDateLong(new Date(), 'EEEE, d MMMM')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link to="/app/new" className="btn btn-gold btn-sm hidden sm:inline-flex">
                <Plus className="h-3.5 w-3.5" />
                New goal
              </Link>
              <Link
                to="/app/new"
                className="icon-btn sm:hidden"
                aria-label="Create a new goal"
              >
                <Plus className="h-4 w-4" />
              </Link>
              <ThemeToggle />
              <Link to="/app/notifications" className="icon-btn relative" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(217,182,120,0.8)]" />
                )}
              </Link>
              <Link
                to="/app/settings"
                className="ml-1 rounded-full ring-1 ring-stroke transition-transform hover:scale-105"
                aria-label="Profile and settings"
              >
                <Avatar name={user.name} hue={user.avatarHue} size={32} />
              </Link>
            </div>
          </div>
        </header>

        <main
          key={location.pathname}
          className="page-enter mx-auto w-full max-w-[1440px] px-4 pb-28 pt-6 sm:px-7 sm:pt-8 lg:px-9 lg:pb-14"
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile nav */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-stroke bg-[color:var(--bg)]/85 backdrop-blur-2xl lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-2 pt-1.5">
          {mobileItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] uppercase tracking-[0.12em] transition-colors',
                  isActive ? 'text-accent' : 'text-faint hover:text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'relative flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                      isActive && 'bg-accent/10',
                    )}
                  >
                    <item.icon className="h-[17px] w-[17px]" strokeWidth={isActive ? 2 : 1.6} />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};
