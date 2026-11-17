import {
  Briefcase,
  Cake,
  Compass,
  Dumbbell,
  Gem,
  GraduationCap,
  Layers,
  Plane,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react';
import type {
  CategoryId,
  DeviceId,
  LayoutId,
  PaletteId,
  Priority,
  ThemeId,
  TypographyId,
} from '@/types';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  short: string;
  blurb: string;
  icon: LucideIcon;
  accent: string;
  soft: string;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'exams',
    label: 'Exams & education',
    short: 'Education',
    blurb: 'Study campaigns, revision sweeps, and exam-day readiness.',
    icon: GraduationCap,
    accent: '#B6A8E8',
    soft: 'rgba(182,168,232,0.14)',
  },
  {
    id: 'work',
    label: 'Work deadlines',
    short: 'Work',
    blurb: 'High-stakes deliverables, presentations, and reviews.',
    icon: Briefcase,
    accent: '#E8CD9A',
    soft: 'rgba(232,205,154,0.14)',
  },
  {
    id: 'project',
    label: 'Project delivery',
    short: 'Project',
    blurb: 'Ship a build with milestones, QA, and a clean handoff.',
    icon: Layers,
    accent: '#8B6BFF',
    soft: 'rgba(139,107,255,0.14)',
  },
  {
    id: 'birthday',
    label: 'Birthdays',
    short: 'Birthday',
    blurb: 'A day that deserves a beautiful, personal countdown.',
    icon: Cake,
    accent: '#F2A7C3',
    soft: 'rgba(242,167,195,0.14)',
  },
  {
    id: 'wedding',
    label: 'Weddings',
    short: 'Wedding',
    blurb: 'Vendors, fittings, seating, and the final walkthrough.',
    icon: Gem,
    accent: '#EBC7D6',
    soft: 'rgba(235,199,214,0.14)',
  },
  {
    id: 'festival',
    label: 'Festivals & holidays',
    short: 'Festival',
    blurb: 'Traditions, travel, gifts, and gathering the people you love.',
    icon: Sparkles,
    accent: '#F0C27B',
    soft: 'rgba(240,194,123,0.14)',
  },
  {
    id: 'travel',
    label: 'Travel',
    short: 'Travel',
    blurb: 'Documents, bookings, itineraries, and an unhurried departure.',
    icon: Plane,
    accent: '#8FD3D0',
    soft: 'rgba(143,211,208,0.14)',
  },
  {
    id: 'fitness',
    label: 'Fitness goals',
    short: 'Fitness',
    blurb: 'Training blocks, recovery, and measurable progress.',
    icon: Dumbbell,
    accent: '#9FE0B5',
    soft: 'rgba(159,224,181,0.14)',
  },
  {
    id: 'personal',
    label: 'Personal milestones',
    short: 'Personal',
    blurb: 'The promises you make to yourself, made visible.',
    icon: Star,
    accent: '#C9B8F2',
    soft: 'rgba(201,184,242,0.14)',
  },
  {
    id: 'custom',
    label: 'Custom goals',
    short: 'Custom',
    blurb: 'Anything with a date and meaning behind it.',
    icon: Compass,
    accent: '#D8CBB8',
    soft: 'rgba(216,203,184,0.14)',
  },
];

export const categoryOf = (id: CategoryId): CategoryMeta =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

export interface DeviceMeta {
  id: DeviceId;
  label: string;
  detail: string;
  width: number;
  height: number;
  ratio: string;
  family: 'mobile' | 'desktop';
}

export const DEVICES: DeviceMeta[] = [
  { id: 'iphone', label: 'iPhone', detail: '1290 × 2796 · 9:19.5', width: 1290, height: 2796, ratio: '9 / 19.5', family: 'mobile' },
  { id: 'android', label: 'Android', detail: '1080 × 2400 · 9:20', width: 1080, height: 2400, ratio: '9 / 20', family: 'mobile' },
  { id: 'tablet', label: 'Tablet', detail: '2048 × 2732 · 3:4', width: 2048, height: 2732, ratio: '3 / 4', family: 'mobile' },
  { id: 'desktop', label: 'Desktop', detail: '3840 × 2160 · 16:9', width: 3840, height: 2160, ratio: '16 / 9', family: 'desktop' },
  { id: 'laptop', label: 'Laptop', detail: '2560 × 1600 · 16:10', width: 2560, height: 1600, ratio: '16 / 10', family: 'desktop' },
];

