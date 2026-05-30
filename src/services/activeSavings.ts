// Active Savings (v3.23) — Mục tiêu tiết kiệm chủ động.
// Logic:
//  1. Tự "chích" 1 khoản nhỏ vào saving goals mỗi ngày (rounding remainder + N% safe-to-spend).
//  2. Cuối ngày check unused budget (safe - expense) → gợi ý cộng dư vào goal.
//  3. Chia tự động theo tỷ lệ target của các goal active.
import {
  Bill,
  SavingsGoal,
  Transaction,
  addToSavingsGoal,
  getDb,
  getSavingsGoals,
  getSetting,
  getSnapshot,
  markSnapshotHandled,
  setSetting,
  updateSavingsGoal,
  upsertSnapshot,
} from '../db';
import {
  computeSafeToSpend,
  parseSalaryCycleFromSettings,
} from './safeToSpend';
import { FREE_ONLY_RELEASE } from './premium';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function yesterdayDate(today: Date): string {
  const d = new Date(today);
  d.setDate(d.getDate() - 1);
  return fmtDate(d);
}

export type ActiveSavingsConfig = {
  enabled: boolean;
  pct: number; // 3 / 5 / 10
  suggestEnabled: boolean;
};

export const DEFAULT_ACTIVE_SAVINGS: ActiveSavingsConfig = {
  enabled: true,
  pct: 5,
  suggestEnabled: true,
};

export function parseActiveSavingsFromSettings(
  settings: Record<string, string>
): ActiveSavingsConfig {
  // v3.146 — Default OFF: tính năng Pro chỉ bật khi user CHỦ ĐỘNG bật.
  //   Trước đó dùng `!== '0'` → key undefined cũng cho enabled=true → user mua Pro tự thấy ON.
  //   Giờ chỉ enabled khi setting === '1'.
  const enabled = settings.savings_auto_enabled === '1';
  const pctRaw = parseInt(settings.savings_auto_pct || '5', 10);
  const pct = Number.isFinite(pctRaw) && pctRaw >= 1 && pctRaw <= 20 ? pctRaw : 5;
  // suggestEnabled cũng default OFF cho consistent — user phải tự bật.
  const suggestEnabled = settings.savings_suggest_enabled === '1';
  return { enabled, pct, suggestEnabled };
}

/** Chia số tiền `total` cho các goal theo tỷ lệ target. Trả về list [{goalId, amount}]. */
export function splitByTargetRatio(
  total: number,
  goals: SavingsGoal[]
): { goalId: number; amount: number }[] {
  const active = goals.filter((g) => !g.completed_at);
  if (active.length === 0 || total <= 0) return [];

  const totalTarget = active.reduce((s, g) => s + g.target, 0);
  if (totalTarget <= 0) {
    // Edge case: target = 0 cho tất cả → chia đều
    const per = Math.floor(total / active.length / 1_000) * 1_000;
    if (per <= 0) return [{ goalId: active[0].id, amount: total }];
    return active.map((g) => ({ goalId: g.id, amount: per }));
  }

  const splits: { goalId: number; amount: number }[] = [];
  let allocated = 0;
  for (let i = 0; i < active.length - 1; i++) {
    const g = active[i];
    const share = Math.floor((total * g.target) / totalTarget / 1_000) * 1_000;
    splits.push({ goalId: g.id, amount: share });
    allocated += share;
  }
  // Goal cuối nhận phần còn lại để tổng đúng `total`
  splits.push({ goalId: active[active.length - 1].id, amount: total - allocated });
  return splits.filter((s) => s.amount > 0);
}

/**
 * Chạy daily allocation:
 *  1. AUTO process unused hôm qua sau 24h — tự cộng hết phần dư vào saving goals (v3.27)
 *  2. Auto-chích 1 khoản nhỏ vào saving goals cho HÔM NAY
 * Idempotent: cùng ngày gọi nhiều lần chỉ chạy 1 lần (dùng setting savings_last_allocation_date).
 */
