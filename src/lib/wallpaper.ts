import { format } from 'date-fns';
import type {
  DeviceId,
  Goal,
  Milestone,
  ThemeId,
  TypographyId,
  WallpaperSpec,
} from '@/types';
import { categoryLabel } from './planner';
import { deviceOf, themeOf } from './catalog';
import { getCountdown, pad2, parse } from './dates';
import { clamp, pct, slugify } from './utils';

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export interface GoalBundle {
  goal: Goal;
  milestones: Milestone[];
}

export interface WallpaperRenderArgs {
  spec: WallpaperSpec;
  device: DeviceId;
  goals: GoalBundle[];
  now?: Date;
}

type Quality = 'preview' | 'full';

/* ------------------------------------------------------------------ */
/* Color helpers                                                       */
/* ------------------------------------------------------------------ */

const parseHex = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = parseInt(full || '000000', 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};

export const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
};

const mixHex = (a: string, b: string, weight: number): string => {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const w = clamp(weight, 0, 1);
  const toHex = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${toHex(r1 + (r2 - r1) * w)}${toHex(g1 + (g2 - g1) * w)}${toHex(b1 + (b2 - b1) * w)}`;
};

const luminanceOf = (hex: string): number => {
  const [r, g, b] = parseHex(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

const ensureVisible = (hex: string, dark: boolean): string => {
  const lum = luminanceOf(hex);
  if (dark && lum < 0.38) return mixHex(hex, '#ffffff', 0.32);
  if (!dark && lum > 0.68) return mixHex(hex, '#000000', 0.3);
  return hex;
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number): (() => number) => {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/* ------------------------------------------------------------------ */
/* Skins                                                               */
/* ------------------------------------------------------------------ */

interface Skin {
  dark: boolean;
  bgFrom: string;
  bgTo: string;
  bgDeep: string;
  text: string;
  sub: string;
  accent: string;
  secondary: string;
  panelRgb: string;
  border: string;
}

interface SkinPair {
  dark: Skin;
  light: Skin;
}

const skin = (
  dark: boolean,
  bgFrom: string,
  bgTo: string,
  bgDeep: string,
  text: string,
  sub: string,
  accent: string,
  secondary: string,
  border: string,
): Skin => ({
  dark,
  bgFrom,
  bgTo,
  bgDeep,
  text,
  sub,
  accent,
  secondary,
  panelRgb: dark ? '255, 255, 255' : '255, 252, 245',
  border,
});

const SKINS: Record<ThemeId, SkinPair> = {
  autumn: {
    dark: skin(
      true,
      '#1C1109',
      '#2D1A10',
      '#0B0705',
      '#F8EDDB',
      'rgba(248, 237, 219, 0.64)',
      '#E6C083',
      '#C98B5E',
      'rgba(232, 205, 154, 0.24)',
    ),
    light: skin(
      false,
      '#F6EAD6',
      '#EAD2AC',
      '#FBF4E8',
      '#2B1B0F',
      'rgba(43, 27, 15, 0.62)',
      '#8F5F24',
      '#A9532E',
      'rgba(143, 95, 36, 0.22)',
    ),
  },
  glass: {
    dark: skin(
      true,
      '#0C0B1A',
      '#1D1735',
      '#07060F',
      '#F5F0FC',
      'rgba(245, 240, 252, 0.62)',
      '#E8CD9A',
      '#B6A8E8',
      'rgba(255, 255, 255, 0.18)',
    ),
    light: skin(
      false,
      '#F2ECF8',
      '#E1D9F0',
      '#FBF8FE',
      '#221C33',
      'rgba(34, 28, 51, 0.6)',
      '#8A6A2F',
      '#6552A8',
      'rgba(90, 70, 130, 0.2)',
    ),
  },
  neon: {
    dark: skin(
      true,
      '#04060F',
      '#141046',
      '#05030D',
      '#F3F6FF',
      'rgba(243, 246, 255, 0.62)',
      '#B08CFF',
      '#5FE7FF',
      'rgba(176, 140, 255, 0.25)',
    ),
    light: skin(
      false,
      '#E9EDFA',
      '#D6D7F1',
      '#F6F8FE',
      '#151234',
      'rgba(21, 18, 52, 0.62)',
      '#6B3FD4',
      '#0E7C96',
      'rgba(80, 60, 160, 0.2)',
    ),
  },
  minimal: {
    light: skin(
      false,
      '#F8F2E7',
      '#EFE5D4',
      '#FCF8F1',
      '#241E18',
      'rgba(36, 30, 24, 0.58)',
      '#8C6B36',
      '#5F574C',
      'rgba(140, 107, 54, 0.24)',
    ),
    dark: skin(
      true,
      '#12100D',
      '#1D1914',
      '#080706',
      '#F4EEE3',
      'rgba(244, 238, 227, 0.6)',
      '#D8B77B',
      '#B6A8E8',
      'rgba(216, 183, 123, 0.24)',
    ),
  },
  botanical: {
    dark: skin(
      true,
      '#07130D',
      '#162C1F',
      '#040B07',
      '#EFF3E7',
      'rgba(239, 243, 231, 0.62)',
      '#C9B98E',
      '#7FA98B',
      'rgba(127, 169, 139, 0.26)',
    ),
    light: skin(
      false,
      '#ECF1E5',
      '#DBE6D1',
      '#F7F9F1',
      '#14241A',
      'rgba(20, 36, 26, 0.62)',
      '#4C6B4E',
      '#6E7F4F',
      'rgba(76, 107, 78, 0.22)',
    ),
  },
  pastel: {
    light: skin(
      false,
      '#F8EEF7',
      '#EDDCF0',
      '#FDF9FD',
      '#35233B',
      'rgba(53, 35, 59, 0.6)',
      '#9A6FAF',
      '#C88EA8',
      'rgba(154, 111, 175, 0.2)',
    ),
    dark: skin(
      true,
      '#1A1220',
      '#2A1B33',
      '#0D0811',
      '#F9F0FA',
      'rgba(249, 240, 250, 0.64)',
      '#D6B9E2',
      '#F2B6C8',
      'rgba(214, 185, 226, 0.24)',
    ),
  },
  cyberpunk: {
    dark: skin(
      true,
      '#05040D',
      '#1D0936',
      '#030208',
      '#F7F0FF',
      'rgba(247, 240, 255, 0.62)',
      '#FF4D8D',
      '#4DE6FF',
      'rgba(255, 77, 141, 0.3)',
    ),
    light: skin(
      false,
      '#F0EAF7',
      '#E3D3F1',
      '#FBF7FE',
      '#1C0F2B',
      'rgba(28, 15, 43, 0.62)',
      '#B01A5C',
      '#0B7285',
      'rgba(176, 26, 92, 0.22)',
    ),
  },
  cinematic: {
    dark: skin(
      true,
      '#080706',
      '#1A130A',
      '#040303',
      '#F4E9D6',
      'rgba(244, 233, 214, 0.6)',
      '#D9A96B',
      '#9C7347',
      'rgba(217, 169, 107, 0.24)',
    ),
    light: skin(
      false,
      '#F1E6D3',
      '#E1CFB2',
      '#FAF4E8',
      '#221A10',
      'rgba(34, 26, 16, 0.6)',
      '#7A5525',
      '#8B6B45',
      'rgba(122, 85, 37, 0.22)',
    ),
  },
  festive: {
    dark: skin(
      true,
      '#180C1A',
      '#2C1028',
      '#0C050E',
      '#FFF4E3',
      'rgba(255, 244, 227, 0.64)',
      '#E8CD9A',
      '#F08A8A',
      'rgba(240, 138, 138, 0.24)',
    ),
    light: skin(
      false,
      '#FBEFE3',
      '#F2D9C5',
      '#FFFAF3',
      '#2A1224',
      'rgba(42, 18, 36, 0.62)',
      '#8A5A1E',
      '#A63D4E',
      'rgba(138, 90, 30, 0.22)',
    ),
  },
  custom: {
    dark: skin(
      true,
      '#0B0F1E',
      '#181436',
      '#06070F',
      '#F6F1E7',
      'rgba(246, 241, 231, 0.62)',
      '#E8CD9A',
      '#B6A8E8',
      'rgba(182, 168, 232, 0.24)',
    ),
    light: skin(
      false,
      '#F4F0E8',
      '#E7DFF2',
      '#FBF8F2',
      '#1A1622',
      'rgba(26, 22, 34, 0.62)',
      '#6B4BE0',
      '#8A6A2F',
      'rgba(107, 75, 224, 0.2)',
    ),
  },
};

const PALETTE_ACCENTS: Record<
  Exclude<WallpaperSpec['palette'], 'theme' | 'extracted'>,
  { dark: [string, string]; light: [string, string] }
> = {
  champagne: { dark: ['#E8CD9A', '#C9A96A'], light: ['#8A6A2F', '#9C7C43'] },
  lavender: { dark: ['#CBBEF5', '#8B6BFF'], light: ['#6754A8', '#4D3B91'] },
  monochrome: { dark: ['#F2F2F5', '#A6A6B2'], light: ['#2B2B30', '#6A6A72'] },
  rose: { dark: ['#F4B6CB', '#E8CD9A'], light: ['#B4557B', '#8A5A5A'] },
  emerald: { dark: ['#9FE0B5', '#D8CBB8'], light: ['#2F7A55', '#6E7F4F'] },
  ocean: { dark: ['#8FD3D0', '#B6A8E8'], light: ['#2F6F8F', '#4D6F94'] },
};

const resolveSkin = (spec: WallpaperSpec): Skin => {
  const pair = SKINS[spec.theme];
  const base = spec.appearance === 'light' ? pair.light : pair.dark;
  const resolved: Skin = { ...base };

  if (spec.palette === 'extracted' && spec.extracted) {
    resolved.accent = ensureVisible(spec.extracted.accent, resolved.dark);
    resolved.secondary = ensureVisible(spec.extracted.secondary, resolved.dark);
    if (spec.theme === 'custom') {
      resolved.bgFrom = resolved.dark
        ? mixHex(spec.extracted.background, '#080A12', 0.55)
        : mixHex(spec.extracted.background, '#FFFFFF', 0.62);
      resolved.bgTo = resolved.dark
        ? mixHex(spec.extracted.background, '#000000', 0.18)
        : mixHex(spec.extracted.background, '#FFFFFF', 0.82);
      resolved.bgDeep = resolved.dark
        ? mixHex(spec.extracted.background, '#000000', 0.55)
        : mixHex(spec.extracted.background, '#FFFFFF', 0.94);
      resolved.text = resolved.dark ? '#F8F4EC' : '#181420';
      resolved.sub = resolved.dark ? 'rgba(248,244,236,0.66)' : 'rgba(24,20,32,0.62)';
      resolved.border = withAlpha(resolved.accent, 0.3);
    }
  } else if (spec.palette !== 'theme' && spec.palette !== 'extracted') {
    const accents = PALETTE_ACCENTS[spec.palette];
    const pairForAppearance = resolved.dark ? accents.dark : accents.light;
    resolved.accent = pairForAppearance[0];
    resolved.secondary = pairForAppearance[1];
    resolved.border = withAlpha(resolved.accent, 0.28);
  }

  return resolved;
};

/* ------------------------------------------------------------------ */
/* Typography                                                          */
/* ------------------------------------------------------------------ */

const FONTS = {
  serif: '"Fraunces", Georgia, Cambria, serif',
  sans: 'Inter, "Segoe UI", sans-serif',
  tech: '"Space Grotesk", Inter, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
};

interface TypeSystem {
  display: string;
  sans: string;
  label: string;
  titleWeight: number;
  numberWeight: number;
  titleTracking: number;
  labelTracking: number;
}

const typeFor = (typography: TypographyId): TypeSystem => {
  switch (typography) {
    case 'modern':
      return {
        display: FONTS.sans,
        sans: FONTS.sans,
        label: FONTS.sans,
        titleWeight: 600,
        numberWeight: 600,
        titleTracking: -0.035,
        labelTracking: 0.16,
      };
    case 'tech':
      return {
        display: FONTS.tech,
        sans: FONTS.sans,
        label: FONTS.mono,
        titleWeight: 500,
        numberWeight: 500,
        titleTracking: -0.02,
        labelTracking: 0.2,
      };
    case 'minimal':
      return {
        display: FONTS.sans,
        sans: FONTS.sans,
        label: FONTS.sans,
        titleWeight: 300,
        numberWeight: 300,
        titleTracking: -0.01,
        labelTracking: 0.26,
      };
    case 'editorial':
    default:
      return {
        display: FONTS.serif,
        sans: FONTS.sans,
        label: FONTS.sans,
        titleWeight: 300,
        numberWeight: 300,
        titleTracking: -0.025,
        labelTracking: 0.22,
      };
  }
};

const fontString = (size: number, family: string, weight: number): string =>
  `${weight} ${Math.max(1, Math.round(size))}px ${family}`;

const measureTracking = (ctx: CanvasRenderingContext2D, text: string, tracking: number): number => {
  let width = 0;
  for (const char of text) width += ctx.measureText(char).width + tracking;
  return Math.max(0, width - tracking);
};

const drawTracking = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  baseline: number,
  tracking: number,
  color: string,
  align: 'left' | 'center' | 'right' = 'left',
): number => {
  const width = measureTracking(ctx, text, tracking);
  let cursor = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  for (const char of text) {
    ctx.fillText(char, cursor, baseline);
    cursor += ctx.measureText(char).width + tracking;
  }
  return width;
};

const wrapAll = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      return;
    }
    if (current) lines.push(current);
    if (ctx.measureText(word).width > maxWidth) {
      let fragment = '';
      for (const char of word) {
        if (ctx.measureText(fragment + char).width > maxWidth && fragment) {
          lines.push(fragment);
          fragment = char;
        } else {
          fragment += char;
        }
      }
      current = fragment;
    } else {
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
};

const ellipsize = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result.trimEnd()}…`;
};

