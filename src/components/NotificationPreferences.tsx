import { useState } from 'react';
import { BellRing, BellOff, Send, ShieldCheck } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import {
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  testNotification,
} from '@/lib/notifications';
import { Toggle } from './Toggle';
import { Button } from './Button';
import { cn } from '@/lib/utils';

export const NotificationPreferences = ({ compact = false }: { compact?: boolean }) => {
  const { settings, updateSettings, pushToast } = useApp();
  const prefs = settings.notifications;
  const [permission, setPermission] = useState(notificationPermission());
  const [requesting, setRequesting] = useState(false);
  const [testing, setTesting] = useState(false);

  const supported = notificationsSupported();

  const handleEnable = async (next: boolean) => {
    if (!next) {
      updateSettings({ notifications: { enabled: false } });
      return;
    }
    if (permission === 'granted') {
      updateSettings({ notifications: { enabled: true, paused: false } });
      return;
    }
    setRequesting(true);
    const result = await requestNotificationPermission();
    setPermission(result);
    setRequesting(false);
    if (result === 'granted') {
      updateSettings({ notifications: { enabled: true, paused: false } });
      pushToast('Reminders are on', 'We will nudge you while ChronoCanvas is open in a tab.', 'success');
    } else {
      pushToast(
        'Browser notifications were not granted',
        'In-app reminders and your notification centre will still work. Allow notifications in your browser settings to receive system alerts.',
        'error',
      );
    }
  };

  const handleTest = async () => {
    setTesting(true);
    const ok = await testNotification();
    setTesting(false);
    if (!ok) {
      pushToast(
        'Could not send a system notification',
        'Check your browser notification permission. In-app alerts still work.',
        'error',
      );
    } else {
      pushToast('Test sent', 'A system notification should have appeared.', 'success');
    }
  };

  const permissionLabel =
    permission === 'granted'
      ? 'System notifications allowed'
      : permission === 'denied'
        ? 'System notifications blocked'
        : permission === 'unsupported'
          ? 'Not supported in this browser'
          : 'Permission not requested yet';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-stroke bg-surface/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'mt-0.5 flex h-9 w-9 items-center justify-center rounded-full',
              prefs.enabled ? 'bg-accent/12 text-accent' : 'bg-surface2 text-faint',
            )}
          >
            {prefs.enabled ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </span>
          <div>
            <p className="text-sm text-ink">{prefs.enabled ? 'Reminders are active' : 'Reminders are off'}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-faint">{permissionLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            loading={testing}
            disabled={permission !== 'granted'}
            icon={<Send className="h-3.5 w-3.5" />}
          >
            Test
          </Button>
          <Toggle checked={prefs.enabled} onChange={(next) => void handleEnable(next)} disabled={!supported || requesting} />
        </div>
      </div>

      <div className={cn('space-y-5', compact && 'space-y-4')}>
        <Toggle
          checked={prefs.daily}
          onChange={(daily) => updateSettings({ notifications: { daily } })}
          label="Daily briefing"
          description="A morning summary of what matters today, delivered at your chosen time."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="daily-time">
              Briefing time
            </label>
            <input
              id="daily-time"
              type="time"
              value={prefs.dailyTime}
              onChange={(event) => updateSettings({ notifications: { dailyTime: event.target.value } })}
              className="field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="frequency">
              Frequency
            </label>
            <select
              id="frequency"
              value={prefs.frequency}
              onChange={(event) =>
                updateSettings({
                  notifications: { frequency: event.target.value as typeof prefs.frequency },
                })
              }
              className="field"
            >
              <option value="gentle">Gentle — once a day</option>
              <option value="balanced">Balanced — morning and evening</option>
              <option value="persistent">Persistent — every three hours</option>
            </select>
          </div>
        </div>

        <div className="h-px bg-stroke" />

        <Toggle
          checked={prefs.milestoneReminders}
          onChange={(milestoneReminders) => updateSettings({ notifications: { milestoneReminders } })}
          label="Milestone reminders"
          description="A nudge before each task with a reminder enabled."
        />
        <div>
          <label className="field-label" htmlFor="lead-time">
            Default lead time
          </label>
          <select
            id="lead-time"
            value={prefs.milestoneLead}
            onChange={(event) =>
              updateSettings({ notifications: { milestoneLead: Number(event.target.value) } })
            }
            className="field"
          >
            <option value={0}>At the time</option>
            <option value={15}>15 minutes before</option>
            <option value={60}>1 hour before</option>
            <option value={1440}>1 day before</option>
          </select>
          <p className="mt-2 text-[10px] leading-relaxed text-faint">
            This applies to new milestones. Each task carries its own lead time in the planner.
          </p>
        </div>

        <div className="h-px bg-stroke" />

        <Toggle
          checked={prefs.overdue}
          onChange={(overdue) => updateSettings({ notifications: { overdue } })}
          label="Overdue alerts"
          description="One reminder a day for unfinished tasks that have slipped."
        />
        <Toggle
          checked={prefs.deadlineAlerts}
          onChange={(deadlineAlerts) => updateSettings({ notifications: { deadlineAlerts } })}
          label="Deadline alerts"
          description="A final alert one day before and on the day itself."
        />

        <div className="h-px bg-stroke" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="quiet-start">
              Quiet hours from
            </label>
            <input
              id="quiet-start"
              type="time"
              value={prefs.quietStart}
              onChange={(event) => updateSettings({ notifications: { quietStart: event.target.value } })}
              className="field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="quiet-end">
              Until
            </label>
            <input
              id="quiet-end"
              type="time"
              value={prefs.quietEnd}
              onChange={(event) => updateSettings({ notifications: { quietEnd: event.target.value } })}
              className="field"
            />
          </div>
        </div>

        <Toggle
          checked={prefs.paused}
          onChange={(paused) => updateSettings({ notifications: { paused } })}
          label="Pause everything"
          description="Keep your settings, silence every reminder until you return."
        />

        <div className="flex items-start gap-2.5 rounded-xl border border-stroke bg-surface/40 p-3.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-[10.5px] leading-relaxed text-faint">
            Reminders are computed on this device and fire while ChronoCanvas is open. No notification data
            leaves your browser. For background push delivery at any time, a hosted notification service
            would be required.
          </p>
        </div>
      </div>
    </div>
  );
};
