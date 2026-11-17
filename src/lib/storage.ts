import type {
  NotificationEntry,
  Profile,
  Settings,
  StoredUser,
  Workspace,
} from '@/types';

const VERSION = 'chronocanvas.v1';
const K = {
  users: `${VERSION}.users`,
  session: `${VERSION}.session`,
  workspace: (userId: string) => `${VERSION}.workspace.${userId}`,
  settings: (userId: string) => `${VERSION}.settings.${userId}`,
  fired: (userId: string) => `${VERSION}.fired.${userId}`,
};

const canUseStorage = (): boolean => {
  try {
    const probe = `${VERSION}.probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
};

const read = <T>(key: string, fallback: T): T => {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown): boolean => {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const remove = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
};

/* ------------------------------------------------------------------ */
/* Crypto                                                              */
/* ------------------------------------------------------------------ */

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const randomSalt = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
};

const hexToBytes = (hex: string): Uint8Array => {
  const pairs = hex.match(/.{1,2}/g) ?? [];
  return new Uint8Array(pairs.map((byte) => parseInt(byte, 16)));
};

const deriveHash = async (password: string, salt: string): Promise<string> => {
  if (!crypto?.subtle) {
    throw new Error('Secure storage is not available in this browser. Try a modern browser over HTTPS or localhost.');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const rawSalt = hexToBytes(salt);
  const saltBytes = new Uint8Array(rawSalt.length);
  saltBytes.set(rawSalt);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer,
      iterations: 120_000,
      hash: 'SHA-256',
    },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
};

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

const readUsers = (): StoredUser[] => read<StoredUser[]>(K.users, []);

const publicProfile = (user: StoredUser): Profile => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
  avatarHue: user.avatarHue,
});

const SESSION_DAYS = 30;

export interface SessionRecord {
  userId: string;
  createdAt: string;
  expiresAt: string;
}

const saveSession = (userId: string): void => {
  const now = new Date();
  const expiry = new Date(now.getTime() + SESSION_DAYS * 86400_000);
  write(K.session, {
    userId,
    createdAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
  } satisfies SessionRecord);
};

export const getSessionUser = (): Profile | null => {
  const session = read<SessionRecord | null>(K.session, null);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    remove(K.session);
    return null;
  }
  const user = readUsers().find((u) => u.id === session.userId);
  return user ? publicProfile(user) : null;
};

export const signUpAccount = async (
  name: string,
  email: string,
  password: string,
): Promise<Profile> => {
  const users = readUsers();
  const normalized = email.trim().toLowerCase();
  if (users.some((u) => u.email === normalized)) {
    throw new Error('An account with that email already exists on this device. Sign in instead.');
  }
  const salt = randomSalt();
  const passwordHash = await deriveHash(password, salt);
  const user: StoredUser = {
    id: `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    email: normalized,
    createdAt: new Date().toISOString(),
    avatarHue: Math.floor(Math.random() * 360),
    salt,
    passwordHash,
  };
  const next = [...users, user];
  if (!write(K.users, next)) {
    throw new Error('This browser could not store your account. Check that local storage is enabled.');
  }
  saveSession(user.id);
  return publicProfile(user);
};

export const signInAccount = async (email: string, password: string): Promise<Profile> => {
  const normalized = email.trim().toLowerCase();
  const user = readUsers().find((u) => u.email === normalized);
  if (!user) throw new Error('No account found for that email on this device.');
  const hash = await deriveHash(password, user.salt);
  if (hash !== user.passwordHash) throw new Error('That password does not match. Try again.');
  saveSession(user.id);
  return publicProfile(user);
};

export const signOutAccount = (): void => {
  remove(K.session);
};

export const updateAccount = (userId: string, changes: Partial<Pick<Profile, 'name' | 'email'>>): Profile => {
  const users = readUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) throw new Error('Account not found.');
  const nextEmail = changes.email?.trim().toLowerCase() ?? users[index].email;
  if (nextEmail !== users[index].email && users.some((u) => u.email === nextEmail)) {
    throw new Error('Another account already uses that email.');
  }
  const updated: StoredUser = {
    ...users[index],
    name: changes.name?.trim() || users[index].name,
    email: nextEmail,
  };
  users[index] = updated;
  write(K.users, users);
  return publicProfile(updated);
};

