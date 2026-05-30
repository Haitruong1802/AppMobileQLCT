// Legacy hook — giữ alias cho code đã có. Nội bộ dùng useCurrentLocale + sync trong render.
import { useStore } from '../store/useStore';
import { setLocale, parseLocale, Locale } from './index';

export function useLocale(): Locale {
  const localeRaw = useStore((s) => s.settings.locale);
  const locale: Locale = parseLocale(localeRaw);
  setLocale(locale); // Sync inline trong render — fix bug "phải thoát app mới đổi"
  return locale;
}