export const deviceOf = (id: DeviceId): DeviceMeta =>
  DEVICES.find((d) => d.id === id) ?? DEVICES[0];

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  swatches: string[];
  appearance: 'dark' | 'light';
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'autumn',
    label: 'Autumn Elegance',
    description: 'Etched gold foliage over a warm midnight dusk.',
    swatches: ['#2A1B12', '#6B4A2A', '#C9A15C', '#E8CD9A', '#F5E9D2'],
    appearance: 'dark',
  },
  {
    id: 'glass',
    label: 'Luxury Glassmorphism',
    description: 'Frosted panels, champagne light, quiet depth.',
    swatches: ['#141324', '#3A3360', '#B6A8E8', '#E8CD9A', '#F7F2E7'],
    appearance: 'dark',
  },
  {
    id: 'neon',
    label: 'Midnight Neon',
    description: 'Electric violet and cyan suspended in navy.',
    swatches: ['#05070F', '#1B1B4B', '#8B6BFF', '#65E5FF', '#F0F4FF'],
    appearance: 'dark',
  },
  {
    id: 'minimal',
    label: 'Minimalist Premium',
    description: 'Ivory space, hairline rules, a single luxurious accent.',
    swatches: ['#F4EEE2', '#E2D6C1', '#9C7C43', '#2C2620', '#FFFFFF'],
    appearance: 'light',
  },
  {
    id: 'botanical',
    label: 'Botanical Nature',
    description: 'Deep forest greens with pressed-leaf linework.',
    swatches: ['#0C1A14', '#1E3B2C', '#7FA98B', '#D5C6A8', '#F1EEE4'],
    appearance: 'dark',
  },
  {
    id: 'pastel',
    label: 'Pastel Dreams',
    description: 'Lavender haze, blush light, soft-focus typography.',
    swatches: ['#F4EAF6', '#E8D6F2', '#CBAADB', '#A98BC9', '#FFF9FB'],
    appearance: 'light',
  },
  {
    id: 'cyberpunk',
    label: 'Futuristic Cyberpunk',
    description: 'Magenta horizons, scanlines, and a chrome grid.',
    swatches: ['#070612', '#221046', '#FF3D7F', '#3DE1FF', '#F7F0FF'],
    appearance: 'dark',
  },
  {
    id: 'cinematic',
    label: 'Cinematic Dark',
    description: 'Letterboxed frames, warm amber dust, film grain.',
    swatches: ['#0A0908', '#1C1712', '#6E5033', '#D6A96B', '#F0E3CE'],
    appearance: 'dark',
  },
  {
    id: 'festive',
    label: 'Festive Celebration',
    description: 'Deep plum, gilt confetti, and a joyful glow.',
    swatches: ['#1B0F1E', '#3E1B3C', '#E8CD9A', '#F07B7B', '#FFF6E5'],
    appearance: 'dark',
  },
  {
    id: 'custom',
    label: 'Custom AI Design',
    description: 'Describe a mood, or borrow one from a reference image.',
    swatches: ['#0D1020', '#7C5CFF', '#E8CD9A', '#B6A8E8', '#F7F2E7'],
    appearance: 'dark',
  },
];

export const themeOf = (id: ThemeId): ThemeMeta =>
  THEMES.find((t) => t.id === id) ?? THEMES[0];

export interface PaletteMeta {
  id: PaletteId;
  label: string;
  swatches: string[];
}

export const PALETTES: PaletteMeta[] = [
  { id: 'theme', label: 'Theme default', swatches: ['#E8CD9A', '#B6A8E8', '#7C5CFF'] },
  { id: 'champagne', label: 'Champagne', swatches: ['#F5E6C8', '#E8CD9A', '#B38F55'] },
  { id: 'lavender', label: 'Lavender', swatches: ['#E3DCFF', '#B6A8E8', '#7C5CFF'] },
  { id: 'monochrome', label: 'Monochrome', swatches: ['#FFFFFF', '#BDBDBF', '#6E6E72'] },
  { id: 'rose', label: 'Rose quartz', swatches: ['#FFE7EF', '#F2A7C3', '#C4678D'] },
  { id: 'emerald', label: 'Emerald', swatches: ['#DFF5E7', '#8FD8B4', '#3F8E67'] },
  { id: 'ocean', label: 'Ocean', swatches: ['#E0F4FF', '#8FD3D0', '#3D7FA8'] },
  { id: 'extracted', label: 'From reference', swatches: ['#E8CD9A', '#7C5CFF', '#0D1020'] },
];

export interface TypographyMeta {
  id: TypographyId;
  label: string;
  sample: string;
  family: string;
}

export const TYPOGRAPHIES: TypographyMeta[] = [
  { id: 'editorial', label: 'Editorial serif', sample: 'Chrono', family: 'Fraunces' },
  { id: 'modern', label: 'Modern grotesk', sample: 'Chrono', family: 'Inter' },
  { id: 'tech', label: 'Technical sans', sample: 'Chrono', family: 'Space Grotesk' },
  { id: 'minimal', label: 'Quiet light', sample: 'Chrono', family: 'Inter' },
];

export interface LayoutMeta {
  id: LayoutId;
  label: string;
  hint: string;
}

export const LAYOUTS: LayoutMeta[] = [
  { id: 'stacked', label: 'Stacked', hint: 'Days hero + time beneath' },
  { id: 'inline', label: 'In a row', hint: 'Days · Hours · Minutes' },
  { id: 'ring', label: 'Progress ring', hint: 'Days wrapped in progress' },
];

export const PREP_OPTIONS = [
  { value: 30, label: 'Light', hint: 'about 30 min a day' },
  { value: 60, label: 'Steady', hint: 'about 1 hour a day' },
  { value: 120, label: 'Focused', hint: 'about 2 hours a day' },
  { value: 240, label: 'Intense', hint: '4+ hours a day' },
];

export const REMINDER_LEADS = [
  { value: 0, label: 'At the time' },
  { value: 15, label: '15 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
];

export const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string; rank: number }> = {
  critical: { label: 'Critical', color: '#ff9b9b', bg: 'rgba(255,139,139,0.12)', rank: 0 },
  high: { label: 'High', color: '#f0c27b', bg: 'rgba(240,194,123,0.12)', rank: 1 },
  medium: { label: 'Medium', color: '#b6a8e8', bg: 'rgba(182,168,232,0.12)', rank: 2 },
  low: { label: 'Low', color: '#9fd8b5', bg: 'rgba(159,216,181,0.12)', rank: 3 },
};

export const IMPORTANCE_OPTIONS = [
  {
    value: 'personal' as const,
    label: 'Personal',
    hint: 'Meaningful to you, your people, or your own rhythm.',
  },
  {
    value: 'professional' as const,
    label: 'Professional',
    hint: 'Tied to work, reputation, or a team commitment.',
  },
];