interface FittedTitle {
  size: number;
  lines: string[];
}

const fitTitle = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  maxSize: number,
  minSize: number,
  family: string,
  weight: number,
): FittedTitle => {
  const step = Math.max(1, maxSize * 0.025);
  for (let size = maxSize; size >= minSize; size -= step) {
    ctx.font = fontString(size, family, weight);
    const lines = wrapAll(ctx, text, maxWidth);
    if (lines.length <= maxLines && lines.every((line) => ctx.measureText(line).width <= maxWidth)) {
      return { size, lines };
    }
  }
  ctx.font = fontString(minSize, family, weight);
  const all = wrapAll(ctx, text, maxWidth);
  const lines = all.slice(0, maxLines);
  if (all.length > maxLines) {
    const last = lines[lines.length - 1] ?? '';
    lines[lines.length - 1] = ellipsize(ctx, `${last} …`, maxWidth);
  }
  return { size: minSize, lines };
};

const drawText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  baseline: number,
  family: string,
  size: number,
  weight: number,
  color: string,
  align: CanvasTextAlign = 'left',
): void => {
  ctx.font = fontString(size, family, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, baseline);
};

/* ------------------------------------------------------------------ */
/* Drawing primitives                                                  */
/* ------------------------------------------------------------------ */

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void => {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const drawGlow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
): void => {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, withAlpha(color, alpha));
  gradient.addColorStop(0.55, withAlpha(color, alpha * 0.4));
  gradient.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
};

