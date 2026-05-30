// Hook đọc theme hiện tại từ settings store, có fallback an toàn nếu user mất quyền Premium.
// v3.147 — Nếu setting theme là Premium nhưng user tier='free' → fallback mặc định
//   để UI không bị stuck màu cao cấp khi expire.
import { useStore } from './useStore';
import { getPalette, canUseTheme, Palette, DEFAULT_PALETTE_KEY } from '../theme/colors';
import { parsePremiumState } from '../services/premium';

export function useTheme(): Palette {
  const settings = useStore((s) => s.settings);
  const themeKey = settings.theme;
  const tier = parsePremiumState(settings).tier;
  if (themeKey && canUseTheme(themeKey, tier)) {
    return getPalette(themeKey);
  }
  return getPalette(DEFAULT_PALETTE_KEY);
}
