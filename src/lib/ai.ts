import { differenceInCalendarDays, startOfDay } from 'date-fns';
import type {
  CoachPlan,
  ExtractedPalette,
  GeneratedMilestone,
  Goal,
  Milestone,
  PlanDraft,
  Priority,
  Settings,
  WallpaperSpec,
} from '@/types';
import { PALETTES, THEMES, TYPOGRAPHIES } from './catalog';
import { buildLocalCoach } from './planner';
import { daysUntil, fmtDateLong, fmtDateShort, parse } from './dates';

export class AIError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AIError';
    this.status = status;
  }
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export const isAIConfigured = (settings: Settings): boolean =>
  Boolean(settings.ai.apiKey && settings.ai.apiKey.trim().length > 10);

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
}

interface GeminiPayload {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string; code?: number };
}

const friendlyStatusError = (status: number, detail?: string): AIError => {
  if (status === 400) {
    return new AIError(
      'Gemini rejected the request. Check your API key and model name in Settings, then try again.',
      status,
    );
  }
  if (status === 401 || status === 403) {
    return new AIError('That Gemini API key was not accepted. Create a fresh key and paste it in Settings.', status);
  }
  if (status === 404) {
    return new AIError(
      'That Gemini model is not available for this key. Try gemini-2.5-flash for text, or check the model name.',
      status,
    );
  }
  if (status === 429) {
    return new AIError('Gemini rate limit reached. Wait a moment, then try again.', status);
  }
  if (status >= 500) {
    return new AIError('The Gemini service is temporarily unavailable. Your local plan still works.', status);
  }
  return new AIError(detail?.slice(0, 220) || `Gemini returned an unexpected error (${status}).`, status);
};

const callGemini = async (
  settings: Settings,
  model: string,
  body: unknown,
): Promise<GeminiPayload> => {
  if (!settings.ai.apiKey.trim()) {
    throw new AIError('Add your Gemini API key in Settings to use AI planning.');
  }
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': settings.ai.apiKey.trim(),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AIError('Could not reach Gemini. Check your connection and try again.');
  }

  const data = (await response.json().catch(() => ({}))) as GeminiPayload;
  if (!response.ok) {
    throw friendlyStatusError(response.status, data.error?.message);
  }
  if (data.promptFeedback?.blockReason) {
    throw new AIError('Gemini declined that request. Try rephrasing with different details.');
  }
  return data;
};

export const testAIConnection = async (settings: Settings): Promise<string> => {
  const payload = await callGemini(settings, settings.ai.textModel, {
    contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: connected.' }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 16 },
  });
  return extractText(payload) || 'Connected';
};

const extractText = (payload: GeminiPayload): string => {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? '')
    .filter(Boolean)
    .join('')
    .trim();
};

const parseJson = <T>(text: string): T => {
  if (!text) throw new AIError('Gemini returned an empty response. Try again.');
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    throw new AIError('Gemini did not return structured JSON. Try again with a slightly different goal.');
  }
  try {
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
  } catch {
    throw new AIError('Gemini returned malformed JSON. Try generating the plan again.');
  }
};

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const VALID_PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low'];

const normalizePriority = (value: unknown): Priority =>
  VALID_PRIORITIES.includes(value as Priority) ? (value as Priority) : 'medium';

const deadlineDays = (goal: Goal, now = new Date()): number =>
  Math.max(0, differenceInCalendarDays(startOfDay(parse(goal.deadline)), startOfDay(now)));

export const generateQuestionsWithAI = async (goal: Goal, settings: Settings): Promise<string[]> => {
  const prompt = `Goal: "${goal.name}"
Category: ${goal.category}
Importance: ${goal.importance}
Deadline: ${fmtDateLong(goal.deadline)} at ${new Date(goal.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
Days remaining: ${deadlineDays(goal)}
Daily preparation available: ${goal.prepMinutes} minutes
Notes from the user: ${goal.notes || 'none'}

Ask up to three short, specific questions whose answers would materially change the plan. Do not ask for information already provided. Return JSON exactly in this shape:
{"questions":["...","...","..."]}`;

  const payload = await callGemini(settings, settings.ai.textModel, {
    systemInstruction: {
      parts: [
        {
          text: 'You are ChronoCanvas\'s deadline strategist. You are concise, practical and warm. Return only valid JSON.',
        },
      ],
    },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.6, responseMimeType: 'application/json', maxOutputTokens: 512 },
  });

  const parsed = parseJson<{ questions?: unknown[] }>(extractText(payload));
  const questions = (Array.isArray(parsed.questions) ? parsed.questions : [])
    .map((q) => asString(q))
    .filter(Boolean)
    .slice(0, 3);
  if (questions.length === 0) throw new AIError('Gemini did not suggest any questions.');
  return questions;
};

