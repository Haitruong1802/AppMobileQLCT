// Hook unified: subscribe locale từ Zustand store + sync NGAY trong render + return t().
// Bug fix v3.18→v3.19: useEffect chạy sau render → t() đọc locale cũ → user phải thoát app mới đổi.
// Fix: setLocale gọi inline trong render (an toàn vì là module-level state, không trigger React).
import { useStore } from '../store/useStore';
import { setLocale, t as tRaw, parseLocale, Locale } from './index';

/** Trả về function t() đã sync với locale hiện tại từ store. */
export function useT() {
  const localeRaw = useStore((s) => s.settings.locale);
  const locale: Locale = parseLocale(localeRaw);
  setLocale(locale); // Sync ngay trong render — t() đọc locale mới
  return tRaw;
}

/** Trả về locale hiện tại (subscribe store). */
export function useCurrentLocale(): Locale {
  const localeRaw = useStore((s) => s.settings.locale);
  return parseLocale(localeRaw);
}
