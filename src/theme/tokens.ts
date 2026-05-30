// Design tokens — KHÔNG có AI/API gì. Chỉ là constant số liệu cho UI.
// Dùng `SPACING.lg` thay vì `16` rải khắp file → đổi 1 chỗ là cả app update.

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const FONT_SIZE = {
  tiny: 10,
  caption: 11, // section header uppercase, hint nhỏ
  small: 12, // sub text, description
  body: 13, // body default
  bodyLg: 15, // primary list item, button text
  title: 17, // screen title, modal title
  titleLg: 20, // section title lớn
  hero: 28, // big amount safe-to-spend
  display: 44, // huge number (streak hero)
} as const;

export const FONT_WEIGHT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

export const RADIUS = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 18,
  full: 9999,
} as const;

/** Màu semantic — DÙNG CHO TOÀN APP để consistent. */
export const SEMANTIC = {
  success: { bg: '#dcfce7', tint: '#bbf7d0', fg: '#16a34a', text: '#065f46' },
  warning: { bg: '#fef3c7', tint: '#fde68a', fg: '#d97706', text: '#92400e' },
  danger: { bg: '#fee2e2', tint: '#fca5a5', fg: '#dc2626', text: '#991b1b' },
  info: { bg: '#dbeafe', tint: '#93c5fd', fg: '#2563eb', text: '#1e3a8a' },
  muted: { bg: '#f3f4f6', tint: '#e5e7eb', fg: '#6b7280', text: '#374151' },
} as const;

/** Màu xám chuẩn (thay cho hardcode #9ca3af, #6b7280 rải rác). */
export const GRAY = {
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#111827',
} as const;

/** Shadow preset native iOS/Android. */
export const SHADOW = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
} as const;
