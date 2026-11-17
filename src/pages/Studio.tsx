import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Check,
  Download,
  Image as ImageIcon,
  Laptop,
  Layers,
  LayoutPanelTop,
  Loader2,
  Monitor,
  Palette as PaletteIcon,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tablet,
  Type,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import type {
  DeviceId,
  Design,
  ExtractedPalette,
  PaletteId,
  TypographyId,
  WallpaperSpec,
} from '@/types';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { DEVICES, PALETTES, THEMES, TYPOGRAPHIES, deviceOf, themeOf } from '@/lib/catalog';
import {
  buildDefaultSpec,
  compressBackgroundImage,
  renderWallpaper,
  renderWallpaperDataUrl,
  wallpaperFilename,
  type GoalBundle,
} from '@/lib/wallpaper';
import { createThumbnail, analyzeReferenceImage } from '@/lib/image';
import {
  analyzeReferenceWithAI,
  generateWallpaperImage,
  interpretWallpaperPrompt,
  isAIConfigured,
} from '@/lib/ai';
import { localPromptDirection, randomSpecPatch } from '@/lib/prompt';
import { downloadDataUrl, readFileAsDataUrl, cn, slugify } from '@/lib/utils';
import { uid } from '@/lib/dates';

const deviceIcons = {
  iphone: Smartphone,
  android: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
  laptop: Laptop,
};

const FALLBACK_SPEC: WallpaperSpec = {
  theme: 'autumn',
  palette: 'theme',
  typography: 'editorial',
  layout: 'stacked',
  milestonePlacement: 'bottom',
  decorations: true,
  clockSafe: true,
  appearance: 'dark',
  transparency: 42,
  showBranding: true,
  showProgress: true,
  goalIds: [],
  backgroundImage: null,
  extracted: null,
};

type Tab = 'atmosphere' | 'composition' | 'palette' | 'imagery' | 'goals';

const tabs: { id: Tab; label: string; icon: typeof PaletteIcon }[] = [
  { id: 'atmosphere', label: 'Atmosphere', icon: Sparkles },
  { id: 'composition', label: 'Composition', icon: LayoutPanelTop },
  { id: 'palette', label: 'Palette', icon: PaletteIcon },
  { id: 'imagery', label: 'Imagery & AI', icon: ImageIcon },
  { id: 'goals', label: 'Goals', icon: Layers },
];

const Option = ({
  active,
  onClick,
  children,
  className,
  disabled,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  title?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      'rounded-xl border p-2.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40',
      active
        ? 'border-accent/60 bg-accent/[0.07]'
        : 'border-stroke bg-surface/40 hover:border-stroke-strong',
      className,
    )}
  >
    {children}
  </button>
);