export const generatePlanWithAI = async (
  goal: Goal,
  answers: string[],
  settings: Settings,
): Promise<PlanDraft> => {
  const days = deadlineDays(goal);
  const prompt = `Build a backward-planned milestone schedule for this deadline.

Goal: ${goal.name}
Category: ${goal.category}
Importance: ${goal.importance}
Deadline: ${fmtDateLong(goal.deadline)} (${fmtDateShort(goal.deadline)})
Days remaining today: ${days}
Available preparation: ${goal.prepMinutes} minutes per day
Preferred reminder time: ${goal.reminderTime}
Notes: ${goal.notes || 'none'}
Clarifying answers: ${answers.length > 0 ? answers.join(' | ') : 'none provided'}

Rules:
- Use backward planning anchored to the deadline, with T-30, T-14, T-10, T-7, T-5, T-3, T-1 and T-0 only where they fit inside ${days} days.
- Produce between 2 and 8 milestones. Never force all eight if time is short, and always include one at offsetDays 0.
- Every offsetDays must be an integer between 0 and ${days}. Offset 0 is deadline day.
- Tasks must be specific to this category and goal, sequential, and non-duplicative. No generic filler.
- Durations are minutes for one sitting, informed by the daily preparation time.
- Priorities must be one of: critical, high, medium, low. Deadline day is critical.
- reminderLead is minutes before the task (e.g. 1440 for one day, 120 for two hours).
- summary: one sentence. rationale: 2 sentences explaining the schedule logic.

Return JSON exactly:
{"summary":"...","rationale":"...","milestones":[{"offsetDays":30,"title":"...","description":"...","priority":"high","duration":60,"reminderEnabled":true,"reminderLead":1440}]}`;

  const payload = await callGemini(settings, settings.ai.textModel, {
    systemInstruction: {
      parts: [
        {
          text: 'You are ChronoCanvas\'s expert deadline planner. You design realistic, kind, high-leverage schedules. Return only valid JSON with no markdown.',
        },
      ],
    },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.65, responseMimeType: 'application/json', maxOutputTokens: 2600 },
  });

  const parsed = parseJson<{
    summary?: unknown;
    rationale?: unknown;
    milestones?: unknown[];
  }>(extractText(payload));

  const rawMilestones = Array.isArray(parsed.milestones) ? parsed.milestones : [];
  const normalized: GeneratedMilestone[] = rawMilestones
    .map((raw): GeneratedMilestone | null => {
      if (!raw || typeof raw !== 'object') return null;
      const item = raw as Record<string, unknown>;
      const title = asString(item.title);
      if (!title) return null;
      const offset = Math.round(
        Math.max(0, Math.min(days, asNumber(item.offsetDays, days))),
      );
      return {
        offsetDays: offset,
        title,
        description: asString(item.description, 'Keep this step focused and finish it in one sitting.'),
        priority: normalizePriority(item.priority),
        duration: Math.round(Math.max(15, Math.min(480, asNumber(item.duration, goal.prepMinutes)))),
        reminderEnabled: typeof item.reminderEnabled === 'boolean' ? item.reminderEnabled : true,
        reminderLead: Math.round(
          Math.max(0, Math.min(10080, asNumber(item.reminderLead, 1440))),
        ),
      };
    })
    .filter((m): m is GeneratedMilestone => m !== null)
    .slice(0, 10);

  const seen = new Set<string>();
  const deduped = normalized.filter((m) => {
    const key = m.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!deduped.some((m) => m.offsetDays === 0)) {
    deduped.push({
      offsetDays: 0,
      title: 'Deadline day: finish and close the loop',
      description: 'Deliver the outcome, confirm receipt, and note what you would repeat next time.',
      priority: 'critical',
      duration: Math.max(30, Math.min(90, goal.prepMinutes)),
      reminderEnabled: true,
      reminderLead: 120,
    });
  }

  deduped.sort((a, b) => b.offsetDays - a.offsetDays);
  if (deduped.length === 0) {
    throw new AIError('Gemini did not return usable milestones. Try again.');
  }

  return {
    summary: asString(
      parsed.summary,
      `${deduped.length} milestone${deduped.length === 1 ? '' : 's'} planned backward from ${fmtDateShort(goal.deadline)}.`,
    ),
    rationale: asString(
      parsed.rationale,
      'The plan protects the final week for review and logistics, and keeps the last 24 hours intentionally light.',
    ),
    questions: [],
    milestones: deduped,
    generatedBy: 'ai',
  };
};

