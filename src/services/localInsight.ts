// Local engine — template-based, KHÔNG dùng AI/Gemini.
// Sinh coach + monthly report từ rules + variation để output đa dạng.
// v3.100 — Define MonthlyReport ở đây sau khi xoá gemini.ts (app 100% offline).
export type MonthlyReport = {
  summary: string;
  anomalies: string[];
  suggestions: string[];
  savings_target: string;
};

function vnd(n: number): string {
  return Math.round(n).toLocaleString('vi-VN') + 'đ';
}

function pct(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 100);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface CoachContext {
  totalExpenseMonth: number;
  totalIncomeMonth: number;
  topCategories: { name: string; amount: number }[];
  daysIntoMonth: number;
  totalDaysInMonth: number;
}

/**
 * Sinh 1 câu coach insight chuyên nghiệp dựa trên số liệu tháng.
 * Output 50-120 ký tự, có số liệu cụ thể, không quotes/emoji.
 */
export function generateLocalCoach(ctx: CoachContext): string {
  const { totalExpenseMonth, totalIncomeMonth, topCategories, daysIntoMonth, totalDaysInMonth } = ctx;

  const monthProgress = totalDaysInMonth > 0 ? daysIntoMonth / totalDaysInMonth : 0;
  const spendingRate = totalIncomeMonth > 0 ? totalExpenseMonth / totalIncomeMonth : 0;

  const candidates: string[] = [];

  // Rule 1: Chi vượt thu (cảnh báo cao)
  if (totalIncomeMonth > 0 && totalExpenseMonth > totalIncomeMonth) {
    const over = totalExpenseMonth - totalIncomeMonth;
    candidates.push(
      `Chi tháng này đang vượt thu ${vnd(over)}, cần kiểm soát chi tiêu phần còn lại.`
    );
    candidates.push(
      `Đã chi ${vnd(totalExpenseMonth)} so với thu ${vnd(totalIncomeMonth)}, thâm hụt ${vnd(over)}.`
    );
  }

  // Rule 2: Chi % > tháng (chi nhanh hơn ngày)
  if (totalIncomeMonth > 0 && spendingRate > monthProgress + 0.15 && monthProgress < 0.95) {
    const pctSpent = pct(totalExpenseMonth, totalIncomeMonth);
    const pctMonth = Math.round(monthProgress * 100);
    candidates.push(
      `Đã chi ${pctSpent}% thu nhập nhưng mới qua ${pctMonth}% tháng, cần cẩn trọng phần còn lại.`
    );
  }

  // Rule 3: Top category chiếm > 40%
  if (topCategories.length > 0 && totalExpenseMonth > 0) {
    const top = topCategories[0];
    const topPct = pct(top.amount, totalExpenseMonth);
    if (topPct >= 40) {
      candidates.push(
        `${top.name} chiếm ${topPct}% tổng chi (${vnd(top.amount)}), là khoản lớn nhất tháng này.`
      );
    } else if (topPct >= 25) {
      candidates.push(
        `${top.name} đứng đầu danh mục chi với ${vnd(top.amount)} (${topPct}% tổng).`
      );
    }
  }

  // Rule 4: Tiết kiệm tốt
  if (totalIncomeMonth > 0 && spendingRate < 0.5 && monthProgress > 0.5) {
    const saved = totalIncomeMonth - totalExpenseMonth;
    candidates.push(
      `Đã tiết kiệm được ${vnd(saved)} tháng này, tốc độ chi tiêu trong tầm kiểm soát.`
    );
  }

  // Rule 5: Trung bình ngày
  if (daysIntoMonth > 0 && totalExpenseMonth > 0) {
    const avgPerDay = Math.round(totalExpenseMonth / daysIntoMonth);
    candidates.push(
      `Trung bình chi ${vnd(avgPerDay)} mỗi ngày trong ${daysIntoMonth} ngày qua.`
    );
  }

  // Fallback
  if (candidates.length === 0) {
    candidates.push(
      `Tháng này ghi nhận thu ${vnd(totalIncomeMonth)} và chi ${vnd(totalExpenseMonth)}.`
    );
    candidates.push(`Hãy ghi thêm giao dịch để có nhận xét chi tiết hơn.`);
  }

  return pickRandom(candidates);
}

interface ReportContext {
  month: string;
  totalExpense: number;
  totalIncome: number;
  topCategories: { name: string; amount: number; pct: number }[];
  prevMonthExpense: number;
  prevMonthIncome: number;
  txCount: number;
  daysInMonth: number;
  biggestTx?: { category: string; amount: number; note: string };
}

/**
 * Sinh báo cáo tháng đầy đủ 4 sections từ số liệu — KHÔNG cần API.
 * Output structured theo type MonthlyReport (định nghĩa ở đầu file).
 */
