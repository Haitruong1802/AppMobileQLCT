// F6 — Streak ghi sổ. Chuỗi ngày liên tiếp user add transaction.
// Có "Freeze Pass" 1 pass/tuần: tự bảo vệ streak nếu lỡ 1 ngày.
// Mốc badge: 7 / 30 / 100 / 365 ngày.
import { getDb } from '../db';

export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  freezePasses: number;
  badges: number[]; // [7, 30, 100, 365] subset đã unlock
  /** Streak hiển thị thực tế (đã tính tới hôm nay vs lastActive). */
  displayStreak: number;
  /** Streak còn alive (chưa gãy) so với hôm nay không. */
  isAlive: boolean;
};

export type RecordActivityResult = {
  previousStreak: number;
  currentStreak: number;
  /** True nếu streak vừa lập kỷ lục mới (= longest). */
  isNewLongest: boolean;
  /** Nếu unlock badge mới → milestone. Null nếu không. */
  newBadge: number | null;
  /** Đã dùng freeze pass lần này không. */
  usedFreezePass: boolean;
};

export const MILESTONES = [7, 30, 100, 365];

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Trả về số ngày giữa 2 date string (YYYY-MM-DD). */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = new Date(ay, am - 1, ad);
  const db = new Date(by, bm - 1, bd);
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/** Trả về key tuần (ISO Monday-based) cho 1 date. */
function weekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMon = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMon);
  return fmtDate(d);
}

type Row = {
  id: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  freeze_passes: number;
  freeze_pass_week: string | null;
  badges: string;
};

// v3.109 — Multi-book streak: row id field = book_id (single row per book).
//   Single-book user: id=1 (mặc định). Multi-book: id=2,3,... khi book mới tạo.
//   Cách này không cần ALTER schema, tận dụng id PK sẵn có.
async function getRow(bookId: number = 1): Promise<Row> {
  const db = await getDb();
  const r = await db.getFirstAsync<Row>('SELECT * FROM streaks WHERE id = ?', [bookId]);
  if (r) return r;
  // Insert mới nếu thiếu (safety) — book mới hoặc DB chưa seed
  await db.runAsync(
    'INSERT OR IGNORE INTO streaks (id, current_streak, longest_streak, freeze_passes, badges) VALUES (?, 0, 0, 1, ?)',
    [bookId, '[]']
  );
  return {
    id: bookId,
    current_streak: 0,
    longest_streak: 0,
    last_active_date: null,
    freeze_passes: 1,
    freeze_pass_week: null,
    badges: '[]',
  };
}

/** Reset freeze_passes về 1 nếu sang tuần mới. Mutate row + write DB. */
async function maybeRefillFreezePass(row: Row, today: Date, bookId: number = 1): Promise<Row> {
  const wk = weekKey(today);
  if (row.freeze_pass_week === wk) return row;
  const db = await getDb();
  await db.runAsync(
    'UPDATE streaks SET freeze_passes = 1, freeze_pass_week = ? WHERE id = ?',
    [wk, bookId]
  );
  return { ...row, freeze_passes: 1, freeze_pass_week: wk };
}

/** Đọc streak state, tự refill freeze pass nếu tuần mới. */
export async function getStreak(today: Date = new Date(), bookId: number = 1): Promise<StreakState> {
  let row = await getRow(bookId);
  row = await maybeRefillFreezePass(row, today, bookId);

  const todayStr = fmtDate(today);
  const badges: number[] = parseBadges(row.badges);

  // Tính display: streak có còn alive với today không
  let displayStreak = row.current_streak;
  let isAlive = false;
  if (row.last_active_date) {
    const gap = daysBetween(row.last_active_date, todayStr);
    if (gap <= 0) {
      // last_active = today (or future, lỡ hack date) → alive
      isAlive = true;
    } else if (gap === 1) {
      // last_active = yesterday → alive (chưa cần ghi hôm nay, vẫn còn cả ngày)
      isAlive = true;
    } else if (gap === 2 && row.freeze_passes > 0) {
      // Hôm qua đã miss, today hết freeze → vẫn alive nhưng nguy hiểm
      isAlive = true;
    } else {
      // Streak đã gãy thực sự
      displayStreak = 0;
      isAlive = false;
    }
  }

  return {
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastActiveDate: row.last_active_date,
    freezePasses: row.freeze_passes,
    badges,
    displayStreak,
    isAlive,
  };
}

function parseBadges(s: string): number[] {
  try {
    const arr = JSON.parse(s);
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === 'number');
  } catch {
    /* noop */
  }
  return [];
}

