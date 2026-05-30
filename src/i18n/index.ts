// i18n đơn giản — không dùng i18next vì app nhỏ + offline.
// Lookup `t('key')` qua bảng dictionary.
import { vi } from './vi';
import { en } from './en';
import { zh } from './zh';

export type Locale = 'vi' | 'en' | 'zh';
export type TranslationKey = keyof typeof vi;

const DICTS: Record<Locale, Record<string, string>> = { vi, en, zh };

let currentLocale: Locale = 'vi';

export function setLocale(l: Locale) {
  currentLocale = l;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function parseLocale(raw: string | undefined): Locale {
  if (raw === 'en') return 'en';
  if (raw === 'zh') return 'zh';
  return 'vi';
}

/**
 * t(key) → trả về string đã dịch theo locale hiện tại.
 * Fallback: nếu key thiếu trong locale hiện tại → dùng tiếng Việt.
 * Nếu cũng thiếu trong tiếng Việt → trả về key.
 *
 * Hỗ trợ interpolation: t('greeting', { name: 'Bux2' }) với 'greeting' = 'Xin chào {name}'
 */
export function t(key: TranslationKey | string, vars?: Record<string, string | number>): string {
  const dict = DICTS[currentLocale];
  let str = dict?.[key] ?? vi[key as TranslationKey] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}

export const AVAILABLE_LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
];