export function generateLocalReport(ctx: ReportContext): MonthlyReport {
  const {
    totalExpense,
    totalIncome,
    topCategories,
    prevMonthExpense,
    txCount,
    biggestTx,
  } = ctx;

  const diff = totalExpense - prevMonthExpense;
  const diffPct = prevMonthExpense > 0 ? Math.round((diff / prevMonthExpense) * 100) : 0;
  const savingsMonth = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? totalExpense / totalIncome : 0;

  // === SUMMARY ===
  const summaryParts: string[] = [];
  summaryParts.push(
    `Tháng này thu ${vnd(totalIncome)}, chi ${vnd(totalExpense)} qua ${txCount} giao dịch.`
  );
  if (prevMonthExpense > 0) {
    if (diff > 0) {
      summaryParts.push(`Chi tiêu tăng ${diffPct}% so với tháng trước (${vnd(prevMonthExpense)}).`);
    } else if (diff < 0) {
      summaryParts.push(
        `Chi tiêu giảm ${Math.abs(diffPct)}% so với tháng trước (${vnd(prevMonthExpense)}).`
      );
    }
  }
  if (totalIncome > 0) {
    if (savingsRate > 1) {
      summaryParts.push(`Đã chi vượt thu ${vnd(totalExpense - totalIncome)}.`);
    } else if (savingsRate < 0.6 && savingsMonth > 0) {
      summaryParts.push(`Tiết kiệm được ${vnd(savingsMonth)} (${Math.round((1 - savingsRate) * 100)}% thu nhập).`);
    }
  }
  const summary = summaryParts.join(' ');

  // === ANOMALIES ===
  const anomalies: string[] = [];
  if (totalIncome > 0 && totalExpense > totalIncome) {
    anomalies.push(`Chi vượt thu ${vnd(totalExpense - totalIncome)}, cần điều chỉnh kế hoạch tài chính.`);
  }
  if (prevMonthExpense > 0 && diffPct > 30) {
    anomalies.push(`Tổng chi tăng đột biến ${diffPct}% so với tháng trước.`);
  }
  if (topCategories.length > 0) {
    const top = topCategories[0];
    if (top.pct >= 45) {
      anomalies.push(
        `${top.name} chiếm ${Math.round(top.pct)}% tổng chi (${vnd(top.amount)}), tỷ trọng cao bất thường.`
      );
    }
  }
  if (biggestTx && biggestTx.amount > totalExpense * 0.3 && biggestTx.amount > 1_000_000) {
    anomalies.push(
      `Giao dịch lớn nhất tháng: ${biggestTx.category} ${vnd(biggestTx.amount)}${biggestTx.note ? ` (${biggestTx.note})` : ''}.`
    );
  }

  // === SUGGESTIONS ===
  const suggestions: string[] = [];
  // Top 3 categories — suggest giảm 20%
  for (const cat of topCategories.slice(0, 3)) {
    if (cat.amount < 100_000) continue;
    const target = Math.round(cat.amount * 0.8);
    const save = cat.amount - target;
    suggestions.push(
      `Đặt mục tiêu ${cat.name} ≤ ${vnd(target)}/tháng (giảm 20%), tiết kiệm ${vnd(save)}/tháng.`
    );
  }
  // Nếu chi > thu → suggest cắt category lớn nhất
  if (totalIncome > 0 && totalExpense > totalIncome && topCategories[0]) {
    const cut = Math.min(
      topCategories[0].amount * 0.3,
      totalExpense - totalIncome
    );
    suggestions.push(
      `Cân bằng thu chi bằng cách giảm ${vnd(cut)} ở ${topCategories[0].name}.`
    );
  }
  // Nếu chi tăng > 20% so tháng trước → cảnh báo
  if (prevMonthExpense > 0 && diffPct > 20) {
    suggestions.push(
      `Đặt ngân sách tháng sau bằng tháng trước (${vnd(prevMonthExpense)}) để kiểm soát chi tiêu.`
    );
  }
  // Tiết kiệm khoản dư
  if (savingsMonth > 500_000) {
    suggestions.push(
      `Chuyển ${vnd(Math.round(savingsMonth * 0.5))} (50% phần dư) vào mục tiêu tiết kiệm thay vì để tự do.`
    );
  }
  if (suggestions.length === 0) {
    suggestions.push(`Tiếp tục theo dõi để có dữ liệu phân tích sâu hơn tháng sau.`);
  }

  // === SAVINGS TARGET ===
  let savingsTarget = '';
  if (totalExpense > 0) {
    const monthly20 = Math.round(totalExpense * 0.2);
    const yearly = monthly20 * 12;
    savingsTarget = `Nếu giảm 20% chi tiêu (${vnd(monthly20)}/tháng), một năm tiết kiệm được ${vnd(yearly)}.`;
  } else {
    savingsTarget = `Hãy ghi thêm giao dịch để có gợi ý tiết kiệm chính xác.`;
  }

  return {
    summary: summary || `Chưa đủ dữ liệu để phân tích.`,
    anomalies,
    suggestions: suggestions.slice(0, 4),
    savings_target: savingsTarget,
  };
}
