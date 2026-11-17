import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import type { ToastTone } from '@/types';

const toneMeta: Record<ToastTone, { icon: typeof Info; color: string; bg: string }> = {
  default: { icon: Info, color: 'var(--accent)', bg: 'var(--accent-soft)' },
  success: { icon: CheckCircle2, color: 'var(--success)', bg: 'rgba(125,211,168,0.12)' },
  error: { icon: AlertCircle, color: 'var(--danger)', bg: 'rgba(255,139,139,0.12)' },
  info: { icon: Info, color: 'var(--lavender)', bg: 'rgba(169,192,164,0.12)' },
};

export const ToastViewport = () => {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-24 z-[85] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[360px]">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const meta = toneMeta[toast.tone];
          const Icon = meta.icon;
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="glass pointer-events-auto w-full rounded-2xl p-4 shadow-lift"
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: meta.bg, color: meta.color }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-1 text-xs leading-relaxed text-muted">{toast.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="-mr-1 -mt-1 rounded-full p-1.5 text-faint transition-colors hover:bg-surface2 hover:text-ink"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