export const Studio = () => {
  const { user, goals, milestones, designs, settings, saveDesign, pushToast } = useApp();
  const [params] = useSearchParams();

  const orderedGoals = useMemo(
    () =>
      goals
        .slice()
        .sort((a, b) => {
          if (a.archived !== b.archived) return a.archived ? 1 : -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }),
    [goals],
  );

  const initialDesign = useMemo(
    () => designs.find((design) => design.id === params.get('design')) ?? null,
    // The saved design is only read on first mount; later param changes should not overwrite edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const initialGoal = useMemo(() => {
    const requestedId = initialDesign?.goalId ?? params.get('goal');
    return (
      goals.find((goal) => goal.id === requestedId) ??
      orderedGoals.find((goal) => !goal.archived) ??
      orderedGoals[0] ??
      null
    );
  }, [initialDesign, goals, orderedGoals, params]);

  const [primaryGoalId, setPrimaryGoalId] = useState<string>(initialGoal?.id ?? '');
  const [secondaryIds, setSecondaryIds] = useState<string[]>(() =>
    initialDesign
      ? initialDesign.spec.goalIds.filter((id) => id !== initialDesign.goalId).slice(0, 2)
      : [],
  );
  const [device, setDevice] = useState<DeviceId>(
    initialDesign?.device ?? initialGoal?.device ?? settings.defaultDevice,
  );
  const [spec, setSpec] = useState<WallpaperSpec>(() => {
    if (initialDesign) return { ...initialDesign.spec };
    if (initialGoal) return buildDefaultSpec(initialGoal, initialGoal.device);
    return FALLBACK_SPEC;
  });
  const [tab, setTab] = useState<Tab>('atmosphere');
  const [rendering, setRendering] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [artPrompt, setArtPrompt] = useState(
    'Frosted amber glass, pressed maple leaves, soft dusk light, quiet luxury',
  );
  const [artLoading, setArtLoading] = useState(false);
  const [directionPrompt, setDirectionPrompt] = useState('');
  const [directionLoading, setDirectionLoading] = useState(false);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceRationale, setReferenceRationale] = useState<string | null>(null);
  const [artSource, setArtSource] = useState<Design['source']>('studio');
  const [aiError, setAiError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const renderSeq = useRef(0);

  const primaryBundle = useMemo<GoalBundle | null>(() => {
    const goal = goals.find((item) => item.id === primaryGoalId);
    if (!goal) return null;
    return { goal, milestones: milestones.filter((milestone) => milestone.goalId === goal.id) };
  }, [goals, milestones, primaryGoalId]);

  const bundles = useMemo<GoalBundle[]>(() => {
    const ids = [primaryGoalId, ...secondaryIds].filter(Boolean);
    return ids
      .map((id) => {
        const goal = goals.find((item) => item.id === id);
        return goal
          ? { goal, milestones: milestones.filter((milestone) => milestone.goalId === id) }
          : null;
      })
      .filter((bundle): bundle is GoalBundle => bundle !== null);
  }, [goals, milestones, primaryGoalId, secondaryIds]);

  const renderSpec = useMemo<WallpaperSpec>(
    () => ({ ...spec, goalIds: [primaryGoalId, ...secondaryIds].filter(Boolean) }),
    [spec, primaryGoalId, secondaryIds],
  );

  const deviceMeta = deviceOf(device);
  const aiReady = isAIConfigured(settings);
  const theme = themeOf(spec.theme);

  useEffect(() => {
    if (!primaryBundle) return;
    let cancelled = false;
    const sequence = renderSeq.current + 1;
    renderSeq.current = sequence;
    setRendering(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const canvas = canvasRef.current;
          if (!canvas) return;
          await renderWallpaper(canvas, { spec: renderSpec, device, goals: bundles }, 'preview');
          if (!cancelled && renderSeq.current === sequence) {
            setRenderError(null);
            setRendering(false);
          }
        } catch (error) {
          if (!cancelled && renderSeq.current === sequence) {
            setRenderError(error instanceof Error ? error.message : 'The canvas could not be rendered.');
            setRendering(false);
          }
        }
      })();
    }, 70);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [renderSpec, device, bundles, primaryBundle]);

  if (!user) return null;

  if (!primaryBundle) {
    return (
      <div>
        <PageHeader
          eyebrow="Wallpaper studio"
          title="No canvas without a moment."
          description="Create a countdown first. The studio turns its milestones into a high-resolution lock screen."
          backTo="/app"
        />
        <EmptyState
          icon={ImageIcon}
          title="Your studio is waiting for a goal"
          description="A countdown gives the canvas its number, its next milestone and its mood. Start with a date that matters."
          action={
            <Link to="/app/new" className="btn btn-gold">
              Create a goal
            </Link>
          }
        />
      </div>
    );
  }

  const updateSpec = (patch: Partial<WallpaperSpec>) =>
    setSpec((prev) => ({ ...prev, ...patch }));

  const handleDevice = (next: DeviceId) => {
    setDevice(next);
    const meta = deviceOf(next);
    setSpec((prev) => ({
      ...prev,
      clockSafe: meta.family === 'mobile',
      layout: meta.family === 'desktop' && prev.layout === 'stacked' ? 'inline' : prev.layout,
    }));
  };

  const handleTheme = (themeId: WallpaperSpec['theme']) => {
    const meta = themeOf(themeId);
    updateSpec({ theme: themeId, appearance: meta.appearance });
    setArtSource('studio');
  };

  const selectPrimary = (id: string) => {
    setPrimaryGoalId(id);
    setSecondaryIds((prev) => prev.filter((secondary) => secondary !== id));
  };

  const toggleSecondary = (id: string) => {
    if (secondaryIds.includes(id)) {
      setSecondaryIds((prev) => prev.filter((secondary) => secondary !== id));
    } else if (secondaryIds.length < 2) {
      setSecondaryIds((prev) => [...prev, id]);
    } else {
      pushToast('Three countdowns is the limit', 'Remove one to add another. Three keeps the composition legible.', 'info');
    }
  };

  const saveToGallery = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const raw = canvas.toDataURL('image/jpeg', 0.9);
      const thumbnail = await createThumbnail(raw, 300);
      const backgroundImage = renderSpec.backgroundImage
        ? await compressBackgroundImage(renderSpec.backgroundImage, 1200, 0.78)
        : null;
      const design: Design = {
        id: uid('design'),
        name: `${primaryBundle.goal.name} · ${theme.label}`,
        goalId: primaryBundle.goal.id,
        device,
        width: deviceMeta.width,
        height: deviceMeta.height,
        spec: { ...renderSpec, backgroundImage, goalIds: renderSpec.goalIds },
        thumbnail,
        createdAt: new Date().toISOString(),
        source: artSource,
      };
      saveDesign(design);
      pushToast('Saved to your gallery', `${design.name} · ${deviceMeta.label}`, 'success');
    } catch (error) {
      pushToast(
        'Could not save this canvas',
        error instanceof Error ? error.message : 'Local storage may be full.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    setExporting(true);
    try {
      const dataUrl = await renderWallpaperDataUrl(
        { spec: renderSpec, device, goals: bundles },
        'full',
      );
      await downloadDataUrl(dataUrl, wallpaperFilename(primaryBundle.goal, device));
      pushToast(
        'Wallpaper downloaded',
        `${deviceMeta.width} × ${deviceMeta.height} PNG, ready for ${deviceMeta.label}.`,
        'success',
      );
    } catch (error) {
      pushToast(
        'The full-resolution render failed',
        error instanceof Error ? error.message : 'Try a smaller device format.',
        'error',
      );
    } finally {
      setExporting(false);
    }
  };

  const generateArt = async () => {
    if (!aiReady) {
      pushToast(
        'Gemini is not connected',
        'Add an API key in Settings to generate a background. You can still use a uploaded image or a procedural theme.',
        'info',
      );
      return;
    }
    setArtLoading(true);
    setAiError(null);
    try {
      const palette: ExtractedPalette = {
        accent: theme.swatches[2],
        secondary: theme.swatches[3],
        background: theme.swatches[0],
        muted: theme.swatches[1],
      };
      const dataUrl = await generateWallpaperImage(
        settings,
        artPrompt.trim() || 'a quiet, luxurious abstract background',
        device,
        palette,
      );
      updateSpec({ backgroundImage: dataUrl, palette: 'theme' });
      setArtSource('ai');
      pushToast('Artwork generated', 'The countdown typography stays vector-crisp on top.', 'success');
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Image generation failed.');
    } finally {
      setArtLoading(false);
    }
  };

  const applyDirection = async () => {
    if (!directionPrompt.trim()) return;
    setDirectionLoading(true);
    setAiError(null);
    try {
      if (aiReady) {
        const result = await interpretWallpaperPrompt(
          directionPrompt.trim(),
          renderSpec,
          primaryBundle.goal,
          settings,
        );
        updateSpec(result.patch);
        setArtSource('ai');
        pushToast('Direction applied', result.rationale, 'success');
      } else {
        const result = localPromptDirection(directionPrompt.trim(), renderSpec);
        updateSpec(result.patch);
        setArtSource('studio');
        pushToast('Direction applied', result.rationale, 'info');
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'The art director could not respond.');
    } finally {
      setDirectionLoading(false);
    }
  };

  const handleBackgroundUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      pushToast('That file is not an image', 'Choose a JPG, PNG or WebP.', 'error');
      return;
    }
    try {
      const raw = await readFileAsDataUrl(file);
      const compressed = await compressBackgroundImage(raw, 2000, 0.86);
      updateSpec({ backgroundImage: compressed });
      setArtSource('studio');
      pushToast('Background applied', 'The renderer tints it to keep the type legible.', 'success');
    } catch {
      pushToast('Could not read that image', 'Try a different file.', 'error');
    }
  };

  const handleReference = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      pushToast('That file is not an image', 'Choose a JPG, PNG or WebP.', 'error');
      return;
    }
    setReferenceLoading(true);
    setAiError(null);
    try {
      const raw = await readFileAsDataUrl(file);
      const compressed = await compressBackgroundImage(raw, 1400, 0.9);
      setReferencePreview(compressed);
      if (aiReady) {
        try {
          const result = await analyzeReferenceWithAI(compressed, settings);
          updateSpec({
            theme: result.theme ?? 'custom',
            palette: 'extracted',
            extracted: result.palette,
            appearance: result.appearance,
          });
          setReferenceRationale(result.rationale);
          setArtSource('reference');
          pushToast('Reference absorbed', result.rationale, 'success');
        } catch (aiFailure) {
          const local = await analyzeReferenceImage(raw);
          updateSpec({
            theme: 'custom',
            palette: 'extracted',
            extracted: local.palette,
            appearance: local.appearance,
          });
          setReferenceRationale('Matched the reference palette locally. Connect Gemini for a deeper reading of the mood.');
          setAiError(aiFailure instanceof Error ? aiFailure.message : null);
          setArtSource('reference');
          pushToast('Palette extracted locally', 'The canvas now borrows the reference colors.', 'info');
        }
      } else {
        const local = await analyzeReferenceImage(raw);
        updateSpec({
          theme: 'custom',
          palette: 'extracted',
          extracted: local.palette,
          appearance: local.appearance,
        });
        setReferenceRationale('Palette extracted locally. Connect Gemini to interpret the full visual language.');
        setArtSource('reference');
        pushToast('Palette extracted', 'The countdown now borrows the reference colors.', 'success');
      }
    } catch {
      pushToast('That reference could not be read', 'Try a smaller or different image.', 'error');
    } finally {
      setReferenceLoading(false);
    }
  };

  const themeGrid = (
    <div className="grid grid-cols-2 gap-2">
      {THEMES.map((item) => {
        const active = spec.theme === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleTheme(item.id)}
            className={cn(
              'group overflow-hidden rounded-xl border text-left transition-all',
              active ? 'border-accent/70' : 'border-stroke hover:border-stroke-strong',
            )}
          >
            <div className="flex h-10">
              {item.swatches.map((swatch) => (
                <span key={swatch} className="flex-1" style={{ background: swatch }} />
              ))}
            </div>
            <div className="flex items-center justify-between gap-1 bg-surface/50 px-2 py-2">
              <span className={cn('clamp-1 text-[9px]', active ? 'text-ink' : 'text-muted')}>
                {item.label}
              </span>
              {active && <Check className="h-3 w-3 shrink-0 text-accent" />}
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="AI wallpaper studio"
        title="Design the countdown you will see every day."
        description="A real canvas, rendered at native device resolution. Choose the atmosphere, shape the composition, then download the PNG."
        actions={
          <>
            <Link to="/app/gallery" className="btn btn-outline">
              <Layers className="h-4 w-4" />
              Gallery
            </Link>
            <Button onClick={() => void saveToGallery()} loading={saving} icon={<Save className="h-4 w-4" />}>
              Save
            </Button>
            <Button variant="gold" onClick={() => void download()} loading={exporting} icon={<Download className="h-4 w-4" />}>
              Download PNG
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="xl:sticky xl:top-24">
          <div className="glass overflow-hidden rounded-4xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-2 w-2 items-center justify-center">
                  <span className={cn('h-1.5 w-1.5 rounded-full', rendering ? 'animate-pulse bg-accent' : 'bg-[color:var(--success)]')} />
                </span>
                <div>
                  <p className="text-[10px] text-ink">Live canvas</p>
                  <p className="text-[8px] uppercase tracking-[0.14em] text-faint">
                    {theme.label} · {deviceMeta.label}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden rounded-full border border-stroke px-2 py-1 text-[8px] uppercase tracking-[0.1em] text-faint sm:inline">
                  {deviceMeta.width} × {deviceMeta.height}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const patch = randomSpecPatch();
                    setSpec((prev) => ({ ...prev, ...patch }));
                    setArtSource('studio');
                    pushToast('A new atmosphere', 'A little randomness can reveal a direction you would have missed.', 'info');
                  }}
                  className="icon-btn h-8 w-8"
                  aria-label="Surprise me with a new composition"
                  title="Surprise me"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="relative flex min-h-[430px] items-center justify-center bg-[radial-gradient(ellipse_at_center,var(--surface),transparent_70%)] p-5 sm:p-8">
              <div
                className={cn(
                  'relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.85)]',
                  deviceMeta.family === 'desktop' ? 'w-full max-w-[700px]' : 'w-full max-w-[290px] sm:max-w-[315px]',
                )}
                style={{ aspectRatio: deviceMeta.ratio, background: '#070d09' }}
              >
                <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Wallpaper preview" />
                {rendering && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                    <span className="flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] text-white/80">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Rendering
                    </span>
                  </div>
                )}
                {renderError && !rendering && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 p-6 text-center">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#ff9b9b]">Render failed</p>
                    <p className="max-w-[240px] text-[11px] leading-relaxed text-white/70">{renderError}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-stroke px-3 py-3 sm:px-4">
              <div className="scroll-thin flex gap-1.5 overflow-x-auto pb-0.5">
                {DEVICES.map((item) => {
                  const Icon = deviceIcons[item.id];
                  const active = device === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleDevice(item.id)}
                      className={cn(
                        'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9px] uppercase tracking-[0.08em] transition-colors',
                        active
                          ? 'border-accent/50 bg-accent/10 text-accent'
                          : 'border-stroke text-faint hover:border-stroke-strong hover:text-muted',
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[8.5px] uppercase tracking-[0.1em] text-faint">
                  <span>{spec.clockSafe ? 'Clock-safe area on' : 'Full-bleed layout'}</span>
                  <span>·</span>
                  <span>{spec.milestonePlacement === 'none' ? 'Countdown only' : `Milestone ${spec.milestonePlacement}`}</span>
                  <span>·</span>
                  <span>{spec.decorations ? 'Decorated' : 'Undecorated'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSpec(buildDefaultSpec(primaryBundle.goal, device));
                    setArtSource('studio');
                    pushToast('Composition reset', 'Back to the default palette for this goal.', 'info');
                  }}
                  className="text-[8.5px] uppercase tracking-[0.1em] text-faint transition-colors hover:text-ink"
                >
                  Reset style
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stroke bg-surface/40 px-4 py-3">
            <p className="text-[9.5px] leading-relaxed text-faint">
              {artSource === 'ai'
                ? 'AI artwork is composited with vector typography. The full render stays crisp.'
                : artSource === 'reference'
                  ? 'Palette and tone borrowed from your reference. The composition remains yours.'
                  : 'Rendered locally in your browser. Nothing is uploaded by this studio.'}
            </p>
            <Link
              to={`/app/goal/${primaryBundle.goal.id}`}
              className="text-[9px] uppercase tracking-[0.1em] text-accent hover:opacity-80"
            >
              Open countdown
            </Link>
          </div>
        </div>

        <div className="glass rounded-4xl p-4 sm:p-5">
          <div className="scroll-thin flex items-center gap-1 overflow-x-auto border-b border-stroke pb-3">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] uppercase tracking-[0.07em] transition-colors',
                  tab === item.id ? 'bg-surface2 text-ink' : 'text-faint hover:text-muted',
                )}
              >
                <item.icon className="h-3 w-3" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="pt-4">
            {tab === 'atmosphere' && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="eyebrow">Atmosphere</p>
                    <span className="text-[8px] text-faint">10 themes</span>
                  </div>
                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-faint">
                    Each atmosphere changes the background, ornament, palette and suggested type.
                  </p>
                  <div className="mt-3">{themeGrid}</div>
                </div>

                <div className="rounded-xl border border-stroke bg-surface/40 p-3">
                  <p className="text-[10px] text-ink">{theme.label}</p>
                  <p className="mt-1 text-[9.5px] leading-relaxed text-faint">{theme.description}</p>
                </div>

                <div>
                  <p className="field-label">Appearance</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['dark', 'light'] as const).map((appearance) => (
                      <Option
                        key={appearance}
                        active={spec.appearance === appearance}
                        onClick={() => updateSpec({ appearance })}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="h-5 w-5 rounded-full border border-white/15"
                            style={{
                              background:
                                appearance === 'dark'
                                  ? 'linear-gradient(135deg,#0b1710,#27392B)'
                                  : 'linear-gradient(135deg,#f7f2e7,#e7ddcc)',
                            }}
                          />
                          <span className="text-[10px] capitalize text-ink">{appearance}</span>
                        </span>
                      </Option>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'composition' && (
              <div className="space-y-5">
                <div>
                  <p className="field-label">Countdown layout</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'stacked' as const, label: 'Stacked' },
                      { id: 'inline' as const, label: 'In a row' },
                      { id: 'ring' as const, label: 'Progress ring' },
                    ].map((layout) => (
                      <Option
                        key={layout.id}
                        active={spec.layout === layout.id}
                        onClick={() => updateSpec({ layout: layout.id })}
                      >
                        <span className="flex h-8 items-center justify-center gap-0.5">
                          {[0, 1, 2].map((index) => (
                            <span
                              key={index}
                              className="rounded-sm bg-accent/60"
                              style={{
                                width: spec.layout === 'inline' ? 5 : 3,
                                height: 6 + index * 5,
                              }}
                            />
                          ))}
                        </span>
                        <span className="mt-1.5 block text-[9px] text-muted">{layout.label}</span>
                      </Option>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="field-label">Typography</p>
                  <div className="grid grid-cols-2 gap-2">
                    {TYPOGRAPHIES.map((font) => (
                      <Option
                        key={font.id}
                        active={spec.typography === font.id}
                        onClick={() => updateSpec({ typography: font.id as TypographyId })}
                      >
                        <span
                          className="block text-[15px] leading-none text-ink"
                          style={{
                            fontFamily:
                              font.id === 'editorial'
                                ? 'Fraunces, serif'
                                : font.id === 'tech'
                                  ? '"Space Grotesk", sans-serif'
                                  : 'Inter, sans-serif',
                            fontWeight: font.id === 'modern' ? 600 : font.id === 'minimal' ? 300 : 400,
                          }}
                        >
                          {font.sample}
                        </span>
                        <span className="mt-1.5 block text-[8px] uppercase tracking-[0.08em] text-faint">
                          {font.label}
                        </span>
                      </Option>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="field-label">Milestone placement</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['top', 'bottom', 'none'] as const).map((placement) => (
                      <Option
                        key={placement}
                        active={spec.milestonePlacement === placement}
                        onClick={() => updateSpec({ milestonePlacement: placement })}
                      >
                        <span className="block text-center text-[10px] capitalize text-ink">{placement}</span>
                      </Option>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-stroke bg-surface/40 p-3.5">
                  <label className="field-label mb-0" htmlFor="transparency">
                    Glass transparency
                    <span className="text-[9px] normal-case tracking-normal text-faint">{spec.transparency}%</span>
                  </label>
                  <input
                    id="transparency"
                    type="range"
                    min={0}
                    max={100}
                    value={spec.transparency}
                    onChange={(event) => updateSpec({ transparency: Number(event.target.value) })}
                    className="w-full"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.1em] text-faint">
                    <span>Opaque</span>
                    <span>Featherlight</span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="text-[11px] text-ink">Clock-safe area</span>
                    <input
                      type="checkbox"
                      checked={spec.clockSafe}
                      onChange={(event) => updateSpec({ clockSafe: event.target.checked })}
                      className="h-4 w-4 accent-[color:var(--accent)]"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="text-[11px] text-ink">Decorative illustrations</span>
                    <input
                      type="checkbox"
                      checked={spec.decorations}
                      onChange={(event) => updateSpec({ decorations: event.target.checked })}
                      className="h-4 w-4 accent-[color:var(--accent)]"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="text-[11px] text-ink">Preparation progress</span>
                    <input
                      type="checkbox"
                      checked={spec.showProgress}
                      onChange={(event) => updateSpec({ showProgress: event.target.checked })}
                      className="h-4 w-4 accent-[color:var(--accent)]"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="text-[11px] text-ink">ChronoCanvas wordmark</span>
                    <input
                      type="checkbox"
                      checked={spec.showBranding}
                      onChange={(event) => updateSpec({ showBranding: event.target.checked })}
                      className="h-4 w-4 accent-[color:var(--accent)]"
                    />
                  </label>
                </div>
              </div>
            )}

            {tab === 'palette' && (
              <div className="space-y-5">
                <div>
                  <p className="field-label">Color palette</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PALETTES.map((palette) => {
                      const disabled = palette.id === 'extracted' && !spec.extracted;
                      const active = spec.palette === palette.id;
                      return (
                        <Option
                          key={palette.id}
                          active={active}
                          disabled={disabled}
                          onClick={() => updateSpec({ palette: palette.id as PaletteId })}
                          title={disabled ? 'Upload a reference image first' : palette.label}
                        >
                          <span className="flex items-center gap-1">
                            {palette.swatches.map((swatch) => (
                              <span
                                key={swatch}
                                className="h-4 w-4 rounded-full border border-white/15"
                                style={{ background: swatch }}
                              />
                            ))}
                          </span>
                          <span className="mt-1.5 block text-[9px] text-muted">{palette.label}</span>
                        </Option>
                      );
                    })}
                  </div>
                  {spec.palette === 'extracted' && spec.extracted && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-stroke bg-surface/40 px-3 py-2">
                      <PaletteIcon className="h-3.5 w-3.5 text-accent" />
                      <span className="text-[9px] text-faint">Using the palette extracted from your reference.</span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-stroke bg-surface/40 p-3.5">
                  <p className="text-[10px] text-ink">A note on contrast</p>
                  <p className="mt-1.5 text-[9.5px] leading-relaxed text-faint">
                    The renderer protects contrast by lifting dark accents on dark canvases and deepening
                    light accents on ivory. Palette choice changes character, not readability.
                  </p>
                </div>

                <div>
                  <p className="field-label">Art direction prompt</p>
                  <textarea
                    className="field"
                    rows={3}
                    value={directionPrompt}
                    onChange={(event) => setDirectionPrompt(event.target.value)}
                    placeholder="Something like: warm amber glass with quiet botanical linework and a light serif…"
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[8.5px] text-faint">
                      {aiReady ? 'Gemini translates mood into composition.' : 'On-device keyword direction.'}
                    </p>
                    <Button
                      size="sm"
                      variant="violet"
                      onClick={() => void applyDirection()}
                      loading={directionLoading}
                      disabled={!directionPrompt.trim()}
                      icon={<Wand2 className="h-3.5 w-3.5" />}
                    >
                      Apply
                    </Button>
                  </div>
                </div>

                {aiError && (
                  <div className="rounded-xl border border-[rgba(255,139,139,0.3)] bg-[rgba(255,139,139,0.07)] p-3">
                    <p className="text-[10px] leading-relaxed text-[color:var(--danger)]">{aiError}</p>
                  </div>
                )}
              </div>
            )}

            {tab === 'imagery' && (
              <div className="space-y-5">
                <div>
                  <p className="field-label">Background image</p>
                  <input
                    ref={backgroundInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      void handleBackgroundUpload(event.target.files?.[0]);
                      event.target.value = '';
                    }}
                  />
                  {spec.backgroundImage ? (
                    <div className="relative overflow-hidden rounded-xl border border-stroke">
                      <img
                        src={spec.backgroundImage}
                        alt="Wallpaper background"
                        className="h-28 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => updateSpec({ backgroundImage: null })}
                        className="absolute right-2 top-2 rounded-full border border-white/20 bg-black/50 p-1.5 text-white/80 backdrop-blur-sm transition-colors hover:text-white"
                        aria-label="Remove background image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => backgroundInputRef.current?.click()}
                      className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stroke px-4 py-7 text-center transition-colors hover:border-accent/40 hover:bg-surface/40"
                    >
                      <Upload className="h-4 w-4 text-faint" />
                      <span className="text-[10px] text-muted">Upload a background image</span>
                      <span className="text-[8.5px] text-faint">JPG, PNG or WebP · tinted for legibility</span>
                    </button>
                  )}
                  {spec.backgroundImage && (
                    <button
                      type="button"
                      onClick={() => backgroundInputRef.current?.click()}
                      className="mt-2 text-[9px] uppercase tracking-[0.1em] text-accent hover:opacity-80"
                    >
                      Replace image
                    </button>
                  )}
                </div>

                <div className="h-px bg-stroke" />

                <div>
                  <div className="flex items-center justify-between">
                    <p className="field-label mb-0">AI artwork pass</p>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[7.5px] uppercase tracking-[0.1em]',
                        aiReady ? 'border-accent/30 text-accent' : 'border-stroke text-faint',
                      )}
                    >
                      {aiReady ? 'Gemini image' : 'Key required'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[9.5px] leading-relaxed text-faint">
                    Generates an abstract background, then composes your live countdown and milestone on top.
                  </p>
                  <textarea
                    className="field mt-2"
                    rows={3}
                    value={artPrompt}
                    onChange={(event) => setArtPrompt(event.target.value)}
                    placeholder="Describe the visual world behind the countdown…"
                  />
                  <Button
                    size="sm"
                    variant="violet"
                    className="mt-2 w-full"
                    onClick={() => void generateArt()}
                    loading={artLoading}
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                  >
                    Generate a background
                  </Button>
                  <p className="mt-1.5 text-[8px] leading-relaxed text-faint">
                    Uses your Gemini image model and credits. Generated backgrounds are compressed when saved
                    locally; downloads composite at full canvas resolution.
                  </p>
                </div>

                <div className="h-px bg-stroke" />

                <div>
                  <div className="flex items-center justify-between">
                    <p className="field-label mb-0">Reference-to-wallpaper</p>
                    <span className="text-[8px] text-faint">Palette extraction</span>
                  </div>
                  <input
                    ref={referenceInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      void handleReference(event.target.files?.[0]);
                      event.target.value = '';
                    }}
                  />
                  {referencePreview ? (
                    <div className="mt-2 flex gap-3 rounded-xl border border-stroke bg-surface/40 p-2.5">
                      <img
                        src={referencePreview}
                        alt="Reference"
                        className="h-20 w-20 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-ink">Reference absorbed</p>
                        <p className="mt-1 text-[8.5px] leading-relaxed text-faint">
                          {referenceRationale ?? 'The palette and surface now respond to this image.'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateSpec({ backgroundImage: referencePreview, palette: 'extracted' })
                            }
                            className="text-[8px] uppercase tracking-[0.1em] text-accent hover:opacity-80"
                          >
                            Use as background
                          </button>
                          <button
                            type="button"
                            onClick={() => referenceInputRef.current?.click()}
                            className="text-[8px] uppercase tracking-[0.1em] text-faint hover:text-ink"
                          >
                            Replace
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => referenceInputRef.current?.click()}
                      className="mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stroke px-4 py-6 text-center transition-colors hover:border-accent/40 hover:bg-surface/40"
                    >
                      {referenceLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-accent" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-faint" />
                      )}
                      <span className="text-[10px] text-muted">
                        {referenceLoading ? 'Reading the reference…' : 'Upload a reference image'}
                      </span>
                      <span className="text-[8.5px] text-faint">
                        Borrow the palette, tone and typography mood
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {tab === 'goals' && (
              <div className="space-y-5">
                <div>
                  <p className="field-label">Primary countdown</p>
                  <select
                    value={primaryGoalId}
                    onChange={(event) => selectPrimary(event.target.value)}
                    className="field"
                  >
                    {orderedGoals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name}
                        {goal.archived ? ' (archived)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[9px] leading-relaxed text-faint">
                    The primary goal supplies the hero number, progress and next milestone.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <p className="field-label mb-0">Also counting</p>
                    <span className="text-[8px] text-faint">{secondaryIds.length}/2</span>
                  </div>
                  <p className="mt-1.5 text-[9px] leading-relaxed text-faint">
                    Place up to two more deadlines in the same composition.
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {orderedGoals
                      .filter((goal) => goal.id !== primaryGoalId)
                      .map((goal) => {
                        const active = secondaryIds.includes(goal.id);
                        const disabled = !active && secondaryIds.length >= 2;
                        return (
                          <button
                            key={goal.id}
                            type="button"
                            onClick={() => toggleSecondary(goal.id)}
                            disabled={disabled}
                            className={cn(
                              'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
                              active
                                ? 'border-accent/40 bg-accent/[0.06]'
                                : 'border-stroke bg-surface/30 hover:border-stroke-strong',
                              disabled && 'opacity-40',
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-4 w-4 items-center justify-center rounded border',
                                active ? 'border-accent bg-accent text-[color:var(--accent-ink)]' : 'border-stroke-strong',
                              )}
                            >
                              {active && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="clamp-1 block text-[10px] text-ink">{goal.name}</span>
                              <span className="block text-[8px] text-faint">
                                {Math.max(0, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000))} days
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    {orderedGoals.length <= 1 && (
                      <p className="rounded-lg border border-dashed border-stroke p-3 text-[9.5px] text-faint">
                        Add another countdown to use multi-goal composition.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-stroke bg-surface/40 p-3.5">
                  <p className="text-[10px] text-ink">Context-aware by default</p>
                  <p className="mt-1.5 text-[9.5px] leading-relaxed text-faint">
                    The canvas reads the live plan each time it renders: days remaining, next milestone and
                    preparation percentage always reflect the current data.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-stroke pt-4">
            <Button variant="outline" onClick={() => void saveToGallery()} loading={saving} icon={<Save className="h-3.5 w-3.5" />}>
              Save to gallery
            </Button>
            <Button variant="gold" onClick={() => void download()} loading={exporting} icon={<Download className="h-3.5 w-3.5" />}>
              Download
            </Button>
          </div>
          <p className="mt-2 text-center text-[8px] text-faint">
            {deviceMeta.label} · {deviceMeta.width} × {deviceMeta.height} PNG · {slugify(primaryBundle.goal.name)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: SlidersHorizontal,
            title: 'Every control is real',
            body: 'Composition, palette, glass transparency and imagery all render into the actual PNG.',
          },
          {
            icon: Type,
            title: 'Typography that holds',
            body: 'Editorial, modern, technical or minimal. Titles auto-fit; labels stay out of the clock area.',
          },
          {
            icon: Layers,
            title: 'Three deadlines, one canvas',
            body: 'A primary countdown leads. Two quieter companions sit inside the milestone panel.',
          },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-stroke bg-surface/30 p-4">
            <item.icon className="h-4 w-4 text-accent" strokeWidth={1.6} />
            <p className="mt-2.5 text-[11px] text-ink">{item.title}</p>
            <p className="mt-1 text-[9.5px] leading-relaxed text-faint">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
