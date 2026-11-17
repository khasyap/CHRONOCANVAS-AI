import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { addDays, setHours, setMinutes } from 'date-fns';
import type {
  Design,
  Goal,
  LogKind,
  Milestone,
  NotificationEntry,
  NotificationSettings,
  Profile,
  Settings,
  Toast,
  ToastTone,
  Workspace,
} from '@/types';
import {
  changeAccountPassword,
  defaultSettings,
  deleteAccount,
  emptyWorkspace,
  getSessionUser,
  loadFired,
  loadSettings,
  loadWorkspace,
  saveFired,
  saveSettings,
  saveWorkspace,
  signInAccount,
  signOutAccount,
  signUpAccount,
  updateAccount,
} from '@/lib/storage';
import { buildLocalPlan, draftToMilestones, offsetForDate } from '@/lib/planner';
import { collectReminders, showBrowserNotification } from '@/lib/notifications';
import { uid } from '@/lib/dates';

type SettingsPatch = Partial<Omit<Settings, 'ai' | 'notifications'>> & {
  ai?: Partial<Settings['ai']>;
  notifications?: Partial<NotificationSettings>;
};

interface AppContextValue {
  user: Profile | null;
  goals: Goal[];
  milestones: Milestone[];
  designs: Design[];
  log: NotificationEntry[];
  settings: Settings;
  toasts: Toast[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  updateProfile: (changes: Partial<Pick<Profile, 'name' | 'email'>>) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  removeAccount: () => void;
  createGoal: (goal: Goal, milestones: Milestone[]) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  setGoalArchived: (id: string, archived: boolean) => void;
  markGoalAchieved: (id: string) => void;
  addMilestone: (goalId: string, milestone: Omit<Milestone, 'id' | 'goalId' | 'order'>) => void;
  updateMilestone: (id: string, patch: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;
  toggleMilestone: (id: string) => void;
  replaceMilestones: (goalId: string, milestones: Milestone[]) => void;
  moveMilestone: (goalId: string, id: string, direction: -1 | 1) => void;
  saveDesign: (design: Design) => boolean;
  deleteDesign: (id: string) => void;
  clearDesigns: () => void;
  updateSettings: (patch: SettingsPatch) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
  clearLog: () => void;
  pushLog: (entry: Omit<NotificationEntry, 'id' | 'createdAt' | 'read'>) => void;
  pushToast: (title: string, description?: string, tone?: ToastTone) => void;
  dismissToast: (id: string) => void;
  loadDemoWorkspace: () => void;
  replaceWorkspace: (workspace: Workspace) => void;
  clearWorkspace: () => void;
  resetSettings: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const logEntry = (
  entry: { kind: LogKind; title: string; body: string; goalId?: string },
  now = new Date(),
): NotificationEntry => ({
  id: uid('log'),
  kind: entry.kind,
  title: entry.title,
  body: entry.body,
  goalId: entry.goalId,
  createdAt: now.toISOString(),
  read: false,
});

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const initialUser = useMemo(() => getSessionUser(), []);
  const [user, setUser] = useState<Profile | null>(initialUser);
  const [workspace, setWorkspace] = useState<Workspace>(() =>
    initialUser ? loadWorkspace(initialUser.id) : emptyWorkspace(),
  );
  const [settings, setSettings] = useState<Settings>(() =>
    initialUser ? loadSettings(initialUser.id) : defaultSettings(),
  );
  const [loadedFor, setLoadedFor] = useState<string | null>(initialUser?.id ?? null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const firedRef = useRef<Record<string, number>>(
    initialUser ? loadFired(initialUser.id) : {},
  );
  const toastTimers = useRef<Record<string, number>>({});
  const storageWarned = useRef(false);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = toastTimers.current[id];
    if (timer) {
      window.clearTimeout(timer);
      delete toastTimers.current[id];
    }
  }, []);

  const pushToast = useCallback(
    (title: string, description?: string, tone: ToastTone = 'default') => {
      const id = uid('toast');
      setToasts((prev) => [...prev.slice(-3), { id, title, description, tone }]);
      const timer = window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
        delete toastTimers.current[id];
      }, 5200);
      toastTimers.current[id] = timer;
    },
    [],
  );

  useEffect(
    () => () => {
      Object.values(toastTimers.current).forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const activate = useCallback((profile: Profile) => {
    setWorkspace(loadWorkspace(profile.id));
    setSettings(loadSettings(profile.id));
    firedRef.current = loadFired(profile.id);
    setLoadedFor(profile.id);
    setUser(profile);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const profile = await signInAccount(email, password);
      activate(profile);
      pushToast(`Welcome back, ${profile.name.split(' ')[0]}`, 'Your countdowns are exactly where you left them.', 'success');
    },
    [activate, pushToast],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const profile = await signUpAccount(name, email, password);
      activate(profile);
      pushToast('Your studio is ready', 'Create your first deadline and let the planner do the heavy lifting.', 'success');
    },
    [activate, pushToast],
  );

  const signOut = useCallback(() => {
    signOutAccount();
    setUser(null);
    setWorkspace(emptyWorkspace());
    setSettings(defaultSettings());
    setLoadedFor(null);
    firedRef.current = {};
    pushToast('Signed out', 'Your workspace stays saved on this device.', 'info');
  }, [pushToast]);

  const updateProfile = useCallback(
    async (changes: Partial<Pick<Profile, 'name' | 'email'>>) => {
      if (!user) throw new Error('You are not signed in.');
      const updated = updateAccount(user.id, changes);
      setUser(updated);
      pushToast('Profile updated', 'Your details are saved on this device.', 'success');
    },
    [user, pushToast],
  );

  const changePassword = useCallback(
    async (current: string, next: string) => {
      if (!user) throw new Error('You are not signed in.');
      await changeAccountPassword(user.id, current, next);
      pushToast('Password changed', 'Use your new password next time you sign in.', 'success');
    },
    [user, pushToast],
  );

  const removeAccount = useCallback(() => {
    if (!user) return;
    deleteAccount(user.id);
    setUser(null);
    setWorkspace(emptyWorkspace());
    setSettings(defaultSettings());
    setLoadedFor(null);
    firedRef.current = {};
  }, [user]);

  /* Persist workspace */
  useEffect(() => {
    if (!user || loadedFor !== user.id) return;
    const timer = window.setTimeout(() => {
      const ok = saveWorkspace(user.id, workspace);
      if (!ok && !storageWarned.current) {
        storageWarned.current = true;
        pushToast(
          'Local storage is full',
          'Remove a saved wallpaper or export a backup to free space. Your latest change may not persist.',
          'error',
        );
      }
    }, 320);
    return () => window.clearTimeout(timer);
  }, [workspace, user, loadedFor, pushToast]);

  /* Persist settings */
  useEffect(() => {
    if (!user || loadedFor !== user.id) return;
    saveSettings(user.id, settings);
  }, [settings, user, loadedFor]);

  /* Apply appearance */
  useEffect(() => {
    document.documentElement.dataset.theme = settings.mode;
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', settings.mode === 'dark' ? '#08120D' : '#F2EEE3');
  }, [settings.mode, settings.reduceMotion]);

  /* Reminder engine */
  useEffect(() => {
    if (!user) return;
    const tick = () => {
      try {
        const candidates = collectReminders(
          workspace.goals,
          workspace.milestones,
          settings.notifications,
          new Date(),
        );
        const fresh = candidates.filter((candidate) => !firedRef.current[candidate.key]);
        if (fresh.length === 0) return;
        fresh.forEach((candidate) => {
          firedRef.current[candidate.key] = Date.now();
        });
        saveFired(user.id, firedRef.current);
        setWorkspace((prev) => ({
          ...prev,
          log: [...fresh.map((entry) => logEntry(entry)), ...prev.log].slice(0, 120),
        }));
        fresh
          .filter((entry) => entry.kind !== 'overdue')
          .slice(0, 2)
          .forEach((entry) => {
            void showBrowserNotification(entry.title, entry.body, entry.key);
          });
        const milestoneAlert = fresh.find(
          (entry) => entry.kind === 'milestone' || entry.kind === 'deadline',
        );
        if (milestoneAlert) {
          pushToast(milestoneAlert.title, milestoneAlert.body.split('\n')[0], 'info');
        }
      } catch {
        /* the reminder loop must never break the app */
      }
    };
    tick();
    const interval = window.setInterval(tick, 30_000);
    return () => window.clearInterval(interval);
  }, [user, workspace.goals, workspace.milestones, settings.notifications, pushToast]);

  const createGoal = useCallback((goal: Goal, newMilestones: Milestone[]) => {
    setWorkspace((prev) => ({
      ...prev,
      goals: [goal, ...prev.goals],
      milestones: [...prev.milestones, ...newMilestones],
    }));
  }, []);

  const updateGoal = useCallback((id: string, patch: Partial<Goal>) => {
    setWorkspace((prev) => ({
      ...prev,
      goals: prev.goals.map((goal) =>
        goal.id === id ? { ...goal, ...patch, updatedAt: new Date().toISOString() } : goal,
      ),
    }));
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      goals: prev.goals.filter((goal) => goal.id !== id),
      milestones: prev.milestones.filter((m) => m.goalId !== id),
      designs: prev.designs.filter((design) => design.goalId !== id),
      log: prev.log.filter((entry) => entry.goalId !== id),
    }));
  }, []);

  const setGoalArchived = useCallback((id: string, archived: boolean) => {
    setWorkspace((prev) => ({
      ...prev,
      goals: prev.goals.map((goal) =>
        goal.id === id ? { ...goal, archived, updatedAt: new Date().toISOString() } : goal,
      ),
    }));
  }, []);

  const markGoalAchieved = useCallback(
    (id: string) => {
      setWorkspace((prev) => ({
        ...prev,
        goals: prev.goals.map((goal) =>
          goal.id === id
            ? {
                ...goal,
                achievedAt: new Date().toISOString(),
                archived: false,
                updatedAt: new Date().toISOString(),
              }
            : goal,
        ),
      }));
      pushToast('Marked achieved', 'Take a moment to notice what it took to get here.', 'success');
    },
    [pushToast],
  );

  const addMilestone = useCallback(
    (goalId: string, milestone: Omit<Milestone, 'id' | 'goalId' | 'order'>) => {
      setWorkspace((prev) => {
        const own = prev.milestones.filter((m) => m.goalId === goalId);
        return {
          ...prev,
          milestones: [
            ...prev.milestones,
            { ...milestone, id: uid('ms'), goalId, order: own.length },
          ],
        };
      });
    },
    [],
  );

  const updateMilestone = useCallback((id: string, patch: Partial<Milestone>) => {
    setWorkspace((prev) => {
      const target = prev.milestones.find((m) => m.id === id);
      if (!target) return prev;
      const goal = prev.goals.find((g) => g.id === target.goalId);
      const nextPatch = { ...patch };
      if (patch.date && goal) {
        nextPatch.offsetDays = offsetForDate(goal.deadline, patch.date);
      }
      return {
        ...prev,
        milestones: prev.milestones.map((m) => (m.id === id ? { ...m, ...nextPatch } : m)),
      };
    });
  }, []);

  const deleteMilestone = useCallback((id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((m) => m.id !== id),
    }));
  }, []);

  const toggleMilestone = useCallback((id: string) => {
    setWorkspace((prev) => {
      const target = prev.milestones.find((m) => m.id === id);
      if (!target) return prev;
      const willBeDone = !target.done;
      return {
        ...prev,
        milestones: prev.milestones.map((m) =>
          m.id === id
            ? {
                ...m,
                done: willBeDone,
                completedAt: willBeDone ? new Date().toISOString() : undefined,
              }
            : m,
        ),
      };
    });
  }, []);

  const replaceMilestones = useCallback((goalId: string, milestones: Milestone[]) => {
    setWorkspace((prev) => ({
      ...prev,
      milestones: [...prev.milestones.filter((m) => m.goalId !== goalId), ...milestones],
    }));
  }, []);

  const moveMilestone = useCallback((goalId: string, id: string, direction: -1 | 1) => {
    setWorkspace((prev) => {
      const own = prev.milestones
        .filter((m) => m.goalId === goalId)
        .slice()
        .sort(
          (a, b) =>
            a.order - b.order || new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
      const index = own.findIndex((m) => m.id === id);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= own.length) return prev;
      const copy = own.slice();
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      const resequenced = copy.map((m, order) => ({ ...m, order }));
      return {
        ...prev,
        milestones: [...prev.milestones.filter((m) => m.goalId !== goalId), ...resequenced],
      };
    });
  }, []);

  const saveDesign = useCallback((design: Design) => {
    setWorkspace((prev) => ({
      ...prev,
      designs: [design, ...prev.designs.filter((d) => d.id !== design.id)].slice(0, 24),
    }));
    return true;
  }, []);

  const deleteDesign = useCallback((id: string) => {
    setWorkspace((prev) => ({ ...prev, designs: prev.designs.filter((d) => d.id !== id) }));
  }, []);

  const clearDesigns = useCallback(() => {
    setWorkspace((prev) => ({ ...prev, designs: [] }));
  }, []);

  const updateSettings = useCallback((patch: SettingsPatch) => {
    setSettings((prev) => ({
      ...prev,
      ...patch,
      ai: { ...prev.ai, ...(patch.ai ?? {}) },
      notifications: { ...prev.notifications, ...(patch.notifications ?? {}) },
    }));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      log: prev.log.map((entry) => (entry.id === id ? { ...entry, read: true } : entry)),
    }));
  }, []);

  const markAllRead = useCallback(() => {
    setWorkspace((prev) => ({
      ...prev,
      log: prev.log.map((entry) => ({ ...entry, read: true })),
    }));
  }, []);

  const clearLog = useCallback(() => {
    setWorkspace((prev) => ({ ...prev, log: [] }));
  }, []);

  const pushLog = useCallback(
    (entry: Omit<NotificationEntry, 'id' | 'createdAt' | 'read'>) => {
      setWorkspace((prev) => ({
        ...prev,
        log: [logEntry(entry), ...prev.log].slice(0, 120),
      }));
    },
    [],
  );

  const loadDemoWorkspace = useCallback(() => {
    const now = new Date();
    const makeGoal = (
      name: string,
      category: Goal['category'],
      days: number,
      importance: Goal['importance'],
      prepMinutes: number,
      device: Goal['device'],
      themeNote: string,
    ): Goal => {
      const deadline = setMinutes(setHours(addDays(now, days), 18), 0);
      return {
        id: uid('goal'),
        name,
        deadline: deadline.toISOString(),
        category,
        importance,
        prepMinutes,
        reminderTime: '09:00',
        device,
        notes: themeNote,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        archived: false,
      };
    };

    const launchGoal = makeGoal(
      'Aurora Product Launch',
      'project',
      24,
      'professional',
      120,
      'desktop',
      'The first public release of Aurora. Keep the scope narrow and the finish calm.',
    );
    const travelGoal = makeGoal(
      'Kyoto in Autumn',
      'travel',
      68,
      'personal',
      60,
      'iphone',
      'Two weeks among the maples. A slow, beautifully planned trip.',
    );

    const launchDraft = buildLocalPlan(launchGoal, [], now);
    const travelDraft = buildLocalPlan(travelGoal, [], now);
    const launchMilestones = draftToMilestones(launchGoal, launchDraft).map((m, index) => ({
      ...m,
      done: index < 2,
      completedAt: index < 2 ? addDays(now, -10 + index * 3).toISOString() : undefined,
      priority: index === 0 ? ('critical' as const) : m.priority,
    }));
    const travelMilestones = draftToMilestones(travelGoal, travelDraft).map((m, index) => ({
      ...m,
      done: index === 0,
      completedAt: index === 0 ? addDays(now, -6).toISOString() : undefined,
    }));

    setWorkspace((prev) => {
      if (prev.goals.some((goal) => goal.name === launchGoal.name)) return prev;
      return {
        ...prev,
        goals: [launchGoal, travelGoal, ...prev.goals],
        milestones: [...launchMilestones, ...travelMilestones, ...prev.milestones],
        designs: prev.designs,
      };
    });
    pushToast('Sample workspace loaded', 'Two deadlines, real milestones, and ready-to-design countdowns.', 'success');
  }, [pushToast]);

  const replaceWorkspace = useCallback((next: Workspace) => {
    setWorkspace(next);
  }, []);

  const clearWorkspace = useCallback(() => {
    setWorkspace(emptyWorkspace());
    pushToast('Workspace cleared', 'Your account is intact. Start a new countdown whenever you are ready.', 'info');
  }, [pushToast]);

  const resetSettings = useCallback(() => {
    const defaults = defaultSettings();
    setSettings((prev) => ({ ...defaults, ai: { ...prev.ai }, mode: prev.mode }));
    pushToast('Preferences reset', 'Your API key and workspace were kept.', 'info');
  }, [pushToast]);

  const value: AppContextValue = {
    user,
    goals: workspace.goals,
    milestones: workspace.milestones,
    designs: workspace.designs,
    log: workspace.log,
    settings,
    toasts,
    signIn,
    signUp,
    signOut,
    updateProfile,
    changePassword,
    removeAccount,
    createGoal,
    updateGoal,
    deleteGoal,
    setGoalArchived,
    markGoalAchieved,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    toggleMilestone,
    replaceMilestones,
    moveMilestone,
    saveDesign,
    deleteDesign,
    clearDesigns,
    updateSettings,
    markNotificationRead,
    markAllRead,
    clearLog,
    pushLog,
    pushToast,
    dismissToast,
    loadDemoWorkspace,
    replaceWorkspace,
    clearWorkspace,
    resetSettings,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextValue => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
};

export const useActiveGoals = (): Goal[] => {
  const { goals } = useApp();
  return useMemo(() => goals.filter((goal) => !goal.archived), [goals]);
};