export const generateCoachWithAI = async (
  goal: Goal,
  milestones: Milestone[],
  settings: Settings,
): Promise<CoachPlan> => {
  const local = buildLocalCoach(goal, milestones);
  const pending = milestones.filter((m) => !m.done);
  const prompt = `You are the user's deadline coach for "${goal.name}".
Deadline: ${fmtDateLong(goal.deadline)} (${daysUntil(goal.deadline)} days from today)
Milestones complete: ${milestones.filter((m) => m.done).length} of ${milestones.length}
Remaining tasks:
${pending
  .slice(0, 8)
  .map(
    (m) =>
      `- [${m.id}] ${m.title} | due ${fmtDateShort(m.date)} | ${m.priority} | ${m.duration} min | ${m.done ? 'done' : 'open'}`,
  )
  .join('\n') || '- none'}

Write a short, practical daily briefing. Pick up to three priorities from the task list by exact id. Be direct, never generic, and do not invent tasks that are not listed.
Return JSON:
{"headline":"max 90 chars","body":"2-3 sentences","tip":"one specific productivity tip","priorities":[{"id":"task id","why":"max 100 chars"}]}`;

  try {
    const payload = await callGemini(settings, settings.ai.textModel, {
      systemInstruction: {
        parts: [
          {
            text: 'You are an encouraging but rigorous deadline coach. No clichés. Return only valid JSON.',
          },
        ],
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.75, responseMimeType: 'application/json', maxOutputTokens: 900 },
    });

    const parsed = parseJson<{
      headline?: unknown;
      body?: unknown;
      tip?: unknown;
      priorities?: unknown[];
    }>(extractText(payload));

    const mapped = (Array.isArray(parsed.priorities) ? parsed.priorities : [])
      .map((raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const item = raw as Record<string, unknown>;
        const id = asString(item.id);
        const milestone = pending.find((m) => m.id === id);
        if (!milestone) return null;
        return {
          milestoneId: milestone.id,
          label: milestone.title,
          why: asString(item.why, `Due ${fmtDateShort(milestone.date)}`),
        };
      })
      .filter((p): p is { milestoneId: string; label: string; why: string } => p !== null)
      .slice(0, 3);

    return {
      headline: asString(parsed.headline, local.headline),
      body: asString(parsed.body, local.body),
      tip: asString(parsed.tip, local.tip),
      priorities: mapped.length > 0 ? mapped : local.priorities,
      generatedBy: 'ai',
    };
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw new AIError('The AI coach could not respond. Your local briefing is still available.');
  }
};

const VALID_THEMES = THEMES.map((t) => t.id);
const VALID_PALETTES = PALETTES.map((p) => p.id);
const VALID_TYPOGRAPHY = TYPOGRAPHIES.map((t) => t.id);
const VALID_LAYOUTS = ['stacked', 'inline', 'ring'] as const;
const VALID_PLACEMENTS = ['top', 'bottom', 'none'] as const;

export interface WallpaperDirection {
  patch: Partial<WallpaperSpec>;
  rationale: string;
}

