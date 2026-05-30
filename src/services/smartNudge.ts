// Sinh notification "ghẹo" dựa data thật của user. KHÔNG gửi cloud, 100% local.
import { Transaction, Category } from '../db';

function vnd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}tr`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${n}đ`;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface NudgeContext {
  weekExpense: number;
  weekIncome: number;
  monthExpense: number;
  monthIncome: number;
  topWeekCategory?: { name: string; amount: number };
  topMonthCategory?: { name: string; amount: number };
  prevWeekExpense: number;
  daysIntoMonth: number;
  totalDaysInMonth: number;
}

/**
 * Sinh 1 nudge ngẫu nhiên từ context. Tone thân thiện chuyên nghiệp, không phán xét.
 * Có số liệu thật từ data, không generic.
 */
export function generateNudge(ctx: NudgeContext): string {
  const candidates: string[] = [];

  // Rule 1: Top category tuần
  if (ctx.topWeekCategory && ctx.topWeekCategory.amount > 100_000) {
    const cat = ctx.topWeekCategory;
    candidates.push(
      `${cat.name} tuần này đã ${vnd(cat.amount)}. Cân nhắc lại ngân sách cho hợp lý nhé.`
    );
    candidates.push(
      `Tuần này ${cat.name} chiếm khá nhiều: ${vnd(cat.amount)}. Đáng để xem lại chi tiết.`
    );
    candidates.push(
      `${cat.name} ${vnd(cat.amount)} trong 7 ngày. Tốc độ này tháng sau có thể vượt ngân sách.`
    );
  }

  // Rule 2: Top category tháng vs cụ thể
  if (ctx.topMonthCategory && ctx.topMonthCategory.amount > 500_000) {
    const cat = ctx.topMonthCategory;
    const eq = equivalent(cat.amount);
    if (eq) {
      candidates.push(
        `${cat.name} tháng này ${vnd(cat.amount)}, tương đương ${eq}.`
      );
    }
    candidates.push(
      `Tháng này riêng ${cat.name} đã ${vnd(cat.amount)}. Có cần điều chỉnh không?`
    );
  }

  // Rule 3: Chi nhanh hơn tiến độ tháng
  if (ctx.monthIncome > 0 && ctx.totalDaysInMonth > 0) {
    const spendRate = ctx.monthExpense / ctx.monthIncome;
    const monthProgress = ctx.daysIntoMonth / ctx.totalDaysInMonth;
    if (spendRate > monthProgress + 0.15 && monthProgress < 0.9) {
      candidates.push(
        `Đã chi ${Math.round(spendRate * 100)}% thu nhập, mới qua ${Math.round(monthProgress * 100)}% tháng. Tốc độ này hơi nhanh.`
      );
      candidates.push(
        `Còn lại ${vnd(ctx.monthIncome - ctx.monthExpense)} cho ${ctx.totalDaysInMonth - ctx.daysIntoMonth} ngày tới. Mở app để xem chi tiết.`
      );
    }
  }

  // Rule 4: So sánh tuần
  if (ctx.prevWeekExpense > 0 && ctx.weekExpense > ctx.prevWeekExpense * 1.5) {
    candidates.push(
      `Tuần này chi ${vnd(ctx.weekExpense)}, gấp ${(ctx.weekExpense / ctx.prevWeekExpense).toFixed(1)} lần tuần trước. Có sự kiện đặc biệt không?`
    );
    candidates.push(
      `So với tuần trước ${vnd(ctx.prevWeekExpense)}, tuần này ${vnd(ctx.weekExpense)}. Tăng đáng kể.`
    );
  }

  // Rule 5: Tiết kiệm tốt
  if (ctx.monthIncome > 0) {
    const saved = ctx.monthIncome - ctx.monthExpense;
    if (saved > 0 && saved / ctx.monthIncome > 0.4 && ctx.daysIntoMonth > 15) {
      candidates.push(
        `Tháng này bạn đã dành dụm được ${vnd(saved)}. Kỷ luật tài chính rất tốt.`
      );
      candidates.push(
        `Tiết kiệm ${Math.round((saved / ctx.monthIncome) * 100)}% thu nhập, một con số đáng ngưỡng mộ.`
      );
    }
  }

  // Rule 6: Chi vượt thu
  if (ctx.monthIncome > 0 && ctx.monthExpense > ctx.monthIncome) {
    const over = ctx.monthExpense - ctx.monthIncome;
    candidates.push(
      `Tháng này chi vượt thu ${vnd(over)}. Cân nhắc xem lại ngân sách.`
    );
    candidates.push(
      `Chi đã nhiều hơn thu ${vnd(over)}. Mở Ngân sách để kiểm tra khoản nào có thể giảm.`
    );
  }

  // Rule 7: Generic nhắc nếu data ít
  if (candidates.length === 0) {
    candidates.push(
      `Tuần này bạn đã ghi đủ giao dịch chưa? Chỉ mất 5 giây thôi.`
    );
    candidates.push(
      `Tài chính tốt bắt đầu từ thói quen ghi chép. Một phút mỗi ngày là đủ.`
    );
    candidates.push(
      `Đã đến lúc cập nhật chi tiêu. Mở app để xem báo cáo tháng này.`
    );
  }

  return pickRandom(candidates);
}

