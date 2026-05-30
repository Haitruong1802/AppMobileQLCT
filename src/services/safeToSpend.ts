// F10 — Số dư an toàn hôm nay (Safe-to-spend).
// Default mode: chia đều ngân sách CÒN LẠI cho số ngày tới cuối tháng.
// Salary cycle mode: nếu user bật, tính theo CHU KỲ LƯƠNG (mặc định 30 ngày từ ngày nhận lương).
// 100% local, không động data ngoài app.
import { Transaction, Bill } from '../db';

export type SafeToSpendResult = {
  /** Số tiền tối đa user có thể xài hôm nay (TỔNG quota ngày), ĐÃ LÀM TRÒN xuống bội 10k/5k/1k. null nếu chưa đủ data. */
  safeAmount: number | null;
  /** Số raw trước làm tròn (để tính rounding remainder vào active savings). */
  safeAmountRaw: number | null;
  /** v3.93 — Số đã chi trong NGÀY HÔM NAY (theo t.date === today). */
  todayExpense: number;
  /** v3.93 — Số còn có thể xài thêm HÔM NAY = max(0, safeAmount - todayExpense). null nếu safeAmount null. */
  safeRemainingToday: number | null;
  /** v3.96 — Quota dự kiến NGÀY MAI = remainingBudget / (daysRemaining-1), làm tròn. null nếu hết kỳ. */
  tomorrowAmount: number | null;
  /** Tổng số dư còn lại tới mốc kế tiếp (income - expense - pendingBills). */
  remainingBudget: number;
  /** Số ngày còn lại (bao gồm hôm nay). */
  daysRemaining: number;
  /** Tổng thu trong chu kỳ hiện tại. */
  monthIncome: number;
  /** Tổng chi đã phát sinh trong chu kỳ hiện tại. */
  monthExpense: number;
  /** Tổng bill chưa thanh toán, due trong chu kỳ. */
  pendingBills: number;
  /** True nếu chi đã > thu trong chu kỳ. */
  isOverspending: boolean;
  /** Mô tả phạm vi tính: "tháng này" hoặc "chu kỳ lương từ 10/05 → 09/06". */
  rangeLabel: string;
  /** True nếu đang chạy chế độ chu kỳ lương. */
  isCycleMode: boolean;
};

/**
 * Làm tròn xuống safe-to-spend cho user nhìn số đẹp.
 * Bội 10k cho ≥100k, bội 5k cho 10k-100k, bội 1k cho <10k.
 * Phần dư = raw - rounded chuyển vào Active Savings (v3.23).
 */
export function roundSafe(n: number): number {
  if (n >= 100_000) return Math.floor(n / 10_000) * 10_000;
  if (n >= 10_000) return Math.floor(n / 5_000) * 5_000;
  return Math.floor(n / 1_000) * 1_000;
}

/**
 * monthly = lương trả CÙNG NGÀY hàng tháng (10/5 → 10/6). Default cho VP/cố định.
 * days = lương trả MỖI N NGÀY (10/5 → 25/5 nếu N=15). Cho freelance / chu kỳ không trùng tháng.
 */
export type SalaryCycleType = 'monthly' | 'days';

export type SalaryCycleConfig = {
  enabled: boolean;
  payday: number; // 1-31, dùng cho cả 2 type (làm seed last_payday)
  cycleType: SalaryCycleType;
  cycleDays: number; // dùng khi cycleType === 'days'
};