const drawPanel = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  skinValue: Skin,
  spec: WallpaperSpec,
  radius: number,
): void => {
  const transparency = clamp(spec.transparency, 0, 100) / 100;
  const fillAlpha = skinValue.dark
    ? 0.16 - transparency * 0.11
    : 0.66 - transparency * 0.4;
  const borderAlpha = skinValue.dark ? 0.24 - transparency * 0.12 : 0.5 - transparency * 0.24;

  const gradient = ctx.createLinearGradient(x, y, x + w * 0.7, y + h);
  gradient.addColorStop(0, `rgba(${skinValue.panelRgb}, ${fillAlpha + 0.04})`);
  gradient.addColorStop(1, `rgba(${skinValue.panelRgb}, ${Math.max(0.02, fillAlpha - 0.05)})`);
  ctx.save();
  roundedRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = `rgba(${skinValue.panelRgb}, ${Math.max(0.08, borderAlpha)})`;
  ctx.lineWidth = Math.max(1, w * 0.0012);
  ctx.stroke();
  ctx.clip();
  const sheen = ctx.createLinearGradient(x, y, x, y + h * 0.55);
  sheen.addColorStop(0, `rgba(255,255,255,${skinValue.dark ? 0.09 : 0.35})`);
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
};

/* ------------------------------------------------------------------ */
/* Theme decoration                                                    */
/* ------------------------------------------------------------------ */

const drawLeaf = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  angle: number,
  color: string,
  alpha: number,
): void => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(length * 0.38, -length * 0.3, length * 0.86, -length * 0.22, length, 0);
  ctx.bezierCurveTo(length * 0.86, length * 0.22, length * 0.38, length * 0.3, 0, 0);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(length * 0.04, 0);
  ctx.lineTo(length * 0.92, 0);
  ctx.strokeStyle = withAlpha(color, 0.55);
  ctx.lineWidth = Math.max(1, length * 0.008);
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
};

const drawAutumn = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  u: number,
  skinValue: Skin,
  rng: () => number,
): void => {
  drawGlow(ctx, W * 0.82, H * 0.12, u * 0.55, skinValue.accent, 0.28);
  drawGlow(ctx, W * 0.06, H * 0.72, u * 0.5, '#B45A2A', 0.16);

  for (let i = 0; i < 9; i += 1) {
    const rightSide = i % 2 === 0;
    const x = rightSide ? W * (0.86 + rng() * 0.16) : W * (-0.04 + rng() * 0.13);
    const y = H * (0.06 + rng() * 0.9);
    drawLeaf(
      ctx,
      x,
      y,
      u * (0.06 + rng() * 0.1),
      (rightSide ? 1 : -1) * (0.5 + rng() * 1.6),
      i % 3 === 0 ? skinValue.accent : skinValue.secondary,
      0.16 + rng() * 0.16,
    );
  }

  ctx.strokeStyle = withAlpha(skinValue.accent, 0.28);
  ctx.lineWidth = Math.max(1, u * 0.0014);
  const inset = u * 0.05;
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  ctx.strokeStyle = withAlpha(skinValue.accent, 0.16);
  ctx.strokeRect(inset * 1.45, inset * 1.45, W - inset * 2.9, H - inset * 2.9);
};

const drawGlass = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  u: number,
  skinValue: Skin,
  rng: () => number,
): void => {
  drawGlow(ctx, W * 0.18, H * 0.2, u * 0.6, skinValue.secondary, 0.32);
  drawGlow(ctx, W * 0.85, H * 0.78, u * 0.55, skinValue.accent, 0.2);

  for (let i = 0; i < 3; i += 1) {
    const w = u * (0.35 + rng() * 0.4);
    const h = u * (0.14 + rng() * 0.3);
    const x = rng() * (W - w);
    const y = rng() * (H - h);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((rng() - 0.5) * 0.7);
    roundedRect(ctx, -w / 2, -h / 2, w, h, u * 0.06);
    ctx.fillStyle = skinValue.dark ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.3)';
    ctx.fill();
    ctx.strokeStyle = withAlpha(skinValue.accent, 0.24);
    ctx.lineWidth = Math.max(1, u * 0.0012);
    ctx.stroke();
    ctx.restore();
  }

  ctx.strokeStyle = withAlpha(skinValue.secondary, 0.2);
  ctx.lineWidth = Math.max(1, u * 0.001);
  ctx.beginPath();
  ctx.arc(W * 0.86, H * 0.18, u * 0.18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W * 0.86, H * 0.18, u * 0.25, 0, Math.PI * 2);
  ctx.stroke();
};

const drawNeon = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  u: number,
  skinValue: Skin,
  rng: () => number,
): void => {
  const horizon = H * 0.68;
  drawGlow(ctx, W * 0.5, horizon, u * 0.9, skinValue.accent, 0.2);
  drawGlow(ctx, W * 0.12, H * 0.18, u * 0.5, skinValue.secondary, 0.22);

  const horizonGradient = ctx.createLinearGradient(0, horizon - u * 0.01, 0, horizon + u * 0.01);
  horizonGradient.addColorStop(0, withAlpha(skinValue.secondary, 0));
  horizonGradient.addColorStop(0.5, withAlpha(skinValue.secondary, 0.5));
  horizonGradient.addColorStop(1, withAlpha(skinValue.secondary, 0));
  ctx.fillStyle = horizonGradient;
  ctx.fillRect(0, horizon - u * 0.012, W, u * 0.024);

  ctx.strokeStyle = withAlpha(skinValue.accent, 0.13);
  ctx.lineWidth = Math.max(1, u * 0.0009);
  for (let i = 0; i < 14; i += 1) {
    const y = horizon + Math.pow(i / 14, 1.9) * (H - horizon) * 1.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let i = -8; i <= 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * W * 0.055, horizon);
    ctx.lineTo(W / 2 + i * W * 0.34, H * 1.02);
    ctx.stroke();
  }

  ctx.strokeStyle = withAlpha(skinValue.secondary, 0.22);
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(W * 0.8, H * 0.3, u * (0.13 + i * 0.06), Math.PI * 1.05, Math.PI * 1.7);
    ctx.stroke();
  }

  for (let i = 0; i < 40; i += 1) {
    ctx.fillStyle = withAlpha(i % 2 === 0 ? skinValue.accent : skinValue.secondary, 0.1 + rng() * 0.4);
    const r = Math.max(1, u * (0.0015 + rng() * 0.003));
    ctx.beginPath();
    ctx.arc(rng() * W, rng() * H * 0.62, r, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawMinimal = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  u: number,
  skinValue: Skin,
): void => {
  const inset = u * 0.055;
  ctx.strokeStyle = withAlpha(skinValue.text, 0.16);
  ctx.lineWidth = Math.max(1, u * 0.0012);
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);

  ctx.fillStyle = withAlpha(skinValue.accent, 0.85);
  ctx.beginPath();
  ctx.arc(inset * 1.8, inset * 1.8, u * 0.005, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(skinValue.accent, 0.5);
  ctx.lineWidth = Math.max(1, u * 0.0012);
  ctx.beginPath();
  ctx.moveTo(W - inset * 2.4, H * 0.28);
  ctx.lineTo(W - inset * 2.4, H * 0.72);
  ctx.stroke();

  ctx.save();
  ctx.translate(W - inset * 1.55, H * 0.28);
  ctx.rotate(-Math.PI / 2);
  drawTracking(ctx, 'CHRONOCANVAS · EDITION 01', 0, 0, u * 0.003, withAlpha(skinValue.sub, 0.8), 'left');
  ctx.restore();
};

const drawBotanical = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  u: number,
  skinValue: Skin,
  rng: () => number,
): void => {
  drawGlow(ctx, W * 0.1, H * 0.22, u * 0.55, skinValue.secondary, 0.18);
  drawGlow(ctx, W * 0.95, H * 0.7, u * 0.5, skinValue.accent, 0.12);

  for (let i = 0; i < 3; i += 1) {
    const leftSide = i !== 1;
    const startX = leftSide ? -W * 0.02 : W * 1.02;
    const startY = H * (0.68 + rng() * 0.3);
    const endX = leftSide ? W * (0.22 + rng() * 0.18) : W * (0.6 + rng() * 0.2);
    const endY = H * (0.05 + rng() * 0.25);
    const ctrlX = leftSide ? W * 0.12 : W * 0.8;
    const ctrlY = H * 0.6;
    ctx.strokeStyle = withAlpha(skinValue.secondary, 0.32);
    ctx.lineWidth = Math.max(1, u * 0.0018);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
    ctx.stroke();

    for (let j = 1; j < 9; j += 1) {
      const t = j / 9;
      const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * ctrlX + t * t * endX;
      const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * ctrlY + t * t * endY;
      const direction = leftSide ? 1 : -1;
      drawLeaf(
        ctx,
        x,
        y,
        u * (0.035 + rng() * 0.03),
        direction * (0.7 + rng() * 0.9),
        skinValue.secondary,
        0.32,
      );
    }
  }
};

