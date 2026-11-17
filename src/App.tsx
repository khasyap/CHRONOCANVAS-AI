import { lazy, Suspense, useEffect, type ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { ToastViewport } from '@/components/Toasts';
import { AppShell } from '@/components/AppShell';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';

const Landing = lazy(() => import('@/pages/Landing').then((module) => ({ default: module.Landing })));
const AuthPage = lazy(() => import('@/pages/AuthPage').then((module) => ({ default: module.AuthPage })));
const Dashboard = lazy(() => import('@/pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const CreateGoal = lazy(() => import('@/pages/CreateGoal').then((module) => ({ default: module.CreateGoal })));
const Planner = lazy(() => import('@/pages/Planner').then((module) => ({ default: module.Planner })));
const CalendarPage = lazy(() =>
  import('@/pages/CalendarPage').then((module) => ({ default: module.CalendarPage })),
);
const GoalDetail = lazy(() =>
  import('@/pages/GoalDetail').then((module) => ({ default: module.GoalDetail })),
);
const Studio = lazy(() => import('@/pages/Studio').then((module) => ({ default: module.Studio })));
const Gallery = lazy(() => import('@/pages/Gallery').then((module) => ({ default: module.Gallery })));
const NotificationsPage = lazy(() =>
  import('@/pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })),
);
const Analytics = lazy(() => import('@/pages/Analytics').then((module) => ({ default: module.Analytics })));
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
};

const RouteFallback = () => (
  <div className="flex min-h-[55vh] items-center justify-center gap-2.5 px-6 text-[9.5px] uppercase tracking-[0.18em] text-faint">
    <Loader2 className="h-4 w-4 animate-spin text-accent" />
    Opening the atelier
  </div>
);

const Protected = ({ children }: { children: ReactElement }) => {
  const { user } = useApp();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }
  return children;
};

const NotFound = () => (
  <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
    <p className="eyebrow-bright">404</p>
    <h1 className="display mt-3 text-4xl text-ink">This page is not on the calendar.</h1>
    <p className="mt-3 max-w-md text-sm text-muted">
      The link may have expired, or the countdown was archived. Head back to your studio.
    </p>
    <a href="/app" className="btn btn-gold mt-7">
      Return to your studio
    </a>
  </div>
);

const App = () => (
  <BrowserRouter>
    <ScrollToTop />
    <AppErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signin" element={<AuthPage />} />
          <Route
            path="/app"
            element={
              <Protected>
                <AppShell />
              </Protected>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="new" element={<CreateGoal />} />
            <Route path="planner" element={<Planner />} />
            <Route path="planner/:goalId" element={<Planner />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="goal/:goalId" element={<GoalDetail />} />
            <Route path="studio" element={<Studio />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppErrorBoundary>
    <ToastViewport />
  </BrowserRouter>
);

export default App;