/**
 * Tìm "equivalent" — số tiền tương đương cái gì user có thể mua.
 * VD: 1.2tr ≈ "AirPods Pro 2 sau 3 tháng"
 */
function equivalent(amount: number): string | null {
  const items = [
    { name: 'tai nghe Sony WH-1000XM5', price: 8_000_000 },
    { name: 'AirPods Pro', price: 6_000_000 },
    { name: 'AirPods 4', price: 3_500_000 },
    { name: 'iPad mini', price: 13_000_000 },
    { name: 'Switch OLED', price: 9_000_000 },
    { name: 'PS5', price: 14_000_000 },
    { name: 'chuyến Đà Lạt 2 ngày', price: 3_000_000 },
    { name: 'Kindle Paperwhite', price: 4_000_000 },
    { name: 'Apple Watch SE', price: 6_500_000 },
    { name: '20 ly trà sữa', price: 1_000_000 },
    { name: 'buffet sushi 2 người', price: 1_200_000 },
    { name: '1 cái túi Charles & Keith', price: 2_500_000 },
  ];
  // Lọc item user có thể mua bằng amount này (full 1 cái) hoặc nhiều tháng tích luỹ
  for (const item of items) {
    if (amount >= item.price * 0.8 && amount <= item.price * 3) {
      const months = Math.ceil(item.price / amount);
      if (months === 1) return `mua được 1 ${item.name}`;
      return `mua được 1 ${item.name} sau ${months} tháng`;
    }
  }
  return null;
}

/**
 * Compute context cho nudge từ transactions + categories.
 * Filter by current book không cần (caller đã filter).
 */
export function computeNudgeContext(
  transactions: Transaction[],
  categories: Category[],
  today: Date = new Date()
): NudgeContext {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // This week (Monday start)
  const day = today.getDay();
  const diffToMon = day === 0 ? 6 : day - 1;
  const weekStart = new Date(today);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(today.getDate() - diffToMon);
  const weekStartStr = fmt(weekStart);

  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(weekStart.getDate() - 7);
  const prevWeekStartStr = fmt(prevWeekStart);
  const prevWeekEnd = new Date(weekStart);
  prevWeekEnd.setDate(weekStart.getDate() - 1);
  const prevWeekEndStr = fmt(prevWeekEnd);

  // This month
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  let weekExp = 0,
    weekInc = 0,
    monthExp = 0,
    monthInc = 0,
    prevWeekExp = 0;
  const weekByCat: Record<number, number> = {};
  const monthByCat: Record<number, number> = {};

  for (const t of transactions) {
    if (t.date.startsWith(monthKey)) {
      if (t.type === 'expense') {
        monthExp += t.amount;
        monthByCat[t.category_id] = (monthByCat[t.category_id] || 0) + t.amount;
      } else {
        monthInc += t.amount;
      }
    }
    if (t.date >= weekStartStr) {
      if (t.type === 'expense') {
        weekExp += t.amount;
        weekByCat[t.category_id] = (weekByCat[t.category_id] || 0) + t.amount;
      } else {
        weekInc += t.amount;
      }
    }
    if (t.date >= prevWeekStartStr && t.date <= prevWeekEndStr && t.type === 'expense') {
      prevWeekExp += t.amount;
    }
  }

  const topWeek = Object.entries(weekByCat).sort((a, b) => b[1] - a[1])[0];
  const topMonth = Object.entries(monthByCat).sort((a, b) => b[1] - a[1])[0];

  return {
    weekExpense: weekExp,
    weekIncome: weekInc,
    monthExpense: monthExp,
    monthIncome: monthInc,
    prevWeekExpense: prevWeekExp,
    topWeekCategory: topWeek
      ? { name: catMap.get(Number(topWeek[0]))?.name || 'Khác', amount: topWeek[1] }
      : undefined,
    topMonthCategory: topMonth
      ? { name: catMap.get(Number(topMonth[0]))?.name || 'Khác', amount: topMonth[1] }
      : undefined,
    daysIntoMonth: today.getDate(),
    totalDaysInMonth: daysInMonth,
  };
}
