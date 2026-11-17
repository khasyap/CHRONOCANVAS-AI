export type CategoryId =
  | 'exams'
  | 'work'
  | 'project'
  | 'birthday'
  | 'wedding'
  | 'festival'
  | 'travel'
  | 'fitness'
  | 'personal'
  | 'custom';

export type Importance = 'personal' | 'professional';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type DeviceId = 'iphone' | 'android' | 'tablet' | 'desktop' | 'laptop';

export type ThemeId =
  | 'autumn'
  | 'glass'
  | 'neon'
  | 'minimal'
  | 'botanical'
  | 'pastel'
  | 'cyberpunk'
  | 'cinematic'
  | 'festive'
  | 'custom';

export type PaletteId =
  | 'theme'
  | 'champagne'
  | 'lavender'
  | 'monochrome'
  | 'rose'
  | 'emerald'
  | 'ocean'
  | 'extracted';

export type TypographyId = 'editorial' | 'modern' | 'tech' | 'minimal';

export type LayoutId = 'stacked' | 'inline' | 'ring';

export type MilestonePlacement = 'top' | 'bottom' | 'none';

export type Appearance = 'dark' | 'light';

export interface GoalPlanMeta {
  summary: string;
  rationale?: string;
  questions?: string[];
  answers?: string[];
  generatedBy: 'ai' | 'local';
  generatedAt: string;
}

export interface GoalCapsule {
  /** A private letter to the version of you who reaches the deadline. */
  message: string;
  createdAt: string;
  updatedAt: string;
  /** Set when the letter is locked. The message stays hidden until the deadline. */
  sealedAt: string;
  openedAt?: string;
}

export interface Goal {
  id: string;
  name: string;
  deadline: string;
  category: CategoryId;
  importance: Importance;
  /** Estimated available preparation time in minutes per day. */
  prepMinutes: number;
  reminderTime: string;
  device: DeviceId;
  notes: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  achievedAt?: string;
  plan?: GoalPlanMeta;
  capsule?: GoalCapsule;
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  description: string;
  date: string;
  offsetDays: number;
  priority: Priority;
  duration: number;
  done: boolean;
  completedAt?: string;
  reminderEnabled: boolean;
  reminderLead: number;
  order: number;
  generatedBy: 'ai' | 'local' | 'user';
}

export interface ExtractedPalette {
  accent: string;
  secondary: string;
  background: string;
  muted: string;
}

export interface WallpaperSpec {
  theme: ThemeId;
  palette: PaletteId;
  typography: TypographyId;
  layout: LayoutId;
  milestonePlacement: MilestonePlacement;
  decorations: boolean;
  clockSafe: boolean;
  appearance: Appearance;
  /** 0 = fully opaque, 100 = maximum glass transparency. */
  transparency: number;
  showBranding: boolean;
  showProgress: boolean;
  goalIds: string[];
  backgroundImage?: string | null;
  prompt?: string;
  extracted?: ExtractedPalette | null;
}

export interface Design {
  id: string;
  name: string;
  goalId: string;
  device: DeviceId;
  width: number;
  height: number;
  spec: WallpaperSpec;
  thumbnail: string;
  createdAt: string;
  source: 'studio' | 'ai' | 'reference';
}

export type LogKind = 'daily' | 'milestone' | 'overdue' | 'deadline' | 'system';

export interface NotificationEntry {
  id: string;
  kind: LogKind;
  title: string;
  body: string;
  createdAt: string;
  goalId?: string;
  read: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  daily: boolean;
  dailyTime: string;
  milestoneReminders: boolean;
  milestoneLead: number;
  overdue: boolean;
  deadlineAlerts: boolean;
  frequency: 'gentle' | 'balanced' | 'persistent';
  paused: boolean;
  quietStart: string;
  quietEnd: string;
}

export interface AISettings {
  apiKey: string;
  textModel: string;
  imageModel: string;
}

export interface Settings {
  mode: 'dark' | 'light';
  ai: AISettings;
  notifications: NotificationSettings;
  weekStartsOn: 0 | 1;
  defaultDevice: DeviceId;
  reduceMotion: boolean;
}

export interface Workspace {
  goals: Goal[];
  milestones: Milestone[];
  designs: Design[];
  log: NotificationEntry[];
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  avatarHue: number;
}

export interface StoredUser extends Profile {
  passwordHash: string;
  salt: string;
}

export interface GeneratedMilestone {
  offsetDays: number;
  title: string;
  description: string;
  priority: Priority;
  duration: number;
  reminderEnabled: boolean;
  reminderLead: number;
}

export interface PlanDraft {
  summary: string;
  rationale: string;
  questions: string[];
  milestones: GeneratedMilestone[];
  generatedBy: 'ai' | 'local';
}

export interface CoachPlan {
  headline: string;
  body: string;
  tip: string;
  priorities: { milestoneId: string; label: string; why: string }[];
  generatedBy: 'ai' | 'local';
}

export interface CountdownParts {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
  isToday: boolean;
}

export type ToastTone = 'default' | 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}