export const interpretWallpaperPrompt = async (
  userPrompt: string,
  current: WallpaperSpec,
  goal: Goal,
  settings: Settings,
): Promise<WallpaperDirection> => {
  const prompt = `Design the art direction for a countdown lock screen wallpaper.

User's request: "${userPrompt}"
Goal: ${goal.name} (${goal.category}), deadline ${fmtDateShort(goal.deadline)}
Current theme: ${current.theme}, palette: ${current.palette}, typography: ${current.typography}, layout: ${current.layout}

Choose only from these values:
theme: ${VALID_THEMES.join(', ')}
palette: ${VALID_PALETTES.join(', ')}
typography: ${VALID_TYPOGRAPHY.join(', ')}
layout: ${VALID_LAYOUTS.join(', ')}
milestonePlacement: ${VALID_PLACEMENTS.join(', ')}
appearance: dark, light
decorations: boolean
transparency: integer 0-100 (higher = more translucent glass)
clockSafe: boolean

Return JSON:
{"theme":"autumn","palette":"champagne","typography":"editorial","layout":"stacked","milestonePlacement":"bottom","appearance":"dark","decorations":true,"transparency":45,"clockSafe":true,"rationale":"one sentence"}`;

  const payload = await callGemini(settings, settings.ai.textModel, {
    systemInstruction: {
      parts: [
        {
          text: 'You are ChronoCanvas\'s art director: editorial, restrained, luxurious. Translate mood language into the allowed design tokens. Return only valid JSON.',
        },
      ],
    },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, responseMimeType: 'application/json', maxOutputTokens: 600 },
  });

  const parsed = parseJson<Record<string, unknown>>(extractText(payload));
  const patch: Partial<WallpaperSpec> = {};
  const theme = asString(parsed.theme) as WallpaperSpec['theme'];
  if (VALID_THEMES.includes(theme)) patch.theme = theme;
  const palette = asString(parsed.palette) as WallpaperSpec['palette'];
  if (VALID_PALETTES.includes(palette)) patch.palette = palette;
  const typography = asString(parsed.typography) as WallpaperSpec['typography'];
  if (VALID_TYPOGRAPHY.includes(typography)) patch.typography = typography;
  const layout = asString(parsed.layout) as WallpaperSpec['layout'];
  if ((VALID_LAYOUTS as readonly string[]).includes(layout)) patch.layout = layout;
  const placement = asString(parsed.milestonePlacement) as WallpaperSpec['milestonePlacement'];
  if ((VALID_PLACEMENTS as readonly string[]).includes(placement)) patch.milestonePlacement = placement;
  if (parsed.appearance === 'dark' || parsed.appearance === 'light') patch.appearance = parsed.appearance;
  if (typeof parsed.decorations === 'boolean') patch.decorations = parsed.decorations;
  if (typeof parsed.clockSafe === 'boolean') patch.clockSafe = parsed.clockSafe;
  if (typeof parsed.transparency === 'number') {
    patch.transparency = Math.round(Math.max(0, Math.min(100, parsed.transparency)));
  }

  if (Object.keys(patch).length === 0) {
    throw new AIError('The art director did not return a usable direction. Try describing the mood differently.');
  }
  return {
    patch,
    rationale: asString(parsed.rationale, 'Translated your description into a matching editorial direction.'),
  };
};