export const changeAccountPassword = async (
  userId: string,
  currentPassword: string,
  nextPassword: string,
): Promise<void> => {
  const users = readUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) throw new Error('Account not found.');
  const currentHash = await deriveHash(currentPassword, users[index].salt);
  if (currentHash !== users[index].passwordHash) throw new Error('Your current password is incorrect.');
  const salt = randomSalt();
  const passwordHash = await deriveHash(nextPassword, salt);
  users[index] = { ...users[index], salt, passwordHash };
  write(K.users, users);
};

export const deleteAccount = (userId: string): void => {
  write(K.users, readUsers().filter((u) => u.id !== userId));
  remove(K.workspace(userId));
  remove(K.settings(userId));
  remove(K.fired(userId));
  remove(K.session);
};

/* ------------------------------------------------------------------ */
/* Workspace                                                           */
/* ------------------------------------------------------------------ */

export const emptyWorkspace = (): Workspace => ({
  goals: [],
  milestones: [],
  designs: [],
  log: [],
});

const isWorkspace = (value: unknown): value is Workspace => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Workspace>;
  return (
    Array.isArray(candidate.goals) &&
    Array.isArray(candidate.milestones) &&
    Array.isArray(candidate.designs) &&
    Array.isArray(candidate.log)
  );
};

export const loadWorkspace = (userId: string): Workspace => {
  const stored = read<unknown>(K.workspace(userId), null);
  if (!isWorkspace(stored)) return emptyWorkspace();
  return {
    goals: stored.goals,
    milestones: stored.milestones,
    designs: stored.designs.slice(0, 24),
    log: stored.log.slice(0, 120) as NotificationEntry[],
  };
};

export const saveWorkspace = (userId: string, workspace: Workspace): boolean =>
  write(K.workspace(userId), workspace);

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export const defaultSettings = (): Settings => ({
  mode: 'dark',
  ai: {
    apiKey: '',
    textModel: 'gemini-2.5-flash',
    imageModel: 'gemini-2.5-flash-image',
  },
  notifications: {
    enabled: false,
    daily: true,
    dailyTime: '09:00',
    milestoneReminders: true,
    milestoneLead: 60,
    overdue: true,
    deadlineAlerts: true,
    frequency: 'gentle',
    paused: false,
    quietStart: '22:30',
    quietEnd: '07:00',
  },
  weekStartsOn: 1,
  defaultDevice: 'iphone',
  reduceMotion: false,
});

export const loadSettings = (userId: string): Settings => {
  const defaults = defaultSettings();
  const stored = read<Partial<Settings>>(K.settings(userId), {});
  return {
    ...defaults,
    ...stored,
    ai: { ...defaults.ai, ...(stored.ai ?? {}) },
    notifications: { ...defaults.notifications, ...(stored.notifications ?? {}) },
  };
};

export const saveSettings = (userId: string, settings: Settings): boolean =>
  write(K.settings(userId), settings);

/* ------------------------------------------------------------------ */
/* Notification dedupe                                                 */
/* ------------------------------------------------------------------ */

export const loadFired = (userId: string): Record<string, number> => {
  const stored = read<Record<string, number>>(K.fired(userId), {});
  const cutoff = Date.now() - 30 * 86400_000;
  const fresh: Record<string, number> = {};
  Object.entries(stored).forEach(([key, at]) => {
    if (typeof at === 'number' && at > cutoff) fresh[key] = at;
  });
  return fresh;
};

export const saveFired = (userId: string, fired: Record<string, number>): void => {
  write(K.fired(userId), fired);
};

/* ------------------------------------------------------------------ */
/* Export / import                                                     */
/* ------------------------------------------------------------------ */

export const exportBackup = (profile: Profile, workspace: Workspace, settings: Settings): string =>
  JSON.stringify(
    {
      app: 'ChronoCanvas AI',
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: { name: profile.name, email: profile.email },
      workspace,
      settings: { ...settings, ai: { ...settings.ai, apiKey: '' } },
    },
    null,
    2,
  );

export const parseBackup = (
  raw: string,
): { workspace: Workspace; settings?: Partial<Settings> } => {
  const parsed = JSON.parse(raw) as {
    workspace?: unknown;
    settings?: Partial<Settings>;
  };
  if (!isWorkspace(parsed.workspace)) {
    throw new Error('That file is not a valid ChronoCanvas backup.');
  }
  return {
    workspace: {
      goals: parsed.workspace.goals,
      milestones: parsed.workspace.milestones,
      designs: parsed.workspace.designs.slice(0, 24),
      log: parsed.workspace.log.slice(0, 120),
    },
    settings: parsed.settings,
  };
};
