import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  Images,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import type { Design } from '@/types';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { categoryOf, deviceOf, themeOf } from '@/lib/catalog';
import { renderWallpaper, renderWallpaperDataUrl, type GoalBundle } from '@/lib/wallpaper';
import { createThumbnail } from '@/lib/image';
import { downloadDataUrl, slugify } from '@/lib/utils';
import { fmtDateShort as formatShortDate } from '@/lib/dates';

const sourceLabel: Record<Design['source'], string> = {
  studio: 'Studio',
  ai: 'AI artwork',
  reference: 'Reference',
};

export const Gallery = () => {
  const { user, goals, milestones, designs, saveDesign, deleteDesign, clearDesigns, pushToast } = useApp();
  const [filter, setFilter] = useState<'all' | string>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Design | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  const bundlesFor = (design: Design): GoalBundle[] =>
    design.spec.goalIds
      .map((id) => {
        const goal = goals.find((item) => item.id === id);
        return goal
          ? { goal, milestones: milestones.filter((milestone) => milestone.goalId === id) }
          : null;
      })
      .filter((bundle): bundle is GoalBundle => bundle !== null);

  const visible = useMemo(
    () =>
      designs
        .filter((design) => filter === 'all' || design.goalId === filter)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [designs, filter],
  );

  const goalFilters = useMemo(
    () =>
      Array.from(new Set(designs.map((design) => design.goalId)))
        .map((id) => goals.find((goal) => goal.id === id))
        .filter((goal): goal is NonNullable<typeof goal> => Boolean(goal)),
    [designs, goals],
  );

  if (!user) return null;

  const download = async (design: Design) => {
    const bundles = bundlesFor(design);
    if (bundles.length === 0) {
      pushToast('This design has no goal', 'The countdown it referenced is no longer available.', 'error');
      return;
    }
    setBusy(`${design.id}:download`);
    try {
      const dataUrl = await renderWallpaperDataUrl(
        { spec: design.spec, device: design.device, goals: bundles },
        'full',
      );
      await downloadDataUrl(dataUrl, `${slugify(design.name)}-${design.device}.png`);
      pushToast('Downloaded', `${design.name} · ${deviceOf(design.device).label}`, 'success');
    } catch (error) {
      pushToast(
        'The render failed',
        error instanceof Error ? error.message : 'Try refreshing the design first.',
        'error',
      );
    } finally {
      setBusy(null);
    }
  };

  const refresh = async (design: Design) => {
    const bundles = bundlesFor(design);
    if (bundles.length === 0) return;
    setBusy(`${design.id}:refresh`);
    try {
      const canvas = document.createElement('canvas');
      await renderWallpaper(canvas, { spec: design.spec, device: design.device, goals: bundles }, 'preview');
      const thumbnail = await createThumbnail(canvas.toDataURL('image/jpeg', 0.92), 300);
      saveDesign({ ...design, thumbnail });
      pushToast('Canvas refreshed', 'The wallpaper now reflects the latest countdown and milestones.', 'success');
    } catch (error) {
      pushToast(
        'Could not refresh',
        error instanceof Error ? error.message : 'Try opening the design in the studio.',
        'error',
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Wallpaper gallery"
        title="Every countdown you have designed."
        description="Saved locally alongside the plan. Refresh a canvas when the milestones change, download a full-resolution copy, or open it again in the studio."
        actions={
          <>
            {designs.length > 0 && (
              <Button variant="ghost" onClick={() => setClearOpen(true)}>
                Clear gallery
              </Button>
            )}
            <Link to="/app/studio" className="btn btn-gold">
              <Wand2 className="h-4 w-4" />
              Open the studio
            </Link>
          </>
        }
      />

      {designs.length === 0 ? (
        <EmptyState
          icon={Images}
          title="No saved canvases yet"
          description="Design a countdown in the studio, then save it here. Each save captures the atmosphere and composition, not a flat screenshot."
          action={
            <Link to="/app/studio" className="btn btn-gold">
              <Sparkles className="h-4 w-4" />
              Design your first wallpaper
            </Link>
          }
        />
      ) : (
        <>
          <div className="scroll-thin mb-5 flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`chip shrink-0 ${filter === 'all' ? 'chip-active' : ''}`}
            >
              All designs
              <span className="text-[8px] text-faint">{designs.length}</span>
            </button>
            {goalFilters.map((goal) => {
              const category = categoryOf(goal.category);
              const count = designs.filter((design) => design.goalId === goal.id).length;
              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => setFilter(goal.id)}
                  className={`chip shrink-0 ${filter === goal.id ? 'chip-active' : ''}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: category.accent }} />
                  <span className="max-w-[150px] truncate">{goal.name}</span>
                  <span className="text-[8px] text-faint">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
            {visible.map((design) => {
              const goal = goals.find((item) => item.id === design.goalId);
              const theme = themeOf(design.spec.theme);
              const device = deviceOf(design.device);
              const isDownloading = busy === `${design.id}:download`;
              const isRefreshing = busy === `${design.id}:refresh`;
              return (
                <article
                  key={design.id}
                  className="glass group mb-4 break-inside-avoid overflow-hidden rounded-3xl"
                >
                  <div
                    className="relative w-full overflow-hidden bg-[#070d09]"
                    style={{ aspectRatio: `${design.width} / ${design.height}` }}
                  >
                    <img
                      src={design.thumbnail}
                      alt={design.name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]"
                      loading="lazy"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15 opacity-80" />
                    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-white/15 bg-black/40 px-2 py-1 text-[7.5px] uppercase tracking-[0.12em] text-white/75 backdrop-blur-md">
                        {theme.label}
                      </span>
                      <span className="rounded-full border border-white/15 bg-black/40 px-2 py-1 text-[7.5px] uppercase tracking-[0.12em] text-white/60 backdrop-blur-md">
                        {sourceLabel[design.source]}
                      </span>
                    </div>
                    <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <p className="clamp-1 text-[11px] text-white/90">{design.name}</p>
                        <p className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-white/50">
                          {device.label} · {design.width} × {design.height}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <p className="text-[10px] text-ink">{goal?.name ?? 'Archived goal'}</p>
                      <p className="mt-0.5 text-[8.5px] text-faint">
                        Saved {formatShortDate(design.createdAt)} ·{' '}
                        {goal ? categoryOf(goal.category).short : 'Countdown'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void refresh(design)}
                        className="icon-btn h-8 w-8"
                        aria-label={`Refresh ${design.name} from the plan`}
                        title="Refresh from the current plan"
                        disabled={isRefreshing}
                      >
                        {isRefreshing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void download(design)}
                        className="icon-btn h-8 w-8"
                        aria-label={`Download ${design.name}`}
                        title="Download full-resolution PNG"
                        disabled={isDownloading}
                      >
                        {isDownloading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <Link
                        to={`/app/studio?design=${design.id}`}
                        className="icon-btn h-8 w-8"
                        aria-label={`Open ${design.name} in the studio`}
                        title="Open in studio"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(design)}
                        className="icon-btn h-8 w-8 hover:text-[color:var(--danger)]"
                        aria-label={`Delete ${design.name}`}
                        title="Delete design"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {visible.length === 0 && (
            <div className="rounded-3xl border border-dashed border-stroke p-14 text-center">
              <p className="text-sm text-muted">No designs for this countdown yet.</p>
              <Link to="/app/studio" className="btn btn-outline btn-sm mt-4">
                Design one now
              </Link>
            </div>
          )}

          <div className="mt-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-stroke bg-surface/40 p-4 sm:flex-row sm:items-center">
            <p className="text-[9.5px] leading-relaxed text-faint">
              Gallery thumbnails are compressed to keep your local workspace light. Downloads re-render the
              saved composition at the device's native resolution, with the latest countdown and milestones.
            </p>
            <span className="text-[8px] uppercase tracking-[0.14em] text-faint">
              {designs.length} of 24 saved
            </span>
          </div>
        </>
      )}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this wallpaper?"
        description="The composition and its saved thumbnail will be removed from this device. The goal and plan stay intact."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleteTarget) return;
                deleteDesign(deleteTarget.id);
                pushToast('Wallpaper deleted', deleteTarget.name, 'info');
                setDeleteTarget(null);
              }}
            >
              Delete wallpaper
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <div className="flex items-center gap-3 rounded-xl border border-stroke bg-surface/50 p-3">
            <img
              src={deleteTarget.thumbnail}
              alt={deleteTarget.name}
              className="h-20 w-14 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="clamp-1 text-[11px] text-ink">{deleteTarget.name}</p>
              <p className="mt-1 text-[9px] text-faint">
                {themeOf(deleteTarget.spec.theme).label} · {deviceOf(deleteTarget.device).label} ·{' '}
                {formatShortDate(deleteTarget.createdAt)}
              </p>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Clear the wallpaper gallery?"
        description="This removes every saved design on this device. Your goals, milestones and settings stay exactly as they are."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearDesigns();
                setClearOpen(false);
                pushToast('Gallery cleared', 'You can design a fresh canvas at any time.', 'info');
              }}
            >
              Clear {designs.length} designs
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-4 gap-2">
          {designs.slice(0, 8).map((design) => (
            <img
              key={design.id}
              src={design.thumbnail}
              alt=""
              className="aspect-[9/14] w-full rounded-lg object-cover opacity-70"
            />
          ))}
        </div>
        <p className="mt-3 text-[9px] text-faint">
          {formatShortDate(new Date())} · this action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};
