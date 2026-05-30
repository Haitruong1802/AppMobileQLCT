import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { vi, enUS, zhCN } from 'date-fns/locale';
import { getLocale } from '../i18n';

const DATE_LOCALES = { vi, en: enUS, zh: zhCN } as const;

export function formatDate(d: Date | string, fmt = 'dd/MM/yyyy'): string {
  const date = typeof d === 'string' ? parseISO(d) : d;
  const dfLocale = DATE_LOCALES[getLocale()] ?? vi;
  return format(date, fmt, { locale: dfLocale });
}

/** v3.63 — Dùng LOCAL date thay vì UTC.
 *  Trước: `toISOString()` trả UTC → sau 17:00 VN (UTC+7) → trả ngày mai → store guard throw "ngày tương lai" → user KHÔNG ghi được TX cuối ngày. */
export function todayISO(): string {
  return localDateISO(new Date());
}

/** v3.146 — Format Date object thành YYYY-MM-DD theo LOCAL timezone (không phải UTC). */
export function localDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthRange(d: Date) {
  return {
    start: format(startOfMonth(d), 'yyyy-MM-dd'),
    end: format(endOfMonth(d), 'yyyy-MM-dd'),
  };
}

/** Format header tháng theo locale: vi "Tháng MM/YYYY" · en "MMMM yyyy" · zh "yyyy年MM月". */
export function formatMonth(monthStr: string): string {
  // monthStr = "2026-05"
  const [y, m] = monthStr.split('-');
  const locale = getLocale();
  if (locale === 'en') {
    const date = parseISO(`${monthStr}-01`);
    return format(date, 'MMMM yyyy', { locale: enUS });
  }
  if (locale === 'zh') {
    return `${y}年${m}月`;
  }
  return `Tháng ${m}/${y}`;
}
