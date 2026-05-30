// v3.125 — Premium tier state. Phase 1.5 lưu metadata qua settings.
import { useStore } from './useStore';
import { PremiumPackage, PremiumState, PremiumTier, computeExpiresAt, parsePremiumState } from '../services/premium';

/** Hook return full Pro state (tier + package + expires + daysLeft). */
export function usePremiumState(): PremiumState {
  const settings = useStore((s) => s.settings);
  return parsePremiumState(settings);
}

/** Hook tiện return chỉ tier. */
export function usePremiumTier(): PremiumTier {
  return usePremiumState().tier;
}

/** Phase 1 mock: activate Pro package + lưu metadata. Phase 2 swap RevenueCat. */
export async function activatePremium(pkg: PremiumPackage): Promise<void> {
  const store = useStore.getState();
  const today = new Date().toISOString().slice(0, 10);
  const expires = computeExpiresAt(pkg, today);
  await store.updateSetting('is_pro', '1');
  await store.updateSetting('pro_package', pkg);
  await store.updateSetting('pro_activated_at', today);
  await store.updateSetting('pro_expires_at', expires || '');
}

/** Reset về free (DEV / sau khi expired). Giữ nguyên user toggle choice. */
export async function deactivatePremium(): Promise<void> {
  const store = useStore.getState();
  await store.updateSetting('is_pro', '0');
  await store.updateSetting('pro_package', '');
  await store.updateSetting('pro_activated_at', '');
  await store.updateSetting('pro_expires_at', '');
  // v3.146 — KHÔNG reset savings_auto_enabled. User choice giữ nguyên,
  //   nếu mua lại Pro thì toggle vẫn ON như user đã chọn. Service runDailyAllocation
  //   đã defense-check tier nên Free user không bị chạy allocation.
  // Theme Mint là free, downgrade về Mint nếu đang dùng theme Pro để UI không glitch.
  const theme = store.settings.theme;
  if (theme && theme !== 'mint') {
    await store.updateSetting('theme', 'mint');
  }
}

/** Legacy alias. */
export async function setPremiumTier(tier: PremiumTier): Promise<void> {
  if (tier === 'free') {
    await deactivatePremium();
  } else {
    await activatePremium('lifetime');
  }
}

export type RestoreReason = 'iap-not-configured' | 'no-purchase' | 'network-error' | 'restored';

export interface RestoreResult {
  ok: boolean;
  reason: RestoreReason;
  message: string;
}

/**
 * v3.150 — Placeholder cho restore Pro purchase từ App Store / Google Play.
 *
 *   TRẠNG THÁI HIỆN TẠI: app chưa tích hợp Apple StoreKit / Google Play Billing.
 *   Pro entitlement đang lưu trong settings table (local DB), nên user mất máy
 *   hoặc cài lại app sẽ mất Pro nếu không có file sao lưu.
 *
 *   GIẢI PHÁP TẠM THỜI:
 *   - User đã mua Pro nên xuất file sao lưu (.bux2bak) trước khi mất/đổi máy.
 *   - Cài lại app → vào Settings → Khôi phục từ file → entitlement Pro được khôi phục.
 *
 *   ROADMAP PRODUCTION:
 *   - Tích hợp RevenueCat (recommended) hoặc tự wire StoreKit + Google Billing.
 *   - Thay nội dung function này bằng `Purchases.restorePurchases()` (RevenueCat).
 *   - Verify receipt với store + cập nhật entitlement.
 *   - Không tự bật bất kỳ tính năng nào sau restore (chỉ mở quyền).
 */
export async function restorePremium(): Promise<RestoreResult> {
  return {
    ok: false,
    reason: 'iap-not-configured',
    message:
      'Tính năng khôi phục giao dịch mua đang trong giai đoạn phát triển. Khi app phát hành chính thức trên App Store / Google Play, bạn sẽ khôi phục được quyền Pro qua tài khoản Apple ID / Google của mình.',
  };
}
