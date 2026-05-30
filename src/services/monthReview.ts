// v3.66 — Month-end review modal: tổng kết thu/chi/tiết kiệm cuối tháng, prompt phân bổ dư.
// Trigger ngày ≥ 28 và tháng có giao dịch ở ≥ 3 ngày khác nhau (người dùng đều, không phải mới). Idempotent qua setting `month_review_done_${month}`.
import { Transaction } from '../db';
import { getSetting, setSetting, savingsKey } from '../db';

export type MonthReviewData = {
  monthStr: string; // 'YYYY-MM'
  monthLabel: string; // 'MM/YYYY'
  totalIncome: number;
  totalExpense: number;
  savingsTarget: number; // từ Wizard apply (settings budget_savings_${month})
  /** Cân đối = income - expense - savingsTarget. > 0 = dư, < 0 = vượt mức. */
  leftover: number;
  hasData: boolean;
};

/** Compute thống kê tháng cho review modal. */
// v3.108 — Thêm bookId param để lấy savings target đúng book hiện tại
export async function computeMonthReview(
  transactions: Transaction[],
  monthStr: string,
  bookId: number = 1
): Promise<MonthReviewData> {
  const monthTxs = transactions.filter((t) => t.date.startsWith(monthStr));
  const totalIncome = monthTxs
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTxs
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const savingsRaw = await getSetting(savingsKey(bookId, monthStr));
  const savingsTarget = savingsRaw ? parseInt(savingsRaw, 10) || 0 : 0;

  const leftover = totalIncome - totalExpense - savingsTarget;
  const [y, m] = monthStr.split('-');

  return {
    monthStr,
    monthLabel: `${m}/${y}`,
    totalIncome,
    totalExpense,
    savingsTarget,
    leftover,
    hasData: monthTxs.length > 0,
  };
}

/** Quyết định có hiện modal review không cho tháng hiện tại. */
export async function shouldShowMonthReview(
  today: Date,
  transactions: Transaction[]
): Promise<{ show: boolean; monthStr: string }> {
  const day = today.getDate();
  // Chỉ hiện 3 ngày cuối tháng trở đi (>= 28 — đủ cả tháng 2 ngắn nhất)
  if (day < 28) return { show: false, monthStr: '' };

  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const monthStr = `${y}-${m}`;

  // Idempotent — đã review tháng này 1 lần thì không hiện nữa
  const done = await getSetting(`month_review_done_${monthStr}`);
  if (done === '1') return { show: false, monthStr };

  // Chỉ hiện cho người dùng đều: cần ghi chép ở ≥ 3 ngày khác nhau trong tháng.
  // Tránh popup tổng kết ngay khi người mới vừa nhập giao dịch đầu tiên.
  const activeDays = new Set(
    transactions
      .filter((t) => t.date.startsWith(monthStr))
      .map((t) => t.date.slice(0, 10))
  );
  return { show: activeDays.size >= 3, monthStr };
}

/** Mark tháng đã review (để không hiện lại modal). */
export async function markMonthReviewDone(monthStr: string): Promise<void> {
  await setSetting(`month_review_done_${monthStr}`, '1');
}