export const DEFAULT_SALARY_CYCLE: SalaryCycleConfig = {
  enabled: false,
  payday: 10,
  cycleType: 'monthly',
  cycleDays: 15,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fmtShort(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

/** Trả last_payday gần nhất <= today, dựa payday-of-month config. */
function lastPaydayBefore(today: Date, payday: number): Date {
  // Clamp payday vào số ngày tháng đó
  const daysInThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const thisMonthPaydayDay = Math.min(payday, daysInThisMonth);
  const thisMonthPayday = new Date(today.getFullYear(), today.getMonth(), thisMonthPaydayDay);
  if (thisMonthPayday <= today) {
    return thisMonthPayday;
  }
  // Chưa tới payday tháng này → lấy payday tháng trước
  const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const daysInPrev = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
  const prevPaydayDay = Math.min(payday, daysInPrev);
  return new Date(prev.getFullYear(), prev.getMonth(), prevPaydayDay);
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** Cùng ngày của tháng kế tiếp. Nếu tháng đó không có ngày này (vd 31/2) → ngày cuối tháng. */
function sameDayNextMonth(d: Date): Date {
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const nextY = m === 11 ? y + 1 : y;
  const nextM = m === 11 ? 0 : m + 1;
  const daysInNext = new Date(nextY, nextM + 1, 0).getDate();
  return new Date(nextY, nextM, Math.min(day, daysInNext));
}

/** Tính next_payday từ last_payday theo config. */
function computeNextPayday(lastPayday: Date, config: SalaryCycleConfig): Date {
  if (config.cycleType === 'monthly') {
    return sameDayNextMonth(lastPayday);
  }
  return addDays(lastPayday, config.cycleDays);
}

/** Số ngày giữa 2 date (b - a) — không tính giờ phút. */
function daysBetween(a: Date, b: Date): number {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

// v3.103 — Fix MEDIUM #5: Snapshot safeAmount initial của hôm nay cache in-memory.
//   Lần đầu compute trong ngày → save vào cache. Các lần sau cùng date → dùng cached.
//   Tránh safeAmount thay đổi khi user xoá TX cũ giữa ngày (state expense thay đổi → recompute giảm).
//   Cache reset khi: kill app reopen (acceptable), hoặc qua ngày mới.
const _safeAmountCache = new Map<string, { remainingBeforeToday: number; daysRemaining: number }>();

export function computeSafeToSpend(
  transactions: Transaction[],
  bills: Bill[],
  today: Date = new Date(),
  cycleConfig: SalaryCycleConfig = DEFAULT_SALARY_CYCLE
): SafeToSpendResult {
  // v3.93 — Tính todayExpense chung cho cả 2 mode (đã chi trong ngày hôm nay)
  const todayDateStr = fmtDate(today);
  let todayExpense = 0;
  for (const t of transactions) {
    if (t.type === 'expense' && t.date === todayDateStr) {
      todayExpense += t.amount;
    }
  }
  const remainingFromSafe = (safeAmt: number | null): number | null =>
    safeAmt === null ? null : Math.max(0, safeAmt - todayExpense);
  // v3.98 — Tomorrow = (remaining sau today) / (daysAfterToday). Đến cuối kỳ → null.
  //   `remainingBudget` đã trừ tất cả expense tháng (gồm today) → dùng trực tiếp.
  const tomorrowFrom = (remainingBudget: number, daysRemaining: number): number | null => {
    const daysAfterToday = daysRemaining - 1;
    if (daysAfterToday < 1) return null;
    return roundSafe(Math.max(0, Math.floor(remainingBudget / daysAfterToday)));
  };

  // ===== CHẾ ĐỘ CHU KỲ LƯƠNG =====
  if (cycleConfig.enabled) {
    const lastPayday = lastPaydayBefore(today, cycleConfig.payday);
    const nextPayday = computeNextPayday(lastPayday, cycleConfig);
    const lastPaydayStr = fmtDate(lastPayday);
    const nextPaydayStr = fmtDate(nextPayday);
    const todayStr = fmtDate(today);

    // daysRemaining = số ngày từ today tới next_payday (exclusive), tối thiểu 1
    const daysRemaining = Math.max(1, daysBetween(today, nextPayday));

    let monthIncome = 0;
    let monthExpense = 0;
    for (const t of transactions) {
      if (t.date < lastPaydayStr || t.date >= nextPaydayStr) continue;
      if (t.type === 'income') monthIncome += t.amount;
      else monthExpense += t.amount;
    }

    // Bill pending trong chu kỳ này
    let pendingBills = 0;
    for (const b of bills) {
      if (b.paid_at) continue;
      if (b.due_date < todayStr) continue; // bill quá hạn lo riêng
      if (b.due_date < lastPaydayStr || b.due_date >= nextPaydayStr) continue;
      pendingBills += b.amount;
    }

    const remainingBudget = monthIncome - monthExpense - pendingBills;
    const isOverspending = monthExpense > monthIncome && monthIncome > 0;
    const rangeLabel = `${fmtShort(lastPayday)} → ${fmtShort(addDays(nextPayday, -1))}`;

    if (monthIncome === 0) {
      return {
        safeAmount: null,
        safeAmountRaw: null,
        todayExpense,
        safeRemainingToday: null,
        tomorrowAmount: null,
        remainingBudget,
        daysRemaining,
        monthIncome,
        monthExpense,
        pendingBills,
        isOverspending: false,
        rangeLabel,
        isCycleMode: true,
      };
    }
    // v3.98 — safeAmount = INITIAL quota của ngày (chưa trừ todayExpense, hiển thị stable cả ngày)
    // v3.103 — Cache snapshot để stable absolute (Fix MEDIUM #5)
    const cacheKey = `cycle:${todayDateStr}`;
    const cached = _safeAmountCache.get(cacheKey);
    const remainingBeforeToday = cached?.remainingBeforeToday ?? (remainingBudget + todayExpense);
    if (!cached) {
      _safeAmountCache.set(cacheKey, { remainingBeforeToday, daysRemaining });
    }
    const safeAmountRaw = Math.max(0, Math.floor(remainingBeforeToday / daysRemaining));
    const safeAmount = roundSafe(safeAmountRaw);
    return {
      safeAmount,
      safeAmountRaw,
      todayExpense,
      safeRemainingToday: remainingFromSafe(safeAmount),
      tomorrowAmount: tomorrowFrom(remainingBudget, daysRemaining),
      remainingBudget,
      daysRemaining,
      monthIncome,
      monthExpense,
      pendingBills,
      isOverspending,
      rangeLabel,
      isCycleMode: true,
    };
  }

  // ===== CHẾ ĐỘ MẶC ĐỊNH (tháng dương lịch) =====
  const monthKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}`;
  const totalDaysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ).getDate();
  const todayDay = today.getDate();
  const daysRemaining = Math.max(1, totalDaysInMonth - todayDay + 1);
  const todayStr = fmtDate(today);

  let monthIncome = 0;
  let monthExpense = 0;
  for (const t of transactions) {
    if (!t.date.startsWith(monthKey)) continue;
    if (t.type === 'income') monthIncome += t.amount;
    else monthExpense += t.amount;
  }

  let pendingBills = 0;
  for (const b of bills) {
    if (b.paid_at) continue;
    if (!b.due_date.startsWith(monthKey)) continue;
    if (b.due_date < todayStr) continue;
    pendingBills += b.amount;
  }

  const remainingBudget = monthIncome - monthExpense - pendingBills;
  const isOverspending = monthExpense > monthIncome && monthIncome > 0;
  const rangeLabel = `Tháng ${pad2(today.getMonth() + 1)}/${today.getFullYear()}`;

  if (monthIncome === 0) {
    return {
      safeAmount: null,
      safeAmountRaw: null,
      todayExpense,
      safeRemainingToday: null,
      tomorrowAmount: null,
      remainingBudget,
      daysRemaining,
      monthIncome,
      monthExpense,
      pendingBills,
      isOverspending: false,
      rangeLabel,
      isCycleMode: false,
    };
  }

  // v3.98 — safeAmount = INITIAL quota của ngày (stable cả ngày)
  // v3.103 — Cache snapshot stable absolute (Fix MEDIUM #5)
  const cacheKey2 = `default:${todayDateStr}`;
  const cached2 = _safeAmountCache.get(cacheKey2);
  const remainingBeforeTodayDefault = cached2?.remainingBeforeToday ?? (remainingBudget + todayExpense);
  if (!cached2) {
    _safeAmountCache.set(cacheKey2, { remainingBeforeToday: remainingBeforeTodayDefault, daysRemaining });
  }
  const safeAmountRaw = Math.max(0, Math.floor(remainingBeforeTodayDefault / daysRemaining));
  const safeAmount = roundSafe(safeAmountRaw);
  return {
    safeAmount,
    safeAmountRaw,
    todayExpense,
    safeRemainingToday: remainingFromSafe(safeAmount),
    tomorrowAmount: tomorrowFrom(remainingBudget, daysRemaining),
    remainingBudget,
    daysRemaining,
    monthIncome,
    monthExpense,
    pendingBills,
    isOverspending,
    rangeLabel,
    isCycleMode: false,
  };
}

/** Format số tiền cho UI: 230k / 1.2tr / 18000đ */
export function formatSafeAmount(n: number): string {
  if (n >= 1_000_000) {
    const tr = n / 1_000_000;
    return tr >= 10 ? `${Math.round(tr)}tr` : `${tr.toFixed(1).replace('.0', '')}tr`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${n}đ`;
}

/** Đọc config chu kỳ lương từ settings record. */
export function parseSalaryCycleFromSettings(
  settings: Record<string, string>
): SalaryCycleConfig {
  const enabled = settings.salary_cycle_enabled === '1';
  const payday = clamp(parseInt(settings.salary_payday || '10', 10), 1, 31);
  const rawType = settings.salary_cycle_type;
  const cycleType: SalaryCycleType = rawType === 'days' ? 'days' : 'monthly';
  const cycleDays = clamp(parseInt(settings.salary_cycle_days || '15', 10), 3, 90);
  return { enabled, payday, cycleType, cycleDays };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
