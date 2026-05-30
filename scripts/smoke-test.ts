/* eslint-disable no-console */
// Smoke test: chạy pure logic services với data thật, in output để anh Bux2 đối chiếu.
// Không cần device, không cần SQLite. Run: npx tsx scripts/smoke-test.ts

// ============================================================================
// Inline copies of pure logic — vì service modules import types từ ../db (SQLite)
// nên không import được trực tiếp trong Node. Test logic 1:1 với service.
// ============================================================================

// ─── SAFE-TO-SPEND ──────────────────────────────────────────────────────────
type SalaryCycleType = 'monthly' | 'days';
type SalaryCycleConfig = {
  enabled: boolean;
  payday: number;
  cycleType: SalaryCycleType;
  cycleDays: number;
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
function lastPaydayBefore(today: Date, payday: number): Date {
  const daysInThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const thisMonthDay = Math.min(payday, daysInThisMonth);
  const thisMonthPayday = new Date(today.getFullYear(), today.getMonth(), thisMonthDay);
  if (thisMonthPayday <= today) return thisMonthPayday;
  const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const daysInPrev = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
  return new Date(prev.getFullYear(), prev.getMonth(), Math.min(payday, daysInPrev));
}
function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}
function sameDayNextMonth(d: Date): Date {
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const nextY = m === 11 ? y + 1 : y;
  const nextM = m === 11 ? 0 : m + 1;
  const daysInNext = new Date(nextY, nextM + 1, 0).getDate();
  return new Date(nextY, nextM, Math.min(day, daysInNext));
}
function computeNextPayday(lastPayday: Date, config: SalaryCycleConfig): Date {
  if (config.cycleType === 'monthly') return sameDayNextMonth(lastPayday);
  return addDays(lastPayday, config.cycleDays);
}
function daysBetween(a: Date, b: Date): number {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

type FakeTx = { date: string; amount: number; type: 'income' | 'expense'; category_id?: number; note?: string | null };
type FakeBill = { paid_at: string | null; due_date: string; amount: number };

function computeSafeToSpend(
  transactions: FakeTx[],
  bills: FakeBill[],
  today: Date,
  cycleConfig: SalaryCycleConfig
) {
  if (cycleConfig.enabled) {
    const lastPayday = lastPaydayBefore(today, cycleConfig.payday);
    const nextPayday = computeNextPayday(lastPayday, cycleConfig);
    const lastPaydayStr = fmtDate(lastPayday);
    const nextPaydayStr = fmtDate(nextPayday);
    const todayStr = fmtDate(today);
    const daysRemaining = Math.max(1, daysBetween(today, nextPayday));
    let monthIncome = 0, monthExpense = 0;
    for (const t of transactions) {
      if (t.date < lastPaydayStr || t.date >= nextPaydayStr) continue;
      if (t.type === 'income') monthIncome += t.amount;
      else monthExpense += t.amount;
    }
    let pendingBills = 0;
    for (const b of bills) {
      if (b.paid_at) continue;
      if (b.due_date < todayStr) continue;
      if (b.due_date < lastPaydayStr || b.due_date >= nextPaydayStr) continue;
      pendingBills += b.amount;
    }
    const remainingBudget = monthIncome - monthExpense - pendingBills;
    const rangeLabel = `${fmtShort(lastPayday)} → ${fmtShort(addDays(nextPayday, -1))}`;
    if (monthIncome === 0) return { safeAmount: null, remainingBudget, daysRemaining, monthIncome, monthExpense, pendingBills, rangeLabel, isCycleMode: true };
    const safeAmount = Math.max(0, Math.floor(remainingBudget / daysRemaining));
    return { safeAmount, remainingBudget, daysRemaining, monthIncome, monthExpense, pendingBills, rangeLabel, isCycleMode: true };
  }
  // Default mode
  const monthKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}`;
  const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, totalDays - today.getDate() + 1);
  const todayStr = fmtDate(today);
  let monthIncome = 0, monthExpense = 0;
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
  const rangeLabel = `Tháng ${pad2(today.getMonth() + 1)}/${today.getFullYear()}`;
  if (monthIncome === 0) return { safeAmount: null, remainingBudget, daysRemaining, monthIncome, monthExpense, pendingBills, rangeLabel, isCycleMode: false };
  const safeAmount = Math.max(0, Math.floor(remainingBudget / daysRemaining));
  return { safeAmount, remainingBudget, daysRemaining, monthIncome, monthExpense, pendingBills, rangeLabel, isCycleMode: false };
}

// ─── LOCAL PARSE ────────────────────────────────────────────────────────────
function parseAmountLocal(text: string): number | null {
  if (!text) return null;
  const s = text.toLowerCase().replace(/[.,]/g, '');
  // "1tr5" → 1500000
  const trMatch = s.match(/(\d+)tr(\d*)/);
  if (trMatch) {
    const main = parseInt(trMatch[1], 10);
    const decimal = trMatch[2] ? parseFloat('0.' + trMatch[2]) : 0;
    return Math.round((main + decimal) * 1_000_000);
  }
  // "60k" → 60000
  const kMatch = s.match(/(\d+)k/);
  if (kMatch) return parseInt(kMatch[1], 10) * 1000;
  // "60000" → 60000
  const num = s.match(/\d+/);
  if (num) {
    const n = parseInt(num[0], 10);
    if (n >= 1000) return n;
    return null;
  }
  return null;
}

// ─── STREAK HELPERS ─────────────────────────────────────────────────────────
function weekDays(today: Date = new Date()): string[] {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMon = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMon);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(d);
    cur.setDate(d.getDate() + i);
    out.push(fmtDate(cur));
  }
  return out;
}
function activeDateSet(dates: string[], start: string, end: string): Set<string> {
  const set = new Set<string>();
  for (const d of dates) {
    if (d >= start && d <= end) set.add(d);
  }
  return set;
}
const MILESTONES = [7, 30, 100, 365];
function nextMilestone(streak: number) {
  for (const m of MILESTONES) {
    if (streak < m) return { milestone: m, daysLeft: m - streak };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════════════════════
let passed = 0, failed = 0;
function test(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}
function section(name: string) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ${name}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// ─── TEST 1: SAFE-TO-SPEND scenarios ───
section('TEST 1: Safe-to-Spend — case anh Bux2 báo bug');

// Case: anh Bux2 — lương 10/5 = 10tr, chi tới 23/5 = 2tr, cycle Hàng tháng
{
  const today = new Date(2026, 4, 23); // 23/5/2026
  const txs: FakeTx[] = [
    { date: '2026-05-10', amount: 10_000_000, type: 'income' },
    { date: '2026-05-11', amount: 500_000, type: 'expense' },
    { date: '2026-05-15', amount: 1_500_000, type: 'expense' },
  ];
  const cfg: SalaryCycleConfig = { enabled: true, payday: 10, cycleType: 'monthly', cycleDays: 30 };
  const r = computeSafeToSpend(txs, [], today, cfg);
  console.log(`\n[Case 1.1] Hàng tháng, payday=10, today=23/5, income 10tr, chi 2tr:`);
  console.log(`  → Kỳ: ${r.rangeLabel}`);
  console.log(`  → Còn lại: ${r.remainingBudget.toLocaleString('vi-VN')}đ`);
  console.log(`  → Ngày còn: ${r.daysRemaining}`);
  console.log(`  → Hôm nay xài: ${r.safeAmount?.toLocaleString('vi-VN')}đ`);
  test('Kỳ đúng 10/05 → 09/06', r.rangeLabel === '10/05 → 09/06');
  test('Còn lại 8tr', r.remainingBudget === 8_000_000);
  test('Còn 18 ngày tới next payday (10/6)', r.daysRemaining === 18, `got ${r.daysRemaining}`);
  test('Safe = 444444đ/ngày', r.safeAmount === 444_444);
}

// Case 1.2: Cycle 45 ngày, lương 10/5
{
  const today = new Date(2026, 4, 23);
  const txs: FakeTx[] = [{ date: '2026-05-10', amount: 5_000_000, type: 'income' }];
  const cfg: SalaryCycleConfig = { enabled: true, payday: 10, cycleType: 'days', cycleDays: 45 };
  const r = computeSafeToSpend(txs, [], today, cfg);
  console.log(`\n[Case 1.2] Mỗi 45 ngày, payday=10/5:`);
  console.log(`  → Kỳ: ${r.rangeLabel}`);
  console.log(`  → Ngày còn: ${r.daysRemaining}`);
  test('Kỳ 10/05 → 23/06 (+45 ngày)', r.rangeLabel === '10/05 → 23/06');
  test('Còn 32 ngày tới 24/6', r.daysRemaining === 32, `got ${r.daysRemaining}`);
}

// Case 1.3: Default mode (off cycle) — anh Bux2 ban đầu nói "sai logic"
{
  const today = new Date(2026, 4, 23);
  const txs: FakeTx[] = [
    { date: '2026-05-10', amount: 10_000_000, type: 'income' },
    { date: '2026-05-11', amount: 2_000_000, type: 'expense' },
  ];
  const cfg: SalaryCycleConfig = { enabled: false, payday: 10, cycleType: 'monthly', cycleDays: 30 };
  const r = computeSafeToSpend(txs, [], today, cfg);
  console.log(`\n[Case 1.3] OFF (mặc định tháng dương lịch), today=23/5:`);
  console.log(`  → Kỳ: ${r.rangeLabel}`);
  console.log(`  → Ngày còn: ${r.daysRemaining}`);
  console.log(`  → Hôm nay xài: ${r.safeAmount?.toLocaleString('vi-VN')}đ`);
  test('Default mode: kỳ "Tháng 05/2026"', r.rangeLabel === 'Tháng 05/2026');
  test('Còn 9 ngày tới 31/5', r.daysRemaining === 9);
  test('Safe = 888888đ/ngày (8tr/9)', r.safeAmount === 888_888);
}

// Case 1.4: Edge — payday=31 nhưng tháng 2 chỉ 28 ngày → clamp
{
  const today = new Date(2026, 1, 15); // 15/2/2026 (2026 không nhuận)
  const txs: FakeTx[] = [{ date: '2026-01-31', amount: 8_000_000, type: 'income' }];
  const cfg: SalaryCycleConfig = { enabled: true, payday: 31, cycleType: 'monthly', cycleDays: 30 };
  const r = computeSafeToSpend(txs, [], today, cfg);
  console.log(`\n[Case 1.4] payday=31, today=15/2/2026 (tháng 2 có 28 ngày):`);
  console.log(`  → Kỳ: ${r.rangeLabel}`);
  test('Clamp payday: kỳ 31/01 → 27/02', r.rangeLabel === '31/01 → 27/02', `got ${r.rangeLabel}`);
}

// Case 1.5: Empty income → safeAmount null
{
  const today = new Date(2026, 4, 23);
  const cfg: SalaryCycleConfig = { enabled: true, payday: 10, cycleType: 'monthly', cycleDays: 30 };
  const r = computeSafeToSpend([], [], today, cfg);
  console.log(`\n[Case 1.5] Không có income trong kỳ:`);
  console.log(`  → safeAmount: ${r.safeAmount}`);
  test('safeAmount === null khi income=0', r.safeAmount === null);
}

// Case 1.6: Overspending — chi vượt thu
{
  const today = new Date(2026, 4, 23);
  const txs: FakeTx[] = [
    { date: '2026-05-10', amount: 5_000_000, type: 'income' },
    { date: '2026-05-15', amount: 6_000_000, type: 'expense' },
  ];
  const cfg: SalaryCycleConfig = { enabled: false, payday: 10, cycleType: 'monthly', cycleDays: 30 };
  const r = computeSafeToSpend(txs, [], today, cfg);
  console.log(`\n[Case 1.6] Chi 6tr > thu 5tr:`);
  console.log(`  → remainingBudget: ${r.remainingBudget.toLocaleString('vi-VN')}đ`);
  console.log(`  → monthExpense > monthIncome? ${r.monthExpense > r.monthIncome}`);
  test('remainingBudget âm', r.remainingBudget === -1_000_000);
  test('safeAmount = 0 (clamp)', r.safeAmount === 0);
}

// ─── TEST 2: PARSE AMOUNT ───
section('TEST 2: Parse Amount VN');

const parseCases: Array<[string, number | null]> = [
  ['60k', 60_000],
  ['60K', 60_000],
  ['1tr', 1_000_000],
  ['1tr5', 1_500_000],
  ['2tr3', 2_300_000],
  ['12tr', 12_000_000],
  ['Ăn trưa 60k', 60_000],
  ['Lương 12tr', 12_000_000],
  ['Cafe 35k với bạn', 35_000],
  ['100000', 100_000],
  ['', null],
];
for (const [input, expected] of parseCases) {
  const out = parseAmountLocal(input);
  test(`"${input}" → ${expected}`, out === expected, `got ${out}`);
}

// ─── TEST 3: STREAK HELPERS ───
section('TEST 3: Streak Helpers');

// weekDays cho thứ 7 23/5/2026
{
  const wk = weekDays(new Date(2026, 4, 23)); // Thứ 7 23/5
  console.log(`\nweekDays(23/5/2026 = thứ 7):`);
  console.log(`  → ${wk.join(', ')}`);
  test('Tuần bắt đầu T2 18/5', wk[0] === '2026-05-18');
  test('Tuần kết CN 24/5', wk[6] === '2026-05-24');
  test('Có 7 ngày', wk.length === 7);
}

// activeDateSet
{
  const dates = ['2026-05-18', '2026-05-20', '2026-05-23', '2026-06-01'];
  const s = activeDateSet(dates, '2026-05-18', '2026-05-24');
  console.log(`\nactiveDateSet trong tuần 18-24/5: ${[...s].join(', ')}`);
  test('Filter 3 ngày trong tuần', s.size === 3);
  test('Không bao gồm 1/6', !s.has('2026-06-01'));
}

// nextMilestone
{
  const cases: Array<[number, number | null, number | null]> = [
    [0, 7, 7],
    [6, 7, 1],
    [7, 30, 23],
    [29, 30, 1],
    [99, 100, 1],
    [365, null, null], // hết mốc
  ];
  console.log('\nnextMilestone:');
  for (const [streak, milestone, days] of cases) {
    const r = nextMilestone(streak);
    if (milestone === null) {
      test(`streak ${streak} → null`, r === null);
    } else {
      test(`streak ${streak} → mốc ${milestone}, còn ${days}`, !!r && r.milestone === milestone && r.daysLeft === days, `got ${JSON.stringify(r)}`);
    }
  }
}

// ─── SUMMARY ───
section('TỔNG KẾT');
console.log(`\n  ✓ PASSED: ${passed}`);
console.log(`  ✗ FAILED: ${failed}`);
console.log(`  Tỷ lệ:    ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);
process.exit(failed === 0 ? 0 : 1);