const drawStar = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void => {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(size * 0.12, -size * 0.12, size, 0);
  ctx.quadraticCurveTo(size * 0.12, size * 0.12, 0, size);
  ctx.quadraticCurveTo(-size * 0.12, size * 0.12, -size, 0);
  ctx.quadraticCurveTo(-size * 0.12, -size * 0.12, 0, -size);
  ctx.fill();
  ctx.restore();
};

const drawPastel = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  u: number,
  skinValue: Skin,
  rng: () => number,
): void => {
  drawGlow(ctx, W * 0.16, H * 0.16, u * 0.62, '#D9B8E8', 0.5);
  drawGlow(ctx, W * 0.88, H * 0.38, u * 0.55, '#F2B6C8', 0.42);
  drawGlow(ctx, W * 0.4, H * 0.94, u * 0.62, '#CBBEF5', 0.35);

  for (let i = 0; i < 16; i += 1) {
    drawStar(
      ctx,
      W * (0.05 + rng() * 0.9),
      H * (0.05 + rng() * 0.55),
      u * (0.003 + rng() * 0.006),
      withAlpha(i % 2 === 0 ? '#FFFFFF' : skinValue.accent, 0.4),
    );
  }

  ctx.strokeStyle = withAlpha('#FFFFFF', 0.35);
  ctx.lineWidth = Math.max(1, u * 0.0012);
  ctx.beginPath();
  ctx.arc(W * 0.88, H * 0.16, u * 0.14, 0, Math.PI * 2);
  ctx.stroke();
};

const drawCyberpunk = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  u: number,
  skinValue: Skin,
  rng: () => number,
): void => {
  drawGlow(ctx, W * 0.2, H * 0.2, u * 0.55, skinValue.accent, 0.24);
  drawGlow(ctx, W * 0.9, H * 0.55, u * 0.5, skinValue.secondary, 0.16);

  const horizon = H * 0.74;
  ctx.strokeStyle = withAlpha(skinValue.secondary, 0.2);
  ctx.lineWidth = Math.max(1, u * 0.0009);
  for (let i = 0; i < 12; i += 1) {
    const y = horizon + Math.pow(i / 12, 2) * (H - horizon) * 1.15;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let i = -10; i <= 10; i += 1) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * W * 0.012, horizon);
    ctx.lineTo(W / 2 + i * W * 0.28, H * 1.03);
    ctx.stroke();
  }

  for (let y = 0; y < H; y += Math.max(3, u * 0.004)) {
    ctx.fillStyle = 'rgba(255,255,255,0.018)';
    ctx.fillRect(0, y, W, Math.max(1, u * 0.0007));
  }

  for (let i = 0; i < 6; i += 1) {
    const w = u * (0.04 + rng() * 0.18);
    const x = rng() * W;
    const y = rng() * H;
    ctx.fillStyle = withAlpha(i % 2 === 0 ? skinValue.accent : skinValue.secondary, 0.25 + rng() * 0.3);
    ctx.fillRect(x, y, w, Math.max(1, u * 0.0025));
  }
};

const drawCinematic = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  u: number,
  skinValue: Skin,
  rng: () => number,
): void => {
  const light = ctx.createRadialGradient(W * 0.24, H * 0.1, 0, W * 0.24, H * 0.1, H * 0.8);
  light.addColorStop(0, withAlpha(skinValue.accent, 0.18));
  light.addColorStop(0.5, withAlpha(skinValue.accent, 0.05));
  light.addColorStop(1, withAlpha(skinValue.accent, 0));
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W, H * 0.045);
  ctx.fillRect(0, H * 0.955, W, H * 0.045);

  for (let i = 0; i < 55; i += 1) {
    const r = Math.max(1, u * (0.0008 + rng() * 0.0022));
    ctx.fillStyle = withAlpha('#F0D9B5', 0.08 + rng() * 0.25);
    ctx.beginPath();
    ctx.arc(rng() * W, rng() * H, r, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawFestive = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  u: number,
  skinValue: Skin,
  rng: () => number,
): void => {
  drawGlow(ctx, W * 0.5, H * 0.08, u * 0.55, skinValue.accent, 0.18);
  drawGlow(ctx, W * 0.12, H * 0.9, u * 0.5, skinValue.secondary, 0.18);

  const colors = [skinValue.accent, skinValue.secondary, '#FFF4E3'];
  for (let i = 0; i < 46; i += 1) {
    const x = rng() * W;
    const y = (rng() < 0.5 ? rng() * 0.22 : 1 - rng() * 0.2) * H;
    const w = u * (0.008 + rng() * 0.012);
    const h = w * (0.3 + rng() * 0.5);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng() * Math.PI);
    ctx.fillStyle = withAlpha(colors[i % colors.length], 0.3 + rng() * 0.5);
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  ctx.strokeStyle = withAlpha(skinValue.accent, 0.35);
  ctx.lineWidth = Math.max(1, u * 0.0012);
  ctx.beginPath();
  ctx.arc(W * 0.82, H * 0.2, u * 0.18, 0, Math.PI * 2);
  ctx.stroke();
};

const drawCustom = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  u: number,
  skinValue: Skin,
  rng: () => number,
): void => {
  drawGlow(ctx, W * 0.8, H * 0.18, u * 0.6, skinValue.secondary, 0.24);
  drawGlow(ctx, W * 0.1, H * 0.85, u * 0.6, skinValue.accent, 0.16);
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-W * 0.1, H * (0.25 + i * 0.22));
    ctx.bezierCurveTo(
      W * (0.25 + rng() * 0.2),
      H * (0.05 + i * 0.28),
      W * (0.6 + rng() * 0.2),
      H * (0.75 - i * 0.15),
      W * 1.1,
      H * (0.12 + i * 0.3),
    );
    ctx.strokeStyle = withAlpha(i % 2 === 0 ? skinValue.accent : skinValue.secondary, 0.12);
    ctx.lineWidth = u * (0.025 + rng() * 0.04);
    ctx.stroke();
  }
};

