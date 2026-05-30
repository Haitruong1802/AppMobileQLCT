// v3.120 — Magic numbers / strings dùng chung. Đưa lên đây để dễ tune sau.

// ── Form input debounce ──
/** Smart category suggestion debounce sau mỗi keystroke ở Tab Nhập. */
export const NOTE_SUGGEST_DEBOUNCE_MS = 350;
/** Search debounce ở Tab Lịch (đang chưa apply, planned cho v3.121). */
export const SEARCH_DEBOUNCE_MS = 300;

// ── Cool-down (F9) ──
/** Ngưỡng default trigger CoolDownModal khi chi expense >= threshold (đ). */
export const DEFAULT_COOLDOWN_THRESHOLD = 200_000;
/** Số giây countdown trước khi cho phép confirm "Vẫn ghi". */
export const COOLDOWN_SECONDS = 3;

// ── Recurring rules ──
/** Tối đa số kỳ overdue 1 rule có thể fire trong 1 lần boot (chống loop). */
export const RECURRING_MAX_OVERDUE_CYCLES = 36;

// ── Notifications ──
/** Cache TTL list scheduled notifications (chống gọi API expo liên tục). */
export const NOTIF_SCHEDULED_CACHE_MS = 5_000;

// ── Toast ──
/** Toast tự dismiss sau N ms. */
export const TOAST_DISMISS_MS = 2_500;

// ── Lock / auto-lock ──
/** Sau bao lâu rời nền background thì khoá app lại (ms). */
export const BG_LOCK_THRESHOLD_MS = 5 * 60 * 1000;

// ── Active savings ──
/** Threshold rounding cho daily allocation (10k VND). */
export const DAILY_ALLOC_THRESHOLD = 10_000;
