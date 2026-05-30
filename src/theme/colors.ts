// F12 — Theme palette với token system đầy đủ.
// v3.148 — Refactor sang design token: appBg, surface, text*, border*, nav*, semantic colors, gradients.
//   Backward compat: vẫn export `primary`, `primaryDark`, `primaryLight`, `expense`, `income` cho code cũ.
//   Mới: `tokens.*` và `gradients.*` cho screen migrate sang token-based design system.
export type ThemeKey =
  | 'mint'
  | 'galaxy'
  | 'pride'
  | 'red'
  | 'ocean'
  | 'grape'
  | 'sunset'
  | 'mono';

export interface GradientStop {
  /** Vị trí 0..1 */
  offset: number;
  color: string;
}

export interface ThemeGradient {
  /** Mảng stops, expo-linear-gradient sẽ dùng. */
  stops: GradientStop[];
  /** Hướng (mặc định top-bottom). */
  angle?: number;
}

/** Design token đầy đủ cho 1 theme. Mọi screen nên migrate sang dùng các key này. */
export interface ThemeTokens {
  // Layer surfaces
  appBg: string;
  surface: string;
  surfaceElevated: string;
  surfaceSoft: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Primary
  primary: string;
  primarySoft: string;
  primaryHover: string;
  primaryText: string;

  // Accent (theme-specific contrast)
  accent: string;
  accentSoft: string;

  // Lines
  border: string;
  divider: string;

  // Input
  inputBg: string;
  inputBorder: string;
  inputFocus: string;

  // Tab/Nav
  navBg: string;
  navActive: string;
  navInactive: string;

  // Semantic
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;

  // Finance semantic (map theo theme nhưng giữ ngữ nghĩa thu/chi)
  income: string;
  incomeSoft: string;
  expense: string;
  expenseSoft: string;

  // Overlay/shadow
  shadow: string;
  overlay: string;
}

/** Palette type (backward compat). Mọi screen cũ vẫn đọc primary/primaryDark/primaryLight/expense/income. */
export interface Palette {
  key: ThemeKey;
  label: string;
  description: string;
  isPremium: boolean;
  previewColors: [string, string, string];

  // Legacy (giữ để không phá screen hiện tại)
  primary: string;
  primaryDark: string;
  primaryLight: string;
  expense: string;
  income: string;

  // v3.148 — Design tokens
  tokens: ThemeTokens;
  /** Gradient cho hero/premium cards (optional, dùng nếu screen support). */
  gradients?: {
    primary?: ThemeGradient;
    hero?: ThemeGradient;
    premium?: ThemeGradient;
  };
}

// Helpers build theme — giảm boilerplate
function buildLightTheme(p: {
  key: ThemeKey;
  label: string;
  description: string;
  isPremium: boolean;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  preview: [string, string, string];
  income?: string;
  expense?: string;
  gradients?: Palette['gradients'];
}): Palette {
  const income = p.income ?? '#10b981';
  const expense = p.expense ?? '#ef4444';
  return {
    key: p.key,
    label: p.label,
    description: p.description,
    isPremium: p.isPremium,
    previewColors: p.preview,
    primary: p.primary,
    primaryDark: p.primaryDark,
    primaryLight: p.primaryLight,
    income,
    expense,
    tokens: {
      appBg: '#ffffff',
      surface: '#ffffff',
      surfaceElevated: '#fafbfd',
      surfaceSoft: '#f3f4f6',

      textPrimary: '#111827',
      textSecondary: '#374151',
      textMuted: '#6b7280',
      textInverse: '#ffffff',

      primary: p.primary,
      primarySoft: p.primaryLight,
      primaryHover: p.primaryDark,
      primaryText: '#ffffff',

      accent: p.accent,
      accentSoft: p.primaryLight,

      border: '#eef0f4',
      divider: '#f3f4f6',

      inputBg: '#fafbfd',
      inputBorder: '#e5e7eb',
      inputFocus: p.primary,

      navBg: '#ffffff',
      navActive: p.primary,
      navInactive: '#9ca3af',

      success: '#10b981',
      successSoft: '#ecfdf5',
      danger: '#dc2626',
      dangerSoft: '#fef2f2',
      warning: '#f59e0b',
      warningSoft: '#fffbeb',
      info: '#0ea5e9',
      infoSoft: '#f0f9ff',

      income,
      incomeSoft: '#ecfdf5',
      expense,
      expenseSoft: '#fef2f2',

      shadow: 'rgba(15, 23, 42, 0.08)',
      overlay: 'rgba(0, 0, 0, 0.5)',
    },
    gradients: p.gradients,
  };
}

