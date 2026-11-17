import type { WallpaperSpec } from '@/types';
import { THEMES } from './catalog';

interface PromptPatch {
  patch: Partial<WallpaperSpec>;
  rationale: string;
}

const includesAny = (text: string, words: string[]): boolean => words.some((word) => text.includes(word));

const THEME_KEYWORDS: { keywords: string[]; theme: WallpaperSpec['theme'] }[] = [
  { keywords: ['autumn', 'maple', 'foliage', 'leaves', 'leaf', 'golden hour', 'fall'], theme: 'autumn' },
  { keywords: ['glass', 'frosted', 'translucent', 'frost', 'blur'], theme: 'glass' },
  { keywords: ['neon', 'electric violet', 'night city', 'glow', 'synthwave'], theme: 'neon' },
  { keywords: ['minimal', 'minimalist', 'clean', 'quiet', 'white space', 'simple'], theme: 'minimal' },
  { keywords: ['botanical', 'plant', 'forest', 'green', 'fern', 'sage'], theme: 'botanical' },
  { keywords: ['pastel', 'dreamy', 'soft pink', 'lavender haze', 'blush'], theme: 'pastel' },
  { keywords: ['cyberpunk', 'futuristic', 'magenta', 'chrome', 'sci-fi'], theme: 'cyberpunk' },
  { keywords: ['cinematic', 'film', 'dramatic', 'moody', 'amber and black'], theme: 'cinematic' },
  { keywords: ['festive', 'celebration', 'confetti', 'birthday', 'party'], theme: 'festive' },
];

const LEVEL_KEYWORDS: { keywords: string[]; palette: WallpaperSpec['palette'] }[] = [
  { keywords: ['champagne', 'gold', 'gilded', 'warm neutral'], palette: 'champagne' },
  { keywords: ['lavender', 'lilac', 'violet', 'purple'], palette: 'lavender' },
  { keywords: ['monochrome', 'black and white', 'grayscale', 'graphite'], palette: 'monochrome' },
  { keywords: ['rose', 'pink', 'blush'], palette: 'rose' },
  { keywords: ['emerald', 'sage', 'green'], palette: 'emerald' },
  { keywords: ['ocean', 'teal', 'blue', 'cyan'], palette: 'ocean' },
];

export const localPromptDirection = (prompt: string, _current: WallpaperSpec): PromptPatch => {
  const text = prompt.toLowerCase();
  const patch: Partial<WallpaperSpec> = {};
  const notes: string[] = [];

  const themeMatch = THEME_KEYWORDS.find((entry) => includesAny(text, entry.keywords));
  if (themeMatch) {
    patch.theme = themeMatch.theme;
    const meta = THEMES.find((t) => t.id === themeMatch.theme);
    if (meta) patch.appearance = meta.appearance;
    notes.push(`the ${THEMES.find((t) => t.id === themeMatch.theme)?.label ?? themeMatch.theme} atmosphere`);
  }

  const paletteMatch = LEVEL_KEYWORDS.find((entry) => includesAny(text, entry.keywords));
  if (paletteMatch) {
    patch.palette = paletteMatch.palette;
    notes.push(`a ${paletteMatch.palette} palette`);
  }

  if (includesAny(text, ['light', 'bright', 'airy', 'ivory', 'daylight', 'white'])) patch.appearance = 'light';
  if (includesAny(text, ['dark', 'midnight', 'moody', 'noir', 'night'])) patch.appearance = 'dark';

  if (includesAny(text, ['serif', 'editorial', 'classic', 'elegant type'])) patch.typography = 'editorial';
  else if (includesAny(text, ['futuristic', 'technical', 'mono', 'tech'])) patch.typography = 'tech';
  else if (includesAny(text, ['modern', 'bold', 'grotesk', 'clean type'])) patch.typography = 'modern';
  else if (includesAny(text, ['light type', 'thin type', 'quiet type'])) patch.typography = 'minimal';

  if (includesAny(text, ['ring', 'circular', 'orbit'])) patch.layout = 'ring';
  else if (includesAny(text, ['in a row', 'row', 'horizontal', 'inline'])) patch.layout = 'inline';

  if (includesAny(text, ['no decoration', 'without decoration', 'no ornament', 'plain'])) {
    patch.decorations = false;
    notes.push('a quieter surface');
  }

  if (includesAny(text, ['milestone', 'next step', 'task on'])) {
    patch.milestonePlacement = 'bottom';
  }

  if (Object.keys(patch).length === 0) {
    const seed = text.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const meta = THEMES[seed % THEMES.length];
    patch.theme = meta.id;
    patch.palette = 'theme';
    patch.appearance = meta.appearance;
    notes.push(`${meta.label}, chosen to match the mood`);
  }

  return {
    patch,
    rationale: notes.length
      ? `Interpreted locally as ${notes.join(', ')}. Connect Gemini for a more nuanced art direction.`
      : `Refined the current composition around “${prompt.trim() || 'your description'}”. Connect Gemini for a deeper interpretation.`,
  };
};

export const randomSpecPatch = (): Partial<WallpaperSpec> => {
  const themes = THEMES.filter((theme) => theme.id !== 'custom');
  const theme = themes[Math.floor(Math.random() * themes.length)];
  const palettes: WallpaperSpec['palette'][] = [
    'theme',
    'champagne',
    'lavender',
    'rose',
    'emerald',
    'ocean',
    'monochrome',
  ];
  const layouts: WallpaperSpec['layout'][] = ['stacked', 'inline', 'ring'];
  const typographies: WallpaperSpec['typography'][] = ['editorial', 'modern', 'tech', 'minimal'];
  return {
    theme: theme.id,
    appearance: theme.appearance,
    palette: palettes[Math.floor(Math.random() * palettes.length)],
    layout: layouts[Math.floor(Math.random() * layouts.length)],
    typography: typographies[Math.floor(Math.random() * typographies.length)],
    decorations: Math.random() > 0.12,
    transparency: 25 + Math.round(Math.random() * 45),
  };
};
