import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CircleAlert,
  Database,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import type { DeviceId, Settings, Workspace } from '@/types';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Toggle } from '@/components/Toggle';
import { Modal } from '@/components/Modal';
import { NotificationPreferences } from '@/components/NotificationPreferences';
import { DEVICES } from '@/lib/catalog';
import { isAIConfigured, testAIConnection } from '@/lib/ai';
import { exportBackup, parseBackup } from '@/lib/storage';
import { downloadAllCalendars } from '@/lib/ics';
import { downloadUrl, initials, validateEmail, cn } from '@/lib/utils';
import { fmtDateLong } from '@/lib/dates';

type TabId = 'profile' | 'appearance' | 'ai' | 'notifications' | 'data';

const tabs: { id: TabId; label: string; icon: typeof UserRound; hint: string }[] = [
  { id: 'profile', label: 'Profile', icon: UserRound, hint: 'Identity and security' },
  { id: 'appearance', label: 'Appearance', icon: Palette, hint: 'Mode, motion and defaults' },
  { id: 'ai', label: 'Gemini AI', icon: Sparkles, hint: 'Planning and image models' },
  { id: 'notifications', label: 'Notifications', icon: Bell, hint: 'Reminder rhythm' },
  { id: 'data', label: 'Your data', icon: Database, hint: 'Backups and account' },
];

interface ImportPending {
  workspace: Workspace;
  settings?: Partial<Settings>;
}