const drawDecorations = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  u: number,
  skinValue: Skin,
  spec: WallpaperSpec,
  rng: () => number,
): void => {
  switch (spec.theme) {
    case 'autumn':
      drawAutumn(ctx, W, H, u, skinValue, rng);
      break;
    case 'glass':
      drawGlass(ctx, W, H, u, skinValue, rng);
      break;
    case 'neon':
      drawNeon(ctx, W, H, u, skinValue, rng);
      break;
    case 'minimal':
      drawMinimal(ctx, W, H, u, skinValue);
      break;
    case 'botanical':
      drawBotanical(ctx, W, H, u, skinValue, rng);
      break;
    case 'pastel':
      drawPastel(ctx, W, H, u, skinValue, rng);
      break;
    case 'cyberpunk':
      drawCyberpunk(ctx, W, H, u, skinValue, rng);
      break;
    case 'cinematic':
      drawCinematic(ctx, W, H, u, skinValue, rng);
      break;
    case 'festive':
      drawFestive(ctx, W, H, u, skinValue, rng);
      break;
    case 'custom':
    default:
      drawCustom(ctx, W, H, u, skinValue, rng);
      break;
  }
};

/* ------------------------------------------------------------------ */
/* Image loading                                                       */
/* ------------------------------------------------------------------ */

const imageCache = new Map<string, Promise<HTMLImageElement>>();

const loadImage = (src: string): Promise<HTMLImageElement> => {
  const key = src.slice(0, 96) + src.length;
  const cached = imageCache.get(key);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
  imageCache.set(key, promise);
  return promise;
};

const drawCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number,
  H: number,
): void => {
  const scale = Math.max(W / img.width, H / img.height);
  const width = img.width * scale;
  const height = img.height * scale;
  ctx.drawImage(img, (W - width) / 2, (H - height) / 2, width, height);
};

/* ------------------------------------------------------------------ */
/* Branding                                                            */
/* ------------------------------------------------------------------ */

const drawBranding = (
  ctx: CanvasRenderingContext2D,
  x: number,
  baseline: number,
  u: number,
  skinValue: Skin,
  type: TypeSystem,
  align: 'left' | 'center' = 'left',
): void => {
  ctx.font = fontString(u * 0.016, type.label, 500);
  const label = 'CHRONOCANVAS';
  const tracking = u * 0.004;
  const width = measureTracking(ctx, label, tracking);
  const startX = align === 'center' ? x - width / 2 : x;
  drawTracking(ctx, label, startX, baseline, tracking, withAlpha(skinValue.text, 0.52));

  ctx.strokeStyle = withAlpha(skinValue.accent, 0.6);
  ctx.lineWidth = Math.max(1, u * 0.0012);
  ctx.beginPath();
  ctx.arc(startX - u * 0.016, baseline - u * 0.005, u * 0.007, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = withAlpha(skinValue.accent, 0.8);
  ctx.beginPath();
  ctx.arc(startX - u * 0.016, baseline - u * 0.005, u * 0.0022, 0, Math.PI * 2);
  ctx.fill();
};

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

const drawProgress = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  u: number,
  skinValue: Skin,
  type: TypeSystem,
  done: number,
  total: number,
): number => {
  const percent = pct(done, total);
  const barHeight = Math.max(3, u * 0.0035);
  ctx.fillStyle = withAlpha(skinValue.text, 0.14);
  roundedRect(ctx, x, y, width, barHeight, barHeight);
  ctx.fill();

  if (percent > 0) {
    const fill = ctx.createLinearGradient(x, y, x + width, y);
    fill.addColorStop(0, skinValue.accent);
    fill.addColorStop(1, skinValue.secondary);
    roundedRect(ctx, x, y, Math.max(barHeight, (width * percent) / 100), barHeight, barHeight);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  drawTracking(
    ctx,
    `${percent}% PREPARED`,
    x,
    y + barHeight + u * 0.028,
    u * 0.0028,
    withAlpha(skinValue.text, 0.6),
  );
  drawText(
    ctx,
    `${done} / ${total} MILESTONES`,
    x + width,
    y + barHeight + u * 0.028,
    type.label,
    u * 0.015,
    500,
    withAlpha(skinValue.text, 0.45),
    'right',
  );
  return barHeight + u * 0.04;
};

/* ------------------------------------------------------------------ */
/* Milestone panel                                                     */
/* ------------------------------------------------------------------ */

interface NextPanelLayout {
  height: number;
  titleLines: string[];
  pad: number;
  labelSize: number;
  titleSize: number;
  metaSize: number;
  next: Milestone | null;
  secondary: GoalBundle[];
}

const layoutNextPanel = (
  ctx: CanvasRenderingContext2D,
  width: number,
  primary: GoalBundle,
  secondary: GoalBundle[],
  u: number,
  type: TypeSystem,
): NextPanelLayout => {
  const pad = u * 0.032;
  const labelSize = u * 0.0165;
  const titleSize = u * 0.033;
  const metaSize = u * 0.019;
  const next =
    primary.milestones
      .filter((m) => !m.done)
      .sort((a, b) => parse(a.date).getTime() - parse(b.date).getTime())[0] ?? null;

  ctx.font = fontString(titleSize, type.display, 400);
  const titleLines = next
    ? wrapAll(ctx, next.title, width - pad * 2.4).slice(0, 2)
    : [primary.milestones.length > 0 ? 'Every milestone complete' : 'The canvas is ready'];

  let height = pad * 2 + labelSize * 1.4 + u * 0.014;
  height += titleLines.length * titleSize * 1.18;
  height += u * 0.014 + metaSize * 1.4;

  if (secondary.length > 0) {
    height += u * 0.03 + secondary.slice(0, 2).length * u * 0.042;
  }
  return { height, titleLines, pad, labelSize, titleSize, metaSize, next, secondary: secondary.slice(0, 2) };
};

const drawNextPanel = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  layout: NextPanelLayout,
  primary: GoalBundle,
  u: number,
  skinValue: Skin,
  spec: WallpaperSpec,
  type: TypeSystem,
  now: Date,
): number => {
  const { height, titleLines, pad, labelSize, titleSize, metaSize, next, secondary } = layout;
  drawPanel(ctx, x, y, width, height, skinValue, spec, u * 0.035);

  const padX = pad * 1.2;
  const accentX = x + padX * 0.45;
  ctx.fillStyle = withAlpha(skinValue.accent, 0.8);
  roundedRect(ctx, accentX, y + pad, Math.max(1.5, u * 0.0022), height - pad * 2, u * 0.002);
  ctx.fill();

  const contentX = x + padX + u * 0.02;
  const rightX = x + width - padX;

  ctx.font = fontString(labelSize, type.label, 500);
  drawTracking(
    ctx,
    next ? 'NEXT MOMENT' : 'STATUS',
    contentX,
    y + pad + labelSize,
    u * 0.0034,
    withAlpha(skinValue.accent, 0.9),
  );

  if (next) {
    const tag = next.offsetDays === 0 ? 'T-0' : `T-${next.offsetDays}`;
    ctx.font = fontString(labelSize, type.label, 500);
    drawText(
      ctx,
      tag,
      rightX,
      y + pad + labelSize,
      type.label,
      labelSize,
      500,
      withAlpha(skinValue.accent, 0.85),
      'right',
    );
  }

  let cursor = y + pad + labelSize * 1.4 + u * 0.014;
  ctx.font = fontString(titleSize, type.display, 400);
  ctx.fillStyle = skinValue.text;
  ctx.textAlign = 'left';
  titleLines.forEach((line) => {
    cursor += titleSize * 0.98;
    ctx.fillText(line, contentX, cursor);
    cursor += titleSize * 0.2;
  });

  cursor += u * 0.004;
  const meta = next
    ? `${format(parse(next.date), 'EEE d MMM')} · ${next.duration} min · ${next.priority}`
    : primary.goal.achievedAt
      ? 'Goal marked achieved'
      : 'The countdown is the only thing left';
  drawTracking(
    ctx,
    meta.toUpperCase(),
    contentX,
    cursor + metaSize,
    u * 0.0018,
    withAlpha(skinValue.text, 0.52),
  );

  if (secondary.length > 0) {
    const dividerY = y + height - pad - secondary.length * u * 0.042 - u * 0.018;
    ctx.strokeStyle = withAlpha(skinValue.text, 0.12);
    ctx.lineWidth = Math.max(1, u * 0.0009);
    ctx.beginPath();
    ctx.moveTo(contentX, dividerY);
    ctx.lineTo(rightX, dividerY);
    ctx.stroke();

    secondary.forEach((bundle, index) => {
      const rowY = dividerY + u * 0.026 + index * u * 0.042;
      drawText(
        ctx,
        ellipsize(ctx, bundle.goal.name, width * 0.62),
        contentX,
        rowY,
        type.sans,
        u * 0.019,
        400,
        withAlpha(skinValue.text, 0.78),
      );
      const countdown = getCountdown(bundle.goal.deadline, now);
      drawTracking(
        ctx,
        countdown.isPast ? 'ARRIVED' : `${countdown.days} DAYS`,
        rightX,
        rowY,
        u * 0.0018,
        withAlpha(skinValue.accent, 0.9),
        'right',
      );
    });
  }

  return height;
};