export interface ReferenceDirection {
  theme?: WallpaperSpec['theme'];
  palette: ExtractedPalette;
  appearance: 'dark' | 'light';
  rationale: string;
}

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const analyzeReferenceWithAI = async (
  dataUrl: string,
  settings: Settings,
): Promise<ReferenceDirection> => {
  const base64 = dataUrl.split(',')[1] ?? '';
  if (!base64) throw new AIError('That reference image could not be read.');
  const mimeType = dataUrl.slice(5, dataUrl.indexOf(';')) || 'image/jpeg';

  const payload = await callGemini(settings, settings.ai.textModel, {
    systemInstruction: {
      parts: [
        {
          text: 'You are a color and art-direction analyst. Extract a refined, usable palette from the reference image. Return only valid JSON.',
        },
      ],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Analyse this reference image and return a wallpaper palette. Choose a theme from: ${VALID_THEMES.join(
              ', ',
            )}. Colors must be hex. The accent should be the most characterful color; background should be a deep or light surface that supports text.
JSON: {"theme":"autumn","appearance":"dark","palette":{"accent":"#E8CD9A","secondary":"#B6A8E8","background":"#0D1020","muted":"#5A5166"},"rationale":"one sentence"}`,
          },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json', maxOutputTokens: 500 },
  });

  const parsed = parseJson<{
    theme?: unknown;
    appearance?: unknown;
    palette?: unknown;
    rationale?: unknown;
  }>(extractText(payload));

  const paletteRaw = (parsed.palette ?? {}) as Record<string, unknown>;
  const fallback = { accent: '#E8CD9A', secondary: '#B6A8E8', background: '#0D1020', muted: '#5A5166' };
  const pickColor = (key: string): string => {
    const value = paletteRaw[key];
    return typeof value === 'string' && COLOR_RE.test(value) ? value : fallback[key as keyof typeof fallback];
  };

  const theme = asString(parsed.theme) as WallpaperSpec['theme'];
  return {
    theme: VALID_THEMES.includes(theme) ? theme : undefined,
    palette: {
      accent: pickColor('accent'),
      secondary: pickColor('secondary'),
      background: pickColor('background'),
      muted: pickColor('muted'),
    },
    appearance: parsed.appearance === 'light' ? 'light' : 'dark',
    rationale: asString(parsed.rationale, 'Matched the reference palette and tone.'),
  };
};

const ASPECT_BY_DEVICE: Record<string, string> = {
  iphone: '9:16',
  android: '9:16',
  tablet: '3:4',
  desktop: '16:9',
  laptop: '16:9',
};

const describeTheme = (theme: WallpaperSpec['theme']): string => {
  const map: Record<WallpaperSpec['theme'], string> = {
    autumn: 'warm autumn dusk, golden foliage, etched botanical details, soft amber light',
    glass: 'frosted glass panels floating in a violet dusk, champagne highlights, deep soft shadows',
    neon: 'midnight navy with electric violet and cyan neon glow, subtle light trails',
    minimal: 'ivory minimalism, warm off-white surface, one thin gold accent, generous negative space',
    botanical: 'deep forest green with pressed botanical leaves, sage and antique gold',
    pastel: 'dreamy lavender and blush pastel haze, soft focus, luminous airy gradient',
    cyberpunk: 'dark cyberpunk city haze, magenta and cyan rim light, grid, scanlines',
    cinematic: 'cinematic dark frame, warm amber dust, deep vignette, film grain',
    festive: 'deep plum celebration, gold confetti, warm festive glow, elegant not kitschy',
    custom: 'a unique editorial composition based on the described mood',
  };
  return map[theme];
};

export const generateWallpaperImage = async (
  settings: Settings,
  prompt: string,
  device: string,
  palette: ExtractedPalette,
): Promise<string> => {
  const direction = `${describeTheme('custom')} ${prompt}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Create a luxurious, high-resolution abstract background wallpaper for a ${device} lock screen. Art direction: ${direction}.
Color palette: ${palette.accent}, ${palette.secondary}, ${palette.background}, ${palette.muted}.
Requirements: no text, no letters, no numbers, no logos, no watermarks, no user interface. Leave the central third visually calm with soft low-contrast areas so typography remains readable. Editorial, premium, atmospheric. Subtle grain and depth. Do not include people or faces.`,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: ASPECT_BY_DEVICE[device] ?? '9:16' },
    },
  };

  const payload = await callGemini(settings, settings.ai.imageModel, body);
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
  if (!imagePart) {
    throw new AIError(
      'The image model returned no image. Confirm your key has access to Gemini image generation, or try a different image model in Settings.',
    );
  }
  const inline = imagePart.inlineData ?? imagePart.inline_data;
  const mime = inline && 'mimeType' in inline ? inline.mimeType : 'image/png';
  const data = inline?.data;
  if (!data) throw new AIError('The image response was empty. Try again.');
  return `data:${mime || 'image/png'};base64,${data}`;
};