/** v3.49 — Convert SQLite created_at "YYYY-MM-DD HH:MM:SS" UTC → local YYYY-MM-DD. */
export function createdAtLocalDate(createdAt: string): string {
  if (!createdAt) return '';
  // SQLite trả "YYYY-MM-DD HH:MM:SS" (UTC, không có 'Z'). Parse như UTC.
  const d = new Date(createdAt.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return createdAt.slice(0, 10);
  return fmtDate(d);
}

/**
 * v3.49 — Streak track theo CREATED_AT (ngày user thật sự bấm ghi sổ), không phải TX.date.
 *   Lý do: user có thể nhập TX với date quá khứ → không nên tô lịch streak ngày quá khứ đó.
 *   Streak = commitment habit metric = số ngày KHÁC NHAU user MỞ APP + GHI SỔ liên tiếp.
 *
 * v3.43 base — Recompute từ transactions table, robust.
 *   1. Lấy distinct DATE(created_at, 'localtime') từ transactions
 *   2. Tìm latest active date (lastActive)
 *   3. Walk back đếm consecutive days
 *   4. Freeze Pass: bridge 1-day gap chỉ khi day liền trước cũng active
 */
export async function recomputeStreak(today: Date = new Date(), bookId: number = 1): Promise<RecordActivityResult> {
  const db = await getDb();
  let row = await getRow(bookId);
  row = await maybeRefillFreezePass(row, today, bookId);

  const prev = row.current_streak;

  // v3.49 — DISTINCT theo DATE(created_at) local, không phải tx.date
  // v3.108 — Filter book_id để streak per-book (multi-book support)
  const dateRows = await db.getAllAsync<{ date: string }>(
    "SELECT DISTINCT DATE(created_at, 'localtime') AS date FROM transactions WHERE book_id = ? ORDER BY date DESC",
    [bookId]
  );
  const activeDates = new Set(dateRows.map((r) => r.date));

  if (activeDates.size === 0) {
    // Không có TX nào → reset streak = 0
    await db.runAsync(
      'UPDATE streaks SET current_streak = 0, last_active_date = NULL WHERE id = ?',
      [bookId]
    );
    return {
      previousStreak: prev,
      currentStreak: 0,
      isNewLongest: false,
      newBadge: null,
      usedFreezePass: false,
    };
  }

  // Find latest active date
  const sortedActive = Array.from(activeDates).sort().reverse();
  const lastActive = sortedActive[0];

  // v3.100 — Fix #6: Bridge gap TAIL (last_active → today) bằng freeze pass.
  //   Trước đó: chỉ bridge miss day NỘI BỘ chain. User lỡ 2 ngày liên tiếp (lastActive cách today 2 ngày)
  //   → mất streak dù còn pass. Giờ check gap tail trước, consume 1 freeze nếu gap=2.
  //   Gap=1 (today=lastActive+1 day): chưa cần consume — vẫn alive (user còn cả ngày để ghi).
  //   Gap≥3: không thể bridge bằng 1 pass → streak gãy.
  const maxFreeze = row.freeze_passes;
  let usedFreezePass = false;
  let streak = 0;
  let freezeUsed = 0;
  const todayStr = fmtDate(today);
  const tailGap = daysBetween(lastActive, todayStr);
  if (tailGap === 2 && freezeUsed < maxFreeze) {
    // Có gap 1 ngày between lastActive & today → consume 1 freeze để bridge
    freezeUsed++;
    usedFreezePass = true;
  }

  const cursor = new Date(lastActive);
  for (let i = 0; i < 365; i++) {
    const cStr = fmtDate(cursor);
    if (activeDates.has(cStr)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    // Miss day → check freeze pass có khả dụng + có active day liền trước không
    if (freezeUsed < maxFreeze) {
      const lookAhead = new Date(cursor);
      lookAhead.setDate(lookAhead.getDate() - 1);
      if (activeDates.has(fmtDate(lookAhead))) {
        // Bridge 1-day gap, không tăng streak (chỉ bỏ qua ngày miss)
        freezeUsed++;
        usedFreezePass = true;
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
    }
    break;
  }

  // v3.100 — Fix #7: Nếu gap tail >= 3 → streak gãy hoàn toàn, reset về 0 trong DB.
  // v3.102 — Mở rộng cho case `tailGap === 2 && maxFreeze === 0` (hết freeze pass + lỡ 2 ngày):
  //   getStreak (line 118-124) trả `displayStreak=0, isAlive=false` cho case này, NHƯNG nếu KHÔNG reset
  //   DB ở đây thì DB vẫn lưu `current_streak=7` → inconsistency giữa DB raw và display.
  //   Reset DB=0 luôn để DB == displayStreak consistent.
  if (tailGap >= 3 || (tailGap === 2 && maxFreeze === 0)) {
    streak = 0;
  }

  // Badges
  const badges = parseBadges(row.badges);
  let newBadge: number | null = null;
  for (const m of MILESTONES) {
    if (streak >= m && !badges.includes(m)) {
      badges.push(m);
      if (newBadge === null || m > newBadge) newBadge = m;
    }
  }

  const newLongest = Math.max(row.longest_streak, streak);
  const isNewLongest = streak > row.longest_streak && streak > 0;

  // v3.106 — Fix MEDIUM: Khi consume freeze pass tail (tailGap=2), set last_active_date = today
  //   để getStreak() lần sau thấy gap=0 → isAlive=true, displayStreak=current_streak (consistent).
  //   Trước đó: DB lưu lastActive cũ (today-2) → getStreak thấy gap=2 + freezePasses=0 (đã consume)
  //   → displayStreak=0 mismatch với DB current_streak. Field giờ là "effective last active date".
  const usedTailFreeze = usedFreezePass && tailGap === 2;
  const effectiveLastActive = usedTailFreeze ? todayStr : lastActive;

  await db.runAsync(
    'UPDATE streaks SET current_streak = ?, longest_streak = ?, last_active_date = ?, freeze_passes = ?, badges = ? WHERE id = ?',
    [
      streak,
      newLongest,
      effectiveLastActive,
      usedFreezePass ? Math.max(0, row.freeze_passes - freezeUsed) : row.freeze_passes,
      JSON.stringify(badges.sort((a, b) => a - b)),
      bookId,
    ]
  );

  return {
    previousStreak: prev,
    currentStreak: streak,
    isNewLongest,
    newBadge,
    usedFreezePass,
  };
}

/** Alias backward-compat — store gọi recordActivity. Bỏ qua date arg, recompute toàn bộ. */
// v3.108 — Accept bookId optional để recompute đúng book hiện tại
export async function recordActivity(_date: string, bookId: number = 1): Promise<RecordActivityResult> {
  return recomputeStreak(new Date(), bookId);
}

/** Reset streak hoàn toàn (dùng khi reset DB). v3.109 — reset cho tất cả book rows. */
export async function resetStreak(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE streaks SET current_streak = 0, longest_streak = 0, last_active_date = NULL, freeze_passes = 1, freeze_pass_week = NULL, badges = '[]'"
  );
}

/** Trả về mốc badge tiếp theo + số ngày còn lại. */
export function nextMilestone(streak: number): { milestone: number; daysLeft: number } | null {
  for (const m of MILESTONES) {
    if (streak < m) return { milestone: m, daysLeft: m - streak };
  }
  return null;
}

/** Tên + emoji cho mỗi badge milestone. */
export function badgeLabel(m: number): { emoji: string; name: string } {
  switch (m) {
    case 7:
      return { emoji: '🔥', name: '1 tuần liên tiếp' };
    case 30:
      return { emoji: '⭐', name: '1 tháng liên tiếp' };
    case 100:
      return { emoji: '💎', name: '100 ngày' };
    case 365:
      return { emoji: '👑', name: '1 năm, Huyền thoại' };
    default:
      return { emoji: '🏅', name: `${m} ngày` };
  }
}

/**
 * Tính tập hợp ngày user đã có activity trong khoảng [startDate, endDate] inclusive.
 * Dùng để render dot strip (TikTok-style streak UI).
 */
export function activeDateSet(
  dates: string[], // YYYY-MM-DD list từ transactions
  startDate: string,
  endDate: string
): Set<string> {
  const set = new Set<string>();
  for (const d of dates) {
    if (d >= startDate && d <= endDate) set.add(d);
  }
  return set;
}

/** Trả 7 ngày của tuần hiện tại (Mon-Sun) dạng YYYY-MM-DD. */
export function weekDays(today: Date = new Date()): string[] {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMon = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMon);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(d);
    cur.setDate(d.getDate() + i);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${dd}`);
  }
  return out;
}

/** Trả tất cả ngày của tháng hiện tại dạng YYYY-MM-DD. */
export function monthDays(today: Date = new Date()): string[] {
  const y = today.getFullYear();
  const m = today.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    out.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return out;
}