/* ------------------------------------------------------------------ */
/* Countdown blocks                                                    */
/* ------------------------------------------------------------------ */

const countdownValues = (goal: Goal, now: Date): { days: string; hours: string; minutes: string; past: boolean } => {
  const parts = getCountdown(goal.deadline, now);
  return {
    days: parts.days < 100 ? pad2(parts.days) : String(parts.days),
    hours: pad2(parts.hours),
    minutes: pad2(parts.minutes),
    past: parts.isPast,
  };
};

const drawStacked = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  u: number,
  skinValue: Skin,
  type: TypeSystem,
  goal: Goal,
  now: Date,
): number => {
  const values = countdownValues(goal, now);
  let numberSize = u * 0.3;
  ctx.font = fontString(numberSize, type.display, type.numberWeight);
  const widthOfNumber = ctx.measureText(values.days).width;

  const gradient = ctx.createLinearGradient(x, y, x + width * 0.9, y + numberSize);
  gradient.addColorStop(0, skinValue.text);
  gradient.addColorStop(0.55, skinValue.accent);
  gradient.addColorStop(1, mixHex(skinValue.accent, skinValue.secondary, 0.55));
  ctx.fillStyle = gradient;
  ctx.textAlign = 'left';
  ctx.fillText(values.days, x, y + numberSize * 0.86);

  const labelY = y + numberSize * 0.86 + u * 0.042;
  ctx.font = fontString(u * 0.019, type.label, 500);
  drawTracking(
    ctx,
    values.past ? 'THE DAY HAS ARRIVED' : values.days === '01' ? 'DAY TO GO' : 'DAYS TO GO',
    x + u * 0.004,
    labelY,
    u * 0.0052,
    withAlpha(skinValue.text, 0.7),
  );

  const timeY = labelY + u * 0.062;
  const timeSize = u * 0.047;
  const timeColor = withAlpha(skinValue.text, 0.82);
  drawText(ctx, values.hours, x, timeY, type.display, timeSize, type.numberWeight, timeColor);
  ctx.font = fontString(timeSize, type.display, type.numberWeight);
  const hourWidth = ctx.measureText(values.hours).width;
  drawTracking(
    ctx,
    'HRS',
    x + hourWidth + u * 0.012,
    timeY - u * 0.002,
    u * 0.0028,
    withAlpha(skinValue.text, 0.42),
  );

  const minuteX = x + hourWidth + u * 0.075;
  drawText(ctx, values.minutes, minuteX, timeY, type.display, timeSize, type.numberWeight, timeColor);
  ctx.font = fontString(timeSize, type.display, type.numberWeight);
  const minuteWidth = ctx.measureText(values.minutes).width;
  drawTracking(
    ctx,
    'MIN',
    minuteX + minuteWidth + u * 0.012,
    timeY - u * 0.002,
    u * 0.0028,
    withAlpha(skinValue.text, 0.42),
  );

  const decorated = Math.min(widthOfNumber, width * 0.7);
  ctx.strokeStyle = withAlpha(skinValue.accent, 0.28);
  ctx.lineWidth = Math.max(1, u * 0.0009);
  ctx.beginPath();
  ctx.moveTo(x + decorated + u * 0.055, y + u * 0.03);
  ctx.lineTo(x + decorated + u * 0.055, y + numberSize * 0.75);
  ctx.stroke();

  return timeY - y + u * 0.02;
};

const drawInline = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  u: number,
  skinValue: Skin,
  type: TypeSystem,
  goal: Goal,
  now: Date,
): number => {
  const values = countdownValues(goal, now);
  const columns = [
    { value: values.days, label: 'DAYS' },
    { value: values.hours, label: 'HOURS' },
    { value: values.minutes, label: 'MINUTES' },
  ];
  const numberSize = Math.min(u * 0.155, width * 0.16);
  const colWidth = width / 3;
  let maxHeight = 0;

  columns.forEach((column, index) => {
    const colX = x + index * colWidth;
    if (index > 0) {
      ctx.strokeStyle = withAlpha(skinValue.text, 0.14);
      ctx.lineWidth = Math.max(1, u * 0.001);
      ctx.beginPath();
      ctx.moveTo(colX - u * 0.01, y);
      ctx.lineTo(colX - u * 0.01, y + numberSize * 0.86);
      ctx.stroke();
    }
    drawText(ctx, column.value, colX, y + numberSize * 0.82, type.display, numberSize, type.numberWeight, skinValue.accent);
    drawTracking(
      ctx,
      column.label,
      colX,
      y + numberSize * 0.82 + u * 0.038,
      u * 0.0046,
      withAlpha(skinValue.text, 0.5),
    );
    maxHeight = Math.max(maxHeight, numberSize * 0.82 + u * 0.038);
  });

  return maxHeight + u * 0.02;
};