export const SettingsPage = () => {
  const {
    user,
    goals,
    milestones,
    designs,
    log,
    settings,
    updateSettings,
    updateProfile,
    changePassword,
    removeAccount,
    replaceWorkspace,
    clearWorkspace,
    resetSettings,
    signOut,
    pushToast,
  } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('profile');

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [aiKey, setAiKey] = useState(settings.ai.apiKey);
  const [textModel, setTextModel] = useState(settings.ai.textModel);
  const [imageModel, setImageModel] = useState(settings.ai.imageModel);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [aiSaved, setAiSaved] = useState(false);

  const [importPending, setImportPending] = useState<ImportPending | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
  }, [user]);

  useEffect(() => {
    setAiKey(settings.ai.apiKey);
    setTextModel(settings.ai.textModel);
    setImageModel(settings.ai.imageModel);
  }, [settings.ai.apiKey, settings.ai.textModel, settings.ai.imageModel]);

  if (!user) return null;

  const saveProfile = async () => {
    setProfileError(null);
    if (name.trim().length < 2) {
      setProfileError('Use at least 2 characters for your name.');
      return;
    }
    if (!validateEmail(email)) {
      setProfileError('Enter a valid email address.');
      return;
    }
    setProfileSaving(true);
    try {
      await updateProfile({ name: name.trim(), email: email.trim() });
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not update your profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const savePassword = async () => {
    setPasswordError(null);
    if (!currentPassword) {
      setPasswordError('Enter your current password.');
      return;
    }
    if (nextPassword.length < 8) {
      setPasswordError('Your new password must be at least 8 characters.');
      return;
    }
    if (nextPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, nextPassword);
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Could not change your password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const saveAI = () => {
    updateSettings({
      ai: {
        apiKey: aiKey.trim(),
        textModel: textModel.trim() || 'gemini-2.5-flash',
        imageModel: imageModel.trim() || 'gemini-2.5-flash-image',
      },
    });
    setAiSaved(true);
    setTestResult(null);
    pushToast('AI settings saved', 'The key stays in this browser only.', 'success');
    window.setTimeout(() => setAiSaved(false), 2400);
  };

  const runTest = async () => {
    if (!aiKey.trim()) {
      setTestResult({ tone: 'error', message: 'Add an API key before testing the connection.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const reply = await testAIConnection({
        ...settings,
        ai: {
          apiKey: aiKey.trim(),
          textModel: textModel.trim() || 'gemini-2.5-flash',
          imageModel: imageModel.trim() || 'gemini-2.5-flash-image',
        },
      });
      setTestResult({
        tone: 'success',
        message: `Connected. Gemini replied “${reply.replace(/[".]/g, '').slice(0, 60)}”.`,
      });
    } catch (error) {
      setTestResult({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Gemini could not be reached.',
      });
    } finally {
      setTesting(false);
    }
  };

  const exportData = () => {
    const payload = exportBackup(user, { goals, milestones, designs, log }, settings);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    downloadUrl(url, `chronocanvas-backup-${new Date().toISOString().slice(0, 10)}.json`);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    pushToast('Backup exported', 'Goal data, designs and preferences — without your API key.', 'success');
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = parseBackup(raw);
      setImportPending(parsed);
      setImportOpen(true);
    } catch (error) {
      pushToast(
        'That backup could not be read',
        error instanceof Error ? error.message : 'Choose a ChronoCanvas JSON export.',
        'error',
      );
    }
  };

  const applyImport = () => {
    if (!importPending) return;
    replaceWorkspace(importPending.workspace);
    const restored = importPending.settings;
    if (restored) {
      updateSettings({
        ...(restored.mode ? { mode: restored.mode } : {}),
        ...(restored.weekStartsOn !== undefined ? { weekStartsOn: restored.weekStartsOn } : {}),
        ...(restored.defaultDevice ? { defaultDevice: restored.defaultDevice } : {}),
        ...(typeof restored.reduceMotion === 'boolean' ? { reduceMotion: restored.reduceMotion } : {}),
        ...(restored.notifications ? { notifications: restored.notifications } : {}),
      });
    }
    setImportOpen(false);
    setImportPending(null);
    pushToast(
      'Workspace restored',
      `${importPending.workspace.goals.length} goal${
        importPending.workspace.goals.length === 1 ? '' : 's'
      } imported. Your API key was preserved.`,
      'success',
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Settings & profile"
        title="Make the studio yours."
        description="Your account, your appearance, your AI connection and your data — all local unless you choose otherwise."
        actions={
          <Link to="/app" className="btn btn-outline">
            Back to overview
          </Link>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[220px_1fr]">
        <nav className="scroll-thin flex gap-1.5 overflow-x-auto lg:sticky lg:top-24 lg:flex-col lg:overflow-visible">
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all lg:w-full',
                  active
                    ? 'border-accent/40 bg-accent/[0.06] text-ink'
                    : 'border-transparent text-muted hover:border-stroke hover:bg-surface/50 hover:text-ink',
                )}
              >
                <item.icon className={cn('h-4 w-4', active ? 'text-accent' : 'text-faint')} strokeWidth={1.7} />
                <span>
                  <span className="block text-[11px]">{item.label}</span>
                  <span className="hidden text-[8.5px] text-faint lg:block">{item.hint}</span>
                </span>
              </button>
            );
          })}
          <div className="hidden border-t border-stroke pt-3 lg:block">
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[11px] text-faint transition-colors hover:bg-surface/50 hover:text-ink"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </nav>

        <div className="space-y-5">
          {tab === 'profile' && (
            <>
              <section className="glass rounded-3xl p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <span
                    className="display flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-white/15 text-2xl text-white shadow-lift"
                    style={{
                      background: `linear-gradient(140deg, hsl(${user.avatarHue} 52% 46%), hsl(${(user.avatarHue + 52) % 360} 42% 32%))`,
                    }}
                  >
                    {initials(user.name)}
                  </span>
                  <div>
                    <p className="eyebrow-bright">Local studio account</p>
                    <h2 className="display mt-1.5 text-2xl text-ink">{user.name}</h2>
                    <p className="mt-1 text-[11px] text-muted">Member since {fmtDateLong(user.createdAt, 'd MMMM yyyy')}</p>
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-stroke px-2 py-1 text-[8px] uppercase tracking-[0.12em] text-faint">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      Stored on this device
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="field-label" htmlFor="profile-name">
                      Name
                    </label>
                    <input
                      id="profile-name"
                      className="field"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="profile-email">
                      Email
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      className="field"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                </div>
                {profileError && <p className="mt-2 text-[11px] text-[color:var(--danger)]">{profileError}</p>}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-[9px] leading-relaxed text-faint">
                    Email is used only as your local sign-in identifier.
                  </p>
                  <Button variant="gold" size="sm" onClick={() => void saveProfile()} loading={profileSaving} icon={<Save className="h-3.5 w-3.5" />}>
                    Save profile
                  </Button>
                </div>
              </section>

              <section className="glass rounded-3xl p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-accent" />
                  <h2 className="display text-xl text-ink">Change password</h2>
                </div>
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-faint">
                  Passwords are hashed with PBKDF2 and a unique salt. Changing it does not affect your data.
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="field-label" htmlFor="current-password">
                      Current
                    </label>
                    <input
                      id="current-password"
                      type={showPassword ? 'text' : 'password'}
                      className="field"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="new-password">
                      New password
                    </label>
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      className="field"
                      value={nextPassword}
                      onChange={(event) => setNextPassword(event.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="confirm-password">
                      Confirm
                    </label>
                    <input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      className="field"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                {passwordError && <p className="mt-2 text-[11px] text-[color:var(--danger)]">{passwordError}</p>}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.1em] text-faint hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {showPassword ? 'Hide' : 'Show'} passwords
                  </button>
                  <Button variant="outline" size="sm" onClick={() => void savePassword()} loading={passwordSaving}>
                    Update password
                  </Button>
                </div>
              </section>

              <section className="rounded-3xl border border-stroke bg-surface/30 p-5">
                <p className="eyebrow">Session</p>
                <div className="mt-3 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                  <p className="max-w-md text-[10.5px] leading-relaxed text-faint">
                    Signing out keeps every goal, milestone and design on this device. Sign in again with your
                    email and password to return.
                  </p>
                  <Button variant="outline" size="sm" onClick={signOut} icon={<LogOut className="h-3.5 w-3.5" />}>
                    Sign out
                  </Button>
                </div>
              </section>
            </>
          )}

          {tab === 'appearance' && (
            <>
              <section className="glass rounded-3xl p-5 sm:p-6">
                <p className="eyebrow-bright">Appearance</p>
                <h2 className="display mt-1.5 text-xl text-ink">Choose your palette</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      { id: 'dark' as const, label: 'Forest', note: 'Deep evergreen, brass, quiet sage', icon: Moon },
                      { id: 'light' as const, label: 'Ivory', note: 'Soft ivory, ink, warm gold', icon: Sun },
                    ]
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => updateSettings({ mode: mode.id })}
                      className={cn(
                        'overflow-hidden rounded-2xl border text-left transition-all',
                        settings.mode === mode.id ? 'border-accent/60' : 'border-stroke hover:border-stroke-strong',
                      )}
                    >
                      <div
                        className="relative h-24 p-3"
                        style={{
                          background:
                            mode.id === 'dark'
                              ? 'linear-gradient(150deg,#08120D,#122117 60%,#24382A)'
                              : 'linear-gradient(150deg,#f5f0e4,#ece5d5 60%,#ded5c2)',
                        }}
                      >
                        <div
                          className="absolute left-3 top-3 rounded-lg border px-2 py-1.5"
                          style={{
                            background: mode.id === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.6)',
                            borderColor: mode.id === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(31,45,33,0.08)',
                          }}
                        >
                          <div className="h-1 w-12 rounded-full" style={{ background: '#B8914F' }} />
                          <div className="mt-1.5 h-1 w-8 rounded-full" style={{ background: mode.id === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(26,36,28,0.2)' }} />
                        </div>
                        <div
                          className="absolute bottom-3 right-3 display text-3xl"
                          style={{ color: mode.id === 'dark' ? '#D9B678' : '#7D6128' }}
                        >
                          24
                        </div>
                      </div>
                      <div className="flex items-center justify-between bg-surface/50 px-3 py-2.5">
                        <div>
                          <p className="flex items-center gap-1.5 text-[11px] text-ink">
                            <mode.icon className="h-3 w-3" />
                            {mode.label}
                          </p>
                          <p className="mt-0.5 text-[8.5px] text-faint">{mode.note}</p>
                        </div>
                        {settings.mode === mode.id && <Check className="h-4 w-4 text-accent" />}
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="glass rounded-3xl p-5 sm:p-6">
                <h2 className="display text-xl text-ink">Comfort & defaults</h2>
                <div className="mt-5 space-y-5">
                  <Toggle
                    checked={settings.reduceMotion}
                    onChange={(reduceMotion) => updateSettings({ reduceMotion })}
                    label="Reduce motion"
                    description="Minimises background drift, float and page transitions."
                  />
                  <div className="h-px bg-stroke" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="field-label" htmlFor="week-start">
                        Week starts on
                      </label>
                      <select
                        id="week-start"
                        className="field"
                        value={settings.weekStartsOn}
                        onChange={(event) =>
                          updateSettings({ weekStartsOn: Number(event.target.value) as 0 | 1 })
                        }
                      >
                        <option value={1}>Monday</option>
                        <option value={0}>Sunday</option>
                      </select>
                    </div>
                    <div>
                      <label className="field-label" htmlFor="default-device">
                        Default wallpaper device
                      </label>
                      <select
                        id="default-device"
                        className="field"
                        value={settings.defaultDevice}
                        onChange={(event) =>
                          updateSettings({ defaultDevice: event.target.value as DeviceId })
                        }
                      >
                        {DEVICES.map((device) => (
                          <option key={device.id} value={device.id}>
                            {device.label} · {device.detail}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-stroke pt-4">
                  <p className="max-w-sm text-[9px] leading-relaxed text-faint">
                    Resetting preferences keeps your account, workspace and API key intact.
                  </p>
                  <Button variant="ghost" size="sm" onClick={resetSettings}>
                    Reset preferences
                  </Button>
                </div>
              </section>
            </>
          )}

          {tab === 'ai' && (
            <>
              <section className="glass rounded-3xl p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow-bright">Gemini integration</p>
                    <h2 className="display mt-1.5 text-xl text-ink">Connect your own AI</h2>
                    <p className="mt-1.5 max-w-lg text-[10.5px] leading-relaxed text-faint">
                      Planning, coaching, art direction and image generation run through Google's Gemini API.
                      Your key is stored only in this browser and sent directly to Google.
                    </p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] uppercase tracking-[0.12em]',
                      isAIConfigured(settings)
                        ? 'border-[rgba(125,211,168,0.35)] bg-[rgba(125,211,168,0.08)] text-[color:var(--success)]'
                        : 'border-stroke text-faint',
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', isAIConfigured(settings) ? 'bg-[color:var(--success)]' : 'bg-faint')} />
                    {isAIConfigured(settings) ? 'Key saved' : 'Not connected'}
                  </span>
                </div>

                <div className="mt-5">
                  <label className="field-label" htmlFor="ai-key">
                    Gemini API key
                  </label>
                  <div className="relative">
                    <input
                      id="ai-key"
                      type={showKey ? 'text' : 'password'}
                      className="field pr-11 font-mono text-[11px]"
                      value={aiKey}
                      onChange={(event) => {
                        setAiKey(event.target.value);
                        setTestResult(null);
                      }}
                      placeholder="AIza…"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((value) => !value)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-faint hover:text-ink"
                      aria-label={showKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[9px] text-faint">
                    Create a key at{' '}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="link-underline"
                    >
                      Google AI Studio
                    </a>
                    . It is never included in exports, logs or wallpapers.
                  </p>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="field-label" htmlFor="text-model">
                      Planning model
                    </label>
                    <input
                      id="text-model"
                      className="field font-mono text-[11px]"
                      value={textModel}
                      onChange={(event) => setTextModel(event.target.value)}
                      list="text-models"
                      spellCheck={false}
                    />
                    <datalist id="text-models">
                      <option value="gemini-2.5-flash" />
                      <option value="gemini-2.5-pro" />
                      <option value="gemini-2.0-flash" />
                    </datalist>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="image-model">
                      Image model
                    </label>
                    <input
                      id="image-model"
                      className="field font-mono text-[11px]"
                      value={imageModel}
                      onChange={(event) => setImageModel(event.target.value)}
                      list="image-models"
                      spellCheck={false}
                    />
                    <datalist id="image-models">
                      <option value="gemini-2.5-flash-image" />
                      <option value="gemini-2.0-flash-preview-image-generation" />
                    </datalist>
                  </div>
                </div>

                {testResult && (
                  <div
                    className={cn(
                      'mt-4 flex items-start gap-2.5 rounded-xl border p-3',
                      testResult.tone === 'success'
                        ? 'border-[rgba(125,211,168,0.3)] bg-[rgba(125,211,168,0.07)]'
                        : 'border-[rgba(255,139,139,0.3)] bg-[rgba(255,139,139,0.07)]',
                    )}
                  >
                    {testResult.tone === 'success' ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--success)]" />
                    ) : (
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--danger)]" />
                    )}
                    <p
                      className="text-[10.5px] leading-relaxed"
                      style={{
                        color:
                          testResult.tone === 'success'
                            ? 'var(--success)'
                            : 'var(--danger)',
                      }}
                    >
                      {testResult.message}
                    </p>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button
                    variant="gold"
                    onClick={saveAI}
                    icon={aiSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  >
                    {aiSaved ? 'Saved' : 'Save configuration'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void runTest()}
                    loading={testing}
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                  >
                    Test connection
                  </Button>
                  {isAIConfigured(settings) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAiKey('');
                        updateSettings({ ai: { apiKey: '' } });
                        setTestResult(null);
                        pushToast('API key removed', 'The on-device planner still works without it.', 'info');
                      }}
                    >
                      Remove key
                    </Button>
                  )}
                </div>
              </section>

              <section className="glass-soft rounded-3xl p-5">
                <h3 className="display text-lg text-ink">What the key unlocks</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      title: 'Deeper planning',
                      body: 'Gemini reads the category, time budget and your answers, then writes a tailored milestone schedule.',
                    },
                    {
                      title: 'Real art direction',
                      body: 'Describe a mood in natural language and the studio translates it into a composition or a generated background.',
                    },
                    {
                      title: 'Reference analysis',
                      body: 'Upload an image and Gemini extracts a palette, tone and theme — not just an average color.',
                    },
                    {
                      title: 'Contextual coaching',
                      body: 'A daily briefing that knows which milestone slipped and what genuinely deserves attention.',
                    },
                  ].map((item) => (
                    <div key={item.title} className="rounded-xl border border-stroke bg-surface/40 p-3.5">
                      <p className="text-[11px] text-ink">{item.title}</p>
                      <p className="mt-1 text-[9.5px] leading-relaxed text-faint">{item.body}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[9px] leading-relaxed text-faint">
                  No key? The on-device planner, all ten wallpaper themes, local palette extraction, live
                  countdowns, reminders and calendar exports still work fully.
                </p>
              </section>
            </>
          )}

          {tab === 'notifications' && (
            <section className="glass rounded-3xl p-5 sm:p-6">
              <p className="eyebrow-bright">Notifications</p>
              <h2 className="display mt-1.5 text-xl text-ink">Decide how often the studio speaks</h2>
              <p className="mt-1.5 max-w-lg text-[10.5px] leading-relaxed text-faint">
                Reminders fire while ChronoCanvas is open. In-app history is always kept so you can catch up.
              </p>
              <div className="mt-5">
                <NotificationPreferences />
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stroke pt-4">
                <p className="text-[9px] text-faint">See what has already fired in the notification timeline.</p>
                <Link to="/app/notifications" className="btn btn-outline btn-sm">
                  <Bell className="h-3.5 w-3.5" />
                  Open notifications
                </Link>
              </div>
            </section>
          )}

          {tab === 'data' && (
            <>
              <section className="glass rounded-3xl p-5 sm:p-6">
                <p className="eyebrow-bright">Backup</p>
                <h2 className="display mt-1.5 text-xl text-ink">Your data, portable</h2>
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-faint">
                  Export every goal, milestone, saved wallpaper, time capsule and preference as JSON. API
                  keys are never included.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="gold" onClick={exportData} icon={<Download className="h-4 w-4" />}>
                    Export backup
                  </Button>
                  <input
                    ref={importRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(event) => {
                      void handleImportFile(event.target.files?.[0]);
                      event.target.value = '';
                    }}
                  />
                  <Button variant="outline" onClick={() => importRef.current?.click()} icon={<Upload className="h-4 w-4" />}>
                    Import backup
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => downloadAllCalendars(goals, milestones)}
                    disabled={milestones.length === 0}
                    icon={<Download className="h-4 w-4" />}
                  >
                    Export calendar
                  </Button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {[
                    { label: 'Goals', value: goals.length },
                    { label: 'Milestones', value: milestones.length },
                    { label: 'Saved designs', value: designs.length },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-stroke bg-surface/40 px-3 py-2.5">
                      <p className="text-[8px] uppercase tracking-[0.12em] text-faint">{item.label}</p>
                      <p className="display num mt-1 text-xl text-ink">{item.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-stroke bg-surface/30 p-5">
                <h3 className="display text-lg text-ink">Clear the workspace</h3>
                <p className="mt-1.5 max-w-xl text-[10.5px] leading-relaxed text-faint">
                  Removes every goal, milestone, design and notification entry for this account. Your login
                  and preferences stay intact. Export a backup first if you may want it later.
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  className="mt-4"
                  onClick={() => setClearOpen(true)}
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Clear workspace
                </Button>
              </section>

              <section className="rounded-3xl border border-[rgba(255,139,139,0.24)] bg-[rgba(255,139,139,0.04)] p-5">
                <h3 className="display text-lg text-ink">Delete your account</h3>
                <p className="mt-1.5 max-w-xl text-[10.5px] leading-relaxed text-faint">
                  Permanently removes this local account, every countdown, every design and all stored
                  preferences from this browser. There is no cloud copy to restore.
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setDeleteConfirm('');
                    setDeleteOpen(true);
                  }}
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Delete account
                </Button>
              </section>

              <p className="text-center text-[8px] uppercase tracking-[0.16em] text-faint">
                ChronoCanvas AI v1.0 · Local-first · Built for the days that matter
              </p>
            </>
          )}
        </div>
      </div>

      <Modal
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          setImportPending(null);
        }}
        title="Restore this backup?"
        description="It will replace the goals, milestones and designs currently in this workspace. Your login and API key stay as they are."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setImportOpen(false);
                setImportPending(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="gold" onClick={applyImport} icon={<Upload className="h-4 w-4" />}>
              Replace workspace
            </Button>
          </>
        }
      >
        {importPending && (
          <div className="space-y-2">
            <p className="rounded-xl border border-stroke bg-surface/50 p-3 text-[11px] text-ink">
              {importPending.workspace.goals.length} goals · {importPending.workspace.milestones.length}{' '}
              milestones · {importPending.workspace.designs.length} designs
            </p>
            <p className="text-[9.5px] leading-relaxed text-faint">
              Imported notification settings and appearance will also be applied. API configuration is kept.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Clear this workspace?"
        description="Goals, milestones, wallpapers and notification history will be removed. This cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setClearOpen(false)}>
              Keep my work
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearWorkspace();
                setClearOpen(false);
              }}
            >
              Clear workspace
            </Button>
          </>
        }
      >
        <p className="rounded-xl border border-stroke bg-surface/50 p-3 text-[11px] text-muted">
          {goals.length} goals, {milestones.length} milestones and {designs.length} designs will be removed.
        </p>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this account?"
        description="Everything stored for this local account will be erased. Type DELETE to confirm."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteConfirm !== 'DELETE'}
              onClick={() => {
                removeAccount();
                pushToast('Account deleted', 'This device no longer holds your ChronoCanvas workspace.', 'info');
                navigate('/signin', { replace: true });
              }}
            >
              Delete account
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-[rgba(255,139,139,0.28)] bg-[rgba(255,139,139,0.05)] p-3">
            <p className="flex items-center gap-2 text-[10.5px] text-[color:var(--danger)]">
              <CircleAlert className="h-3.5 w-3.5" />
              {user.name} · {user.email}
            </p>
            <p className="mt-1.5 text-[9.5px] leading-relaxed text-faint">
              {goals.length} goals and {designs.length} designs will be permanently deleted.
            </p>
          </div>
          <input
            className="field"
            value={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.value)}
            placeholder="Type DELETE"
            aria-label="Type DELETE to confirm account deletion"
          />
        </div>
      </Modal>
    </div>
  );
};