export const PALETTES: Palette[] = [
  // ─── FREE ───
  buildLightTheme({
    key: 'mint',
    label: 'Mặc định',
    description: 'Giao diện cân bằng, dễ đọc.',
    isPremium: false,
    primary: '#10b981',
    primaryDark: '#059669',
    primaryLight: '#ecfdf5',
    accent: '#06b6d4',
    preview: ['#10b981', '#ecfdf5', '#06b6d4'],
  }),

  // ─── PREMIUM ───
  // Galaxy — tím deep với gradient hero
  {
    ...buildLightTheme({
      key: 'galaxy',
      label: 'Galaxy',
      description: 'Tím deep với điểm nhấn cyan, sang trọng và hiện đại.',
      isPremium: true,
      primary: '#7c3aed',
      primaryDark: '#5b21b6',
      primaryLight: '#f5f3ff',
      accent: '#06b6d4',
      preview: ['#7c3aed', '#3b0764', '#06b6d4'],
      income: '#10b981',
      expense: '#f43f5e',
    }),
    gradients: {
      primary: {
        angle: 135,
        stops: [
          { offset: 0, color: '#7c3aed' },
          { offset: 1, color: '#3b0764' },
        ],
      },
      hero: {
        angle: 135,
        stops: [
          { offset: 0, color: '#0f0a3d' },
          { offset: 0.5, color: '#3b0764' },
          { offset: 1, color: '#06b6d4' },
        ],
      },
      premium: {
        angle: 135,
        stops: [
          { offset: 0, color: '#7c3aed' },
          { offset: 1, color: '#06b6d4' },
        ],
      },
    },
  },
  // Tự hào — Pride inspired, tinh tế không lòe loẹt
  {
    ...buildLightTheme({
      key: 'pride',
      label: 'Tự hào',
      description: 'Cảm hứng từ sắc cầu vồng, ấm áp và bao dung.',
      isPremium: true,
      primary: '#e11d48',
      primaryDark: '#9f1239',
      primaryLight: '#fff1f2',
      accent: '#8b5cf6',
      preview: ['#e11d48', '#f59e0b', '#8b5cf6'],
      income: '#10b981',
      expense: '#e11d48',
    }),
    gradients: {
      primary: {
        angle: 135,
        stops: [
          { offset: 0, color: '#e11d48' },
          { offset: 1, color: '#8b5cf6' },
        ],
      },
      hero: {
        // 6 màu cầu vồng giảm độ bão hoà để không gắt
        angle: 90,
        stops: [
          { offset: 0, color: '#e11d48' },
          { offset: 0.2, color: '#f59e0b' },
          { offset: 0.4, color: '#facc15' },
          { offset: 0.6, color: '#10b981' },
          { offset: 0.8, color: '#0ea5e9' },
          { offset: 1, color: '#8b5cf6' },
        ],
      },
      premium: {
        angle: 135,
        stops: [
          { offset: 0, color: '#e11d48' },
          { offset: 0.5, color: '#f59e0b' },
          { offset: 1, color: '#8b5cf6' },
        ],
      },
    },
  },
  buildLightTheme({
    key: 'red',
    label: 'Đỏ Sài Gòn',
    description: 'Tông đỏ ấm, mang nhận diện thương hiệu.',
    isPremium: true,
    primary: '#d60000',
    primaryDark: '#8b0000',
    primaryLight: '#fff1f1',
    accent: '#f59e0b',
    preview: ['#d60000', '#8b0000', '#f59e0b'],
    expense: '#d60000',
  }),
  buildLightTheme({
    key: 'ocean',
    label: 'Ocean',
    description: 'Xanh dịu, sạch và tập trung.',
    isPremium: true,
    primary: '#0ea5e9',
    primaryDark: '#0284c7',
    primaryLight: '#f0f9ff',
    accent: '#06b6d4',
    preview: ['#0ea5e9', '#0284c7', '#06b6d4'],
  }),
  buildLightTheme({
    key: 'grape',
    label: 'Grape',
    description: 'Tím nho thanh lịch, hiện đại.',
    isPremium: true,
    primary: '#a855f7',
    primaryDark: '#9333ea',
    primaryLight: '#faf5ff',
    accent: '#ec4899',
    preview: ['#a855f7', '#9333ea', '#ec4899'],
    expense: '#ec4899',
  }),
  buildLightTheme({
    key: 'sunset',
    label: 'Sunset',
    description: 'Cam ấm như hoàng hôn.',
    isPremium: true,
    primary: '#f97316',
    primaryDark: '#ea580c',
    primaryLight: '#fff7ed',
    accent: '#fbbf24',
    preview: ['#f97316', '#ea580c', '#fbbf24'],
    expense: '#dc2626',
  }),
  buildLightTheme({
    key: 'mono',
    label: 'Mono',
    description: 'Xám trầm, tối giản, ít gây phân tâm.',
    isPremium: true,
    primary: '#374151',
    primaryDark: '#1f2937',
    primaryLight: '#f3f4f6',
    accent: '#6b7280',
    preview: ['#374151', '#1f2937', '#6b7280'],
  }),
];

export const DEFAULT_PALETTE_KEY: ThemeKey = 'mint';

export function getPalette(key: string | undefined): Palette {
  return PALETTES.find((p) => p.key === key) || PALETTES[0];
}

/** True nếu user có quyền dùng theme này. */
export function canUseTheme(themeKey: string, tier: 'free' | 'pro'): boolean {
  const p = PALETTES.find((x) => x.key === themeKey);
  if (!p) return true;
  if (!p.isPremium) return true;
  return tier === 'pro';
}