const drawRing = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  u: number,
  skinValue: Skin,
  type: TypeSystem,
  goal: Goal,
  milestones: Milestone[],
  now: Date,
): number => {
  const values = countdownValues(goal, now);
  const diameter = Math.min(u * 0.44, width);
  const cx = x + diameter / 2;
  const cy = y + diameter / 2;
  const radius = diameter / 2;
  const done = milestones.filter((m) => m.done).length;
  const percent = pct(done, milestones.length);

  ctx.strokeStyle = withAlpha(skinValue.text, 0.1);
  ctx.lineWidth = Math.max(2, u * 0.005);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  if (percent > 0) {
    ctx.strokeStyle = skinValue.accent;
    ctx.lineWidth = Math.max(2, u * 0.005);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * percent) / 100);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  ctx.strokeStyle = withAlpha(skinValue.secondary, 0.3);
  ctx.lineWidth = Math.max(1, u * 0.001);
  ctx.beginPath();
  ctx.arc(cx, cy, radius - u * 0.026, 0, Math.PI * 2);
  ctx.stroke();

  const numberSize = diameter * 0.34;
  drawText(
    ctx,
    values.days,
    cx,
    cy + numberSize * 0.18,
    type.display,
    numberSize,
    type.numberWeight,
    skinValue.text,
    'center',
  );
  drawTracking(
    ctx,
    values.past ? 'ARRIVED' : 'DAYS',
    cx,
    cy + numberSize * 0.42,
    u * 0.0045,
    withAlpha(skinValue.text, 0.55),
    'center',
  );

  drawTracking(
    ctx,
    `${values.hours} HRS  ·  ${values.minutes} MIN`,
    x,
    y + diameter + u * 0.052,
    u * 0.003,
    withAlpha(skinValue.text, 0.6),
  );

  return diameter + u * 0.075;
};

const drawCountdown = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  u: number,
  skinValue: Skin,
  spec: WallpaperSpec,
  type: TypeSystem,
  bundle: GoalBundle,
  now: Date,
): number => {
  switch (spec.layout) {
    case 'inline':
      return drawInline(ctx, x, y, width, u, skinValue, type, bundle.goal, now);
    case 'ring':
      return drawRing(ctx, x, y, width, u, skinValue, type, bundle.goal, bundle.milestones, now);
    case 'stacked':
    default:
      return drawStacked(ctx, x, y, width, u, skinValue, type, bundle.goal, now);
  }
};

/* ------------------------------------------------------------------ */
/* Portrait composition                                                */
/* ------------------------------------------------------------------ */

const drawPortrait = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  u: number,
  skinValue: Skin,
  spec: WallpaperSpec,
  primary: GoalBundle,
  secondary: GoalBundle[],
  now: Date,
): void => {
  const type = typeFor(spec.typography);
  const margin = W * 0.09;
  const contentWidth = W - margin * 2;
  const top = H * (spec.clockSafe ? 0.185 : 0.08);
  const bottom = H * (spec.clockSafe ? 0.11 : 0.055);
  const brandBaseline = H - bottom * 0.32;

  let y = top;

  if (spec.milestonePlacement === 'top') {
    const layout = layoutNextPanel(ctx, contentWidth, primary, secondary, u, type);
    y += drawNextPanel(ctx, margin, y, contentWidth, layout, primary, u, skinValue, spec, type, now);
    y += u * 0.055;
  }

  ctx.font = fontString(u * 0.017, type.label, 500);
  drawTracking(
    ctx,
    'COUNTDOWN TO',
    margin,
    y,
    u * 0.0055,
    withAlpha(skinValue.accent, 0.95),
  );
  ctx.strokeStyle = withAlpha(skinValue.accent, 0.4);
  ctx.lineWidth = Math.max(1, u * 0.001);
  ctx.beginPath();
  ctx.moveTo(margin + measureTracking(ctx, 'COUNTDOWN TO', u * 0.0055) + u * 0.024, y - u * 0.004);
  ctx.lineTo(margin + contentWidth * 0.42, y - u * 0.004);
  ctx.stroke();

  y += u * 0.035;
  const title = fitTitle(
    ctx,
    primary.goal.name,
    contentWidth,
    3,
    u * 0.112,
    u * 0.055,
    type.display,
    type.titleWeight,
  );
  ctx.font = fontString(title.size, type.display, type.titleWeight);
  ctx.fillStyle = skinValue.text;
  ctx.textAlign = 'left';
  const lineHeight = title.size * 1.06;
  title.lines.forEach((line, index) => {
    ctx.fillText(line, margin, y + title.size * 0.78 + index * lineHeight);
  });
  y += title.lines.length * lineHeight + u * 0.022;

  const goalCountdown = getCountdown(primary.goal.deadline, now);
  const deadlineLabel = `${format(parse(primary.goal.deadline), 'd MMMM yyyy').toUpperCase()} · ${
    goalCountdown.isPast ? 'THE DATE HAS ARRIVED' : `${goalCountdown.days} DAYS FROM TODAY`
  }`;
  drawTracking(
    ctx,
    deadlineLabel,
    margin,
    y,
    u * 0.0024,
    withAlpha(skinValue.text, 0.5),
  );
  y += u * 0.075;

  const countdownHeight = drawCountdown(
    ctx,
    margin,
    y,
    contentWidth,
    u,
    skinValue,
    spec,
    type,
    primary,
    now,
  );
  y += countdownHeight + u * 0.035;

  const done = primary.milestones.filter((m) => m.done).length;
  if (spec.showProgress) {
    drawProgress(
      ctx,
      margin,
      y,
      contentWidth,
      u,
      skinValue,
      type,
      done,
      primary.milestones.length,
    );
  }

  if (spec.milestonePlacement !== 'none') {
    const layout = layoutNextPanel(ctx, contentWidth, primary, secondary, u, type);
    const panelY = Math.max(
      y + u * 0.04,
      brandBaseline - u * 0.05 - layout.height,
    );
    drawNextPanel(
      ctx,
      margin,
      panelY,
      contentWidth,
      layout,
      primary,
      u,
      skinValue,
      spec,
      type,
      now,
    );
  }

  if (spec.showBranding) {
    drawBranding(ctx, margin, brandBaseline + u * 0.01, u, skinValue, type, 'left');
  }
};

/* ------------------------------------------------------------------ */
/* Landscape composition                                               */
/* ------------------------------------------------------------------ */

