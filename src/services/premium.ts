// v3.125 — Premium tier limits + entitlement check.
// Phase 1.5: lưu metadata (package, activated_at, expires_at) qua settings.
// Phase 2: integrate RevenueCat.

export type PremiumTier = 'free' | 'pro';
export type PremiumPackage = 'monthly' | 'yearly' | 'lifetime';

// v1.0 phát hành sớm: mở khoá toàn bộ tính năng cho mọi user, ẩn paywall.
// Phase 2 (wire RevenueCat): đặt false để paywall + mua gói hoạt động lại.
export const FREE_ONLY_RELEASE = true;

export type PremiumEntity =
  | 'books'
  | 'wallets'
  | 'goals'
  | 'bills'
  | 'recurring';

export type PremiumFeature =
  | 'autoSavings'
  | 'allThemes'
  | 'personaShare'
  | 'fullInsights';

/** Giới hạn free tier theo entity. */
export const FREE_LIMITS: Record<PremiumEntity, number> = {
  books: 1,
  wallets: 5,
  goals: 3,
  bills: 3,
  recurring: 3,
};

/** Pricing options (VND). */
export const PREMIUM_PRICING: Record<PremiumPackage, { price: number; label: string; sub: string; days: number | null }> = {
  monthly: { price: 39_000, label: 'Hàng tháng', sub: '39.000đ/tháng', days: 30 },
  yearly: { price: 299_000, label: 'Hàng năm', sub: '299.000đ/năm (tiết kiệm 38%)', days: 365 },
  lifetime: { price: 699_000, label: 'Trọn đời', sub: 'Mua 1 lần, dùng mãi', days: null },
};

export interface PremiumState {
  tier: PremiumTier;
  package: PremiumPackage | null;
  activatedAt: string | null; // ISO date YYYY-MM-DD
  expiresAt: string | null;   // ISO date hoặc null = lifetime
  isLifetime: boolean;
  isExpired: boolean;
  daysLeft: number | null;     // null = lifetime hoặc not pro
  earlyAccess: boolean;        // true = mở khoá do bản phát hành sớm (chưa mua), không phải gói trả phí
}

/** Parse premium state từ settings KV. */
export function parsePremiumState(settings: Record<string, string>): PremiumState {
  // v1.0 phát hành sớm: mọi user được mở khoá toàn bộ tính năng (tier='pro'),
  //   nhưng đánh dấu earlyAccess để UI hiển thị "miễn phí" thay vì gói trả phí.
  if (FREE_ONLY_RELEASE) {
    return {
      tier: 'pro',
      package: null,
      activatedAt: null,
      expiresAt: null,
      isLifetime: false,
      isExpired: false,
      daysLeft: null,
      earlyAccess: true,
    };
  }
  const isPro = settings.is_pro === '1';
  if (!isPro) {
    return {
      tier: 'free',
      package: null,
      activatedAt: null,
      expiresAt: null,
      isLifetime: false,
      isExpired: false,
      daysLeft: null,
      earlyAccess: false,
    };
  }
  const pkg = (settings.pro_package || 'lifetime') as PremiumPackage;
  const activatedAt = settings.pro_activated_at || null;
  const expiresAt = settings.pro_expires_at || null;
  // v3.146 — Fail-safe: nếu package monthly/yearly nhưng expiresAt thiếu (corrupt state),
  //   coi như đã hết hạn về free thay vì cho dùng vĩnh viễn (bug security/finance).
  if (pkg !== 'lifetime' && !expiresAt) {
    return {
      tier: 'free',
      package: null,
      activatedAt,
      expiresAt: null,
      isLifetime: false,
      isExpired: true,
      daysLeft: null,
      earlyAccess: false,
    };
  }
  const isLifetime = pkg === 'lifetime';
  let isExpired = false;
  let daysLeft: number | null = null;
  if (!isLifetime && expiresAt) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiresAt);
    exp.setHours(0, 0, 0, 0);
    const diff = Math.ceil((exp.getTime() - today.getTime()) / 86_400_000);
    daysLeft = diff;
    isExpired = diff < 0;
  }
  return {
    tier: isExpired ? 'free' : 'pro',
    package: pkg,
    activatedAt,
    expiresAt,
    isLifetime,
    isExpired,
    daysLeft,
    earlyAccess: false,
  };
}

/** Tính expires_at từ package + activated_at (YYYY-MM-DD). */
export function computeExpiresAt(pkg: PremiumPackage, activatedAt: string): string | null {
  const days = PREMIUM_PRICING[pkg].days;
  if (days === null) return null;
  const d = new Date(activatedAt);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Check user còn tạo được entity mới không. */
export function canCreate(
  entity: PremiumEntity,
  currentCount: number,
  tier: PremiumTier
): { allowed: boolean; remaining: number; limit: number } {
  if (tier === 'pro') {
    return { allowed: true, remaining: Infinity, limit: Infinity };
  }
  const limit = FREE_LIMITS[entity];
  const remaining = Math.max(0, limit - currentCount);
  return { allowed: currentCount < limit, remaining, limit };
}

/** Check user có dùng được feature Pro không. */
export function hasFeature(feature: PremiumFeature, tier: PremiumTier): boolean {
  if (tier === 'pro') return true;
  void feature;
  return false;
}

/** Vietnamese label cho gói. */
export function packageLabel(pkg: PremiumPackage | null): string {
  if (!pkg) return '—';
  return PREMIUM_PRICING[pkg].label;
}