export async function runDailyAllocation(
  transactions: Transaction[],
  bills: Bill[],
  settings: Record<string, string>,
  today: Date = new Date(),
  bookId?: number // v3.63 — pass bookId tránh cross-book pollution daily allocator
): Promise<{
  ran: boolean;
  totalAllocated: number;
  unusedYesterdayAuto: number;
  splits: { goalId: number; goalName: string; amount: number }[];
}> {
  const config = parseActiveSavingsFromSettings(settings);
  if (!config.enabled) {
    return { ran: false, totalAllocated: 0, unusedYesterdayAuto: 0, splits: [] };
  }
  // v3.128 — Pro gate: feature chỉ chạy khi user Pro (defense-in-depth, dù settings.savings_auto_enabled = 1).
  //   Trường hợp xảy ra: user Pro bật toggle, sau đó tier rơi về free (gói hết hạn) → settings còn '1' nhưng tier free.
  // v1.0 free-only: tier ép 'pro' trong code chứ không set settings.is_pro='1' ở DB,
  //   nên phải bỏ qua gate này khi FREE_ONLY_RELEASE, nếu không auto-save không bao giờ chạy.
  if (!FREE_ONLY_RELEASE && settings.is_pro !== '1') {
    return { ran: false, totalAllocated: 0, unusedYesterdayAuto: 0, splits: [] };
  }

  const todayStr = fmtDate(today);
  const lastDate = await getSetting('savings_last_allocation_date');
  if (lastDate === todayStr) {
    return { ran: false, totalAllocated: 0, unusedYesterdayAuto: 0, splits: [] };
  }

  const goals = await getSavingsGoals(bookId);
  const activeGoals = goals.filter((g) => !g.completed_at);
  if (activeGoals.length === 0) {
    // Không có goal → vẫn lưu lastDate để tránh check lại
    await setSetting('savings_last_allocation_date', todayStr);
    return { ran: false, totalAllocated: 0, unusedYesterdayAuto: 0, splits: [] };
  }

  // ===== STEP 1: AUTO PROCESS UNUSED HÔM QUA =====
  // Sau 24h, nếu hôm qua xài < safe → tự cộng hết phần dư vào goals (đại ca yêu cầu v3.27).
  let unusedYesterdayAuto = 0;
  const yest = yesterdayDate(today);
  const yestSnap = await getSnapshot(yest);
  if (yestSnap && yestSnap.suggested_handled === 0) {
    const yestExpense = transactions
      .filter((t) => t.date === yest && t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const unused = yestSnap.safe_amount - yestExpense;
    // v3.57 — Unify threshold 10k với manual suggestion (line 225) để tránh micro-allocation +1.000đ
    if (unused >= 10_000) {
      // Round bội 1k đảm bảo chẵn (không có 19.333)
      const unusedRounded = Math.floor(unused / 1_000) * 1_000;
      const yestSplits = splitByTargetRatio(unusedRounded, activeGoals);
      for (const sp of yestSplits) {
        await addToSavingsGoal(sp.goalId, sp.amount);
      }
      await markSnapshotHandled(yest, unusedRounded);
      unusedYesterdayAuto = unusedRounded;
    } else {
      // Dư < 10k (dust) → mark handled luôn, không cần xử lý
      await markSnapshotHandled(yest, 0);
    }
  }

  // ===== STEP 2: AUTO-CHÍCH CHO HÔM NAY =====
  const cycleConfig = parseSalaryCycleFromSettings(settings);
  const safeResult = computeSafeToSpend(transactions, bills, today, cycleConfig);
  if (safeResult.safeAmount === null || safeResult.safeAmountRaw === null) {
    return { ran: unusedYesterdayAuto > 0, totalAllocated: 0, unusedYesterdayAuto, splits: [] };
  }

  // Rounding remainder bội 1k (đảm bảo chẵn, không có lẻ vd 4.333)
  const roundingRemainderRaw = safeResult.safeAmountRaw - safeResult.safeAmount;
  const roundingRemainder = Math.floor(roundingRemainderRaw / 1_000) * 1_000;
  // Daily auto-save = pct% safe (rounded xuống bội 1k)
  const dailyAutoRaw = Math.floor((safeResult.safeAmount * config.pct) / 100);
  const dailyAuto = Math.floor(dailyAutoRaw / 1_000) * 1_000;

  const totalAllocated = roundingRemainder + dailyAuto;
  if (totalAllocated <= 0) {
    await setSetting('savings_last_allocation_date', todayStr);
    return { ran: unusedYesterdayAuto > 0, totalAllocated: 0, unusedYesterdayAuto, splits: [] };
  }

  // Chia theo tỷ lệ target — splits cũng bội 1k vì total bội 1k
  const splits = splitByTargetRatio(totalAllocated, activeGoals);
  const detailedSplits: { goalId: number; goalName: string; amount: number }[] = [];

  for (const sp of splits) {
    await addToSavingsGoal(sp.goalId, sp.amount);
    const g = activeGoals.find((x) => x.id === sp.goalId);
    detailedSplits.push({
      goalId: sp.goalId,
      goalName: g?.name || '(không tên)',
      amount: sp.amount,
    });
  }

  // Upsert snapshot hôm nay
  const existing = await getSnapshot(todayStr);
  await upsertSnapshot({
    date: todayStr,
    safe_amount: safeResult.safeAmount,
    expense_amount: existing?.expense_amount ?? 0,
    auto_allocated: (existing?.auto_allocated ?? 0) + totalAllocated,
    manual_added: existing?.manual_added ?? 0,
    suggested_handled: existing?.suggested_handled ?? 0,
  });

  await setSetting('savings_last_allocation_date', todayStr);

  return { ran: true, totalAllocated, unusedYesterdayAuto, splits: detailedSplits };
}

/**
 * Kiểm tra ngày HÔM QUA có dư (safe - expense > 10k) chưa xử lý → gợi ý cộng vào goal.
 * Trả về null nếu không có gợi ý.
 */
export async function getYesterdayUnusedSuggestion(
  transactions: Transaction[],
  today: Date = new Date(),
  bookId?: number // v3.63 — pass bookId
): Promise<{
  date: string;
  unused: number;
  primaryGoal: SavingsGoal | null;
} | null> {
  const yest = yesterdayDate(today);
  const snap = await getSnapshot(yest);
  if (!snap) return null;
  if (snap.suggested_handled === 1) return null;

  // Tính lại expense thực của hôm qua (vì có thể chưa được lưu khi runDailyAllocation chạy)
  const yestExpense = transactions
    .filter((t) => t.date === yest && t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const unused = snap.safe_amount - yestExpense;
  if (unused < 10_000) return null;

  // Goal đầu tiên đang active (có thể UI cho user chọn)
  const goals = await getSavingsGoals(bookId);
  const active = goals.filter((g) => !g.completed_at);
  const primary = active[0] ?? null;

  // Làm tròn unused xuống bội 1k
  const unusedRounded = Math.floor(unused / 1_000) * 1_000;
  return {
    date: yest,
    unused: unusedRounded,
    primaryGoal: primary,
  };
}

/** User accept gợi ý → cộng tiền vào goals theo tỷ lệ target. */
export async function acceptUnusedSuggestion(
  date: string,
  amount: number,
  bookId?: number // v3.63
): Promise<{ splits: { goalId: number; goalName: string; amount: number }[] }> {
  const goals = await getSavingsGoals(bookId);
  const active = goals.filter((g) => !g.completed_at);
  if (active.length === 0) {
    await markSnapshotHandled(date, 0);
    return { splits: [] };
  }
  const splits = splitByTargetRatio(amount, active);
  const detailed: { goalId: number; goalName: string; amount: number }[] = [];
  for (const sp of splits) {
    await addToSavingsGoal(sp.goalId, sp.amount);
    const g = active.find((x) => x.id === sp.goalId);
    detailed.push({ goalId: sp.goalId, goalName: g?.name || '(không tên)', amount: sp.amount });
  }
  await markSnapshotHandled(date, amount);
  return { splits: detailed };
}

/** User dismiss gợi ý (không cộng vào goal). */
export async function dismissUnusedSuggestion(date: string): Promise<void> {
  await markSnapshotHandled(date, 0);
}

/**
 * v3.28 — Migration 1 lần round mọi giá trị lẻ sang bội 1k.
 * Cleanup data sót từ các version trước (v3.23-v3.26) khi remainder chưa round.
 * Idempotent qua setting flag `savings_round_cleanup_v1`.
 */
export async function cleanupRoundingArtifacts(): Promise<{
  ran: boolean;
  goalsFixed: number;
  snapshotsFixed: number;
}> {
  const done = await getSetting('savings_round_cleanup_v1');
  if (done === '1') return { ran: false, goalsFixed: 0, snapshotsFixed: 0 };

  let goalsFixed = 0;
  let snapshotsFixed = 0;

  // Goals: current % 1000 !== 0 → round xuống
  // v3.109 — 1-time cleanup migration, idempotent qua flag. Default bookId=1 cho single-book user.
  //   Khi mở UI multi-book sau này, cần loop qua tất cả books và cleanup từng book.
  const goals = await getSavingsGoals(1);
  for (const g of goals) {
    if (g.current % 1_000 !== 0) {
      const rounded = Math.floor(g.current / 1_000) * 1_000;
      await updateSavingsGoal(g.id, { current: rounded });
      goalsFixed++;
    }
  }

  // Snapshots: auto_allocated + manual_added round xuống
  const db = await getDb();
  try {
    const rows = await db.getAllAsync<{
      date: string;
      auto_allocated: number;
      manual_added: number;
    }>(
      'SELECT date, auto_allocated, manual_added FROM daily_snapshots WHERE auto_allocated % 1000 != 0 OR manual_added % 1000 != 0'
    );
    for (const r of rows) {
      const aa = Math.floor(r.auto_allocated / 1_000) * 1_000;
      const ma = Math.floor(r.manual_added / 1_000) * 1_000;
      await db.runAsync(
        'UPDATE daily_snapshots SET auto_allocated = ?, manual_added = ? WHERE date = ?',
        [aa, ma, r.date]
      );
      snapshotsFixed++;
    }
  } catch (e) {
    console.warn('[savings cleanup] snapshot fix fail:', e);
  }

  await setSetting('savings_round_cleanup_v1', '1');
  return { ran: true, goalsFixed, snapshotsFixed };
}