const drawLandscape = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  u: number,
  skinValue: Skin,
  spec: WallpaperSpec,
  primary: GoalBundle,
  secondary: GoalBundle[],
  now: Date,
): void => {
  const type = typeFor(spec.typography);
  const margin = H * 0.085;
  const leftWidth = W * 0.5;
  const top = H * 0.16;

  let y = top;
  ctx.font = fontString(u * 0.014, type.label, 500);
  drawTracking(ctx, 'COUNTDOWN TO', margin, y, u * 0.005, withAlpha(skinValue.accent, 0.95));
  ctx.strokeStyle = withAlpha(skinValue.accent, 0.35);
  ctx.lineWidth = Math.max(1, u * 0.0008);
  ctx.beginPath();
  ctx.moveTo(margin + measureTracking(ctx, 'COUNTDOWN TO', u * 0.005) + u * 0.03, y - u * 0.004);
  ctx.lineTo(margin + leftWidth * 0.55, y - u * 0.004);
  ctx.stroke();

  y += u * 0.03;
  const title = fitTitle(
    ctx,
    primary.goal.name,
    leftWidth,
    3,
    u * 0.078,
    u * 0.038,
    type.display,
    type.titleWeight,
  );
  ctx.font = fontString(title.size, type.display, type.titleWeight);
  ctx.fillStyle = skinValue.text;
  ctx.textAlign = 'left';
  title.lines.forEach((line, index) => {
    ctx.fillText(line, margin, y + title.size * 0.8 + index * title.size * 1.05);
  });
  y += title.lines.length * title.size * 1.05 + u * 0.016;

  drawTracking(
    ctx,
    `${format(parse(primary.goal.deadline), 'd MMMM yyyy').toUpperCase()} · ${categoryLabel(
      primary.goal.category,
    ).toUpperCase()}`,
    margin,
    y,
    u * 0.002,
    withAlpha(skinValue.text, 0.5),
  );

  const panelWidth = W * 0.28;
  const panelX = W - margin - panelWidth;
  const panelLayout = layoutNextPanel(ctx, panelWidth, primary, secondary, u * 0.9, type);
  const panelY = H * 0.2;
  drawNextPanel(
    ctx,
    panelX,
    panelY,
    panelWidth,
    panelLayout,
    primary,
    u * 0.9,
    skinValue,
    spec,
    type,
    now,
  );

  const countdownY = H * 0.52;
  const countdownHeight = drawCountdown(
    ctx,
    margin,
    countdownY,
    leftWidth,
    u,
    skinValue,
    spec,
    type,
    primary,
    now,
  );

  if (spec.showProgress) {
    drawProgress(
      ctx,
      margin,
      countdownY + countdownHeight + u * 0.022,
      leftWidth,
      u,
      skinValue,
      type,
      primary.milestones.filter((m) => m.done).length,
      primary.milestones.length,
    );
  }

  if (spec.showBranding) {
    drawBranding(ctx, margin, H - margin * 0.55, u, skinValue, type, 'left');
  }

  drawText(
    ctx,
    'YOUR TIME. YOUR STORY.',
    W - margin,
    H - margin * 0.55,
    type.label,
    u * 0.012,
    500,
    withAlpha(skinValue.text, 0.32),
    'right',
  );
};

/* ------------------------------------------------------------------ */
/* Renderer                                                            */
/* ------------------------------------------------------------------ */

const loadFonts = async (): Promise<void> => {
  if (typeof document === 'undefined' || !document.fonts) return;
  const specs = [
    '300 40px Fraunces',
    '400 40px Fraunces',
    '500 40px Fraunces',
    '300 40px Inter',
    '400 40px Inter',
    '500 40px Inter',
    '600 40px Inter',
    '500 40px "Space Grotesk"',
    '400 40px "JetBrains Mono"',
    '500 40px "JetBrains Mono"',
  ];
  await Promise.all(
    specs.map((spec) => document.fonts.load(spec).catch(() => undefined)),
  );
  await document.fonts.ready.catch(() => undefined);
};

const dimensionsFor = (device: DeviceId, quality: Quality): { W: number; H: number } => {
  const meta = deviceOf(device);
  if (quality === 'full') return { W: meta.width, H: meta.height };
  const target = meta.family === 'desktop' ? 1200 : 760;
  const scale = Math.min(1, target / meta.width);
  return { W: Math.round(meta.width * scale), H: Math.round(meta.height * scale) };
};

export const renderWallpaper = async (
  canvas: HTMLCanvasElement,
  args: WallpaperRenderArgs,
  quality: Quality = 'preview',
): Promise<void> => {
  const { spec, device, goals, now = new Date() } = args;
  const primary = goals.find((g) => g.goal.id === spec.goalIds[0]) ?? goals[0];
  if (!primary) throw new Error('Choose a goal before generating a wallpaper.');

  await loadFonts();

  const { W, H } = dimensionsFor(device, quality);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw on canvas.');

  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  const skinValue = resolveSkin(spec);
  const isPortrait = H >= W;
  const u = isPortrait ? Math.min(W, H * 0.62) : H;
  const rng = mulberry32(hashString(`${primary.goal.id}:${spec.theme}:${device}:${spec.palette}`));

  const background = ctx.createLinearGradient(0, 0, W * 0.7, H);
  background.addColorStop(0, skinValue.bgFrom);
  background.addColorStop(0.55, skinValue.bgTo);
  background.addColorStop(1, skinValue.bgDeep);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);

  if (spec.backgroundImage) {
    try {
      const img = await loadImage(spec.backgroundImage);
      ctx.save();
      ctx.globalAlpha = 0.95;
      drawCover(ctx, img, W, H);
      ctx.restore();
      const tintStrength = 0.28 + (100 - clamp(spec.transparency, 0, 100)) / 260;
      ctx.fillStyle = withAlpha(skinValue.bgDeep, Math.min(0.85, tintStrength));
      ctx.fillRect(0, 0, W, H);
    } catch {
      /* keep the gradient if the image is unavailable */
    }
  }

  drawGlow(ctx, W * 0.5, H * 0.25, Math.min(W, H) * 0.65, skinValue.accent, skinValue.dark ? 0.14 : 0.2);
  drawGlow(ctx, W * 0.15, H * 0.75, Math.min(W, H) * 0.5, skinValue.secondary, skinValue.dark ? 0.14 : 0.16);

  if (spec.decorations) {
    drawDecorations(ctx, W, H, u, skinValue, spec, rng);
  }

  const secondary = goals.filter((g) => g.goal.id !== primary.goal.id).slice(0, 2);

  if (isPortrait) {
    drawPortrait(ctx, W, H, u, skinValue, spec, primary, secondary, now);
  } else {
    drawLandscape(ctx, W, H, u, skinValue, spec, primary, secondary, now);
  }

  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, withAlpha(skinValue.bgDeep, skinValue.dark ? 0.28 : 0.1));
  shade.addColorStop(0.22, 'rgba(0,0,0,0)');
  shade.addColorStop(0.8, 'rgba(0,0,0,0)');
  shade.addColorStop(1, withAlpha(skinValue.bgDeep, skinValue.dark ? 0.22 : 0.08));
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
};

export const wallpaperFilename = (goal: Goal, device: DeviceId): string =>
  `${slugify(goal.name)}-${device}-chronocanvas.png`;

export const buildDefaultSpec = (goal: Goal, device: DeviceId): WallpaperSpec => {
  const themeByCategory: Record<Goal['category'], ThemeId> = {
    exams: 'glass',
    work: 'autumn',
    project: 'glass',
    birthday: 'festive',
    wedding: 'botanical',
    festival: 'festive',
    travel: 'botanical',
    fitness: 'minimal',
    personal: 'pastel',
    custom: 'custom',
  };
  const meta = deviceOf(device);
  return {
    theme: themeByCategory[goal.category],
    palette: 'theme',
    typography: 'editorial',
    layout: meta.family === 'desktop' ? 'inline' : 'stacked',
    milestonePlacement: 'bottom',
    decorations: true,
    clockSafe: meta.family === 'mobile',
    appearance: themeOf(themeByCategory[goal.category]).appearance,
    transparency: 45,
    showBranding: true,
    showProgress: true,
    goalIds: [goal.id],
    backgroundImage: null,
    extracted: null,
  };
};

export const renderWallpaperDataUrl = async (
  args: WallpaperRenderArgs,
  quality: Quality = 'full',
): Promise<string> => {
  const canvas = document.createElement('canvas');
  await renderWallpaper(canvas, args, quality);
  return canvas.toDataURL('image/png');
};

export const compressBackgroundImage = async (
  dataUrl: string,
  maxSide = 1600,
  quality = 0.85,
): Promise<string> => {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return dataUrl;
  }
};
