// v3.40 — Budget Recommender: gợi ý phân bổ ngân sách theo quy tắc 50/30/20 + history.
// v3.92 — 3 quy tắc cho user chọn: Cân bằng / Tiết kiệm mạnh / Thoải mái.
// Rule-based, KHÔNG AI. Input: income + fixed + savings target + rule. Output: budget mỗi category.
import { Category, Transaction } from '../db';

/** 3 quy tắc phân bổ ngân sách cho user chọn. needs+wants+savings = 100. */
export type BudgetRuleId = '50/30/20' | '40/30/30' | '60/30/10';

export type BudgetRule = {
  id: BudgetRuleId;
  name: string;
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
  /** Subtitle hiển thị trên card. */
  subtitle: string;
};

export const BUDGET_RULES: BudgetRule[] = [
  {
    id: '50/30/20',
    name: 'Cân bằng',
    needsPct: 50,
    wantsPct: 30,
    savingsPct: 20,
    subtitle: 'Quy tắc kinh điển, phân chia hợp lý giữa chi tiêu và tiết kiệm',
  },
  {
    id: '40/30/30',
    name: 'Tiết kiệm mạnh',
    needsPct: 40,
    wantsPct: 30,
    savingsPct: 30,
    subtitle: 'Đạt mục tiêu lớn nhanh, phù hợp người có thu nhập ổn định',
  },
  {
    id: '60/30/10',
    name: 'Thoải mái',
    needsPct: 60,
    wantsPct: 30,
    savingsPct: 10,
    subtitle: 'Chi tiêu nhiều hơn, phù hợp giai đoạn cần đầu tư bản thân',
  },
];

export function getBudgetRule(id: BudgetRuleId): BudgetRule {
  return BUDGET_RULES.find((r) => r.id === id) ?? BUDGET_RULES[0];
}

/** Phân loại category vào nhóm NEEDS/WANTS theo tên default. */
export type CategoryGroup = 'needs' | 'wants' | 'fixed';

// v3.42: Move "Ăn uống" về NEEDS vì ở VN đây là daily essential (không phải wants).
// Pattern này hợp thực tế VN hơn 50/30/20 gốc Mỹ.
const NEEDS_CATS = new Set([
  'Tiền nhà', 'Ăn uống', 'Tạp hoá', 'Tiền điện', 'Đi lại', 'Y tế', 'Đầu tư',
]);
const WANTS_CATS = new Set(['Giao lưu', 'Quần áo', 'Mỹ phẩm', 'Giáo dục', 'Khác']);

/** Default split tỷ lệ trong nhóm wants (% của tổng wants).
 * VN-tuned: Giao lưu là khoản WANTS lớn nhất (cafe, nhậu, party). */
const WANTS_DEFAULT_RATIO: Record<string, number> = {
  'Giao lưu': 0.3,
  'Quần áo': 0.25,
  'Giáo dục': 0.2,
  'Mỹ phẩm': 0.15,
  'Khác': 0.1,
};

/** Default split trong nhóm needs (sau khi trừ fixed expenses).
 * VN-tuned: Ăn uống là khoản LỚN NHẤT (40%), Tạp hoá thứ 2 (25%).
 * KHÔNG include "Tiền nhà" vì khoản này phụ thuộc user thực tế (3-15tr+) → cần user nhập ở Step 2. */
const NEEDS_DEFAULT_RATIO: Record<string, number> = {
  'Ăn uống': 0.4,
  'Tạp hoá': 0.25,
  'Đi lại': 0.15,
  'Y tế': 0.1,
  'Đầu tư': 0.06,
  'Tiền điện': 0.04,
};

/** Các category KHÔNG được auto-allocate nếu không có history.
 * Lý do: số tiền phụ thuộc nhiều vào user thực tế (vd Tiền nhà 3-15tr).
 * User nên ADD vào Step 2 (chi cố định) nếu thực sự có. */
const REQUIRE_USER_INPUT_CATS = new Set(['Tiền nhà']);

export type RecommendInput = {
  income: number;
  /** Chi cố định đã biết (recurring + bills). Mỗi item gắn vào 1 category cụ thể. */
  fixedExpenses: { categoryId: number; amount: number }[];
  /** Target tiết kiệm hàng tháng. */
  savingsTarget: number;
  /** Categories full list (để map id ↔ name). */
  categories: Category[];
  /** Optional 3 tháng transactions trước để personalize. */
  history?: Transaction[];
  /** v3.92 — Quy tắc phân bổ user chọn. Default '50/30/20'. */
  ruleId?: BudgetRuleId;
};

export type RecommendItem = {
  categoryId: number;
  categoryName: string;
  group: CategoryGroup;
  recommended: number;
  ratioOfIncome: number; // 0-1
  reason: string;
  /** Là chi cố định (không thay đổi được). */
  isFixed: boolean;
};

export type RecommendResult = {
  /** Tổng thu nhập. */
  income: number;
  /** Tổng chi cố định. */
  totalFixed: number;
  /** Mục tiêu tiết kiệm. */
  savingsTarget: number;
  /** Số tiền còn lại cho biến (sau khi trừ fixed + savings). */
  availableVariable: number;
  /** Items cho từng category expense. */
  items: RecommendItem[];
  /** True nếu config âm — fixed + savings > income. */
  isInfeasible: boolean;
  /** Cảnh báo (nếu có). */
  warning?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Compute monthly spend per category từ history N tháng gần đây. */
function avgSpendByCategory(
  history: Transaction[],
  monthsBack: number = 3
): Record<number, number> {
  const today = new Date();
  // Lấy các tháng monthsBack trước
  const monthKeys: string[] = [];
  for (let i = 1; i <= monthsBack; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  }

  const totals: Record<number, number> = {};
  for (const t of history) {
    if (t.type !== 'expense') continue;
    const mk = t.date.slice(0, 7);
    if (!monthKeys.includes(mk)) continue;
    totals[t.category_id] = (totals[t.category_id] || 0) + t.amount;
  }
  // Chia trung bình tháng
  const avg: Record<number, number> = {};
  for (const [cid, total] of Object.entries(totals)) {
    avg[parseInt(cid, 10)] = total / monthsBack;
  }
  return avg;
}

/** Round bội 10k để budget hiển thị đẹp. */
function roundBudget(n: number): number {
  if (n >= 100_000) return Math.floor(n / 10_000) * 10_000;
  if (n >= 10_000) return Math.floor(n / 5_000) * 5_000;
  return Math.floor(n / 1_000) * 1_000;
}

export function recommendBudget(input: RecommendInput): RecommendResult {
  const { income, fixedExpenses, savingsTarget, categories, history } = input;
  const catById = new Map(categories.map((c) => [c.id, c]));

  const totalFixed = fixedExpenses.reduce((s, x) => s + x.amount, 0);
  const availableAfterFixedSavings = income - totalFixed - savingsTarget;
  const isInfeasible = availableAfterFixedSavings < 0;

  const items: RecommendItem[] = [];

  // 1. Thêm fixed expenses vào items (đã định sẵn)
  for (const fx of fixedExpenses) {
    const cat = catById.get(fx.categoryId);
    if (!cat) continue;
    items.push({
      categoryId: fx.categoryId,
      categoryName: cat.name,
      group: 'fixed',
      recommended: fx.amount,
      ratioOfIncome: income > 0 ? fx.amount / income : 0,
      reason: 'Chi cố định (giao dịch lặp hoặc hoá đơn)',
      isFixed: true,
    });
  }

  if (isInfeasible) {
    return {
      income,
      totalFixed,
      savingsTarget,
      availableVariable: availableAfterFixedSavings,
      items,
      isInfeasible: true,
      warning: 'Chi cố định + tiết kiệm vượt thu nhập. Cần giảm 1 trong 2.',
    };
  }

  // 2. Categories expense chưa có fixed → cần allocate từ availableVariable
  const fixedCatIds = new Set(fixedExpenses.map((f) => f.categoryId));
  const expenseCatsNeedAllocate = categories.filter(
    (c) => c.type === 'expense' && !fixedCatIds.has(c.id) && (c.is_visible ?? 1) === 1
  );

  // 3. Phân chia NEEDS vs WANTS
  const needsCats = expenseCatsNeedAllocate.filter((c) => NEEDS_CATS.has(c.name));
  const wantsCats = expenseCatsNeedAllocate.filter((c) => WANTS_CATS.has(c.name));

  // v3.92 — Quy tắc động (50/30/20 default, hoặc 40/30/30, 60/30/10)
  const rule = getBudgetRule(input.ruleId ?? '50/30/20');
  const idealNeeds = income * (rule.needsPct / 100);
  const idealWants = income * (rule.wantsPct / 100);
  const fixedAsNeeds = fixedExpenses.reduce((s, fx) => {
    const cat = catById.get(fx.categoryId);
    return s + (cat && NEEDS_CATS.has(cat.name) ? fx.amount : 0);
  }, 0);
  let needsBudget = Math.max(0, idealNeeds - fixedAsNeeds);
  let wantsBudget = idealWants;

  // v3.61 — Savings = EXACT user-chosen, KHÔNG scale up/down.
  //         Extra (nếu có) chia 50/50 vào needs/wants. Scale down nếu over.
  //         Trước (v3.50): dồn extra vào savings → bug đại ca chọn 10% (900k) ra 1.8tr.
  const finalSavings = savingsTarget;
  const totalIdeal = needsBudget + wantsBudget;
  if (totalIdeal > availableAfterFixedSavings) {
    const scale = availableAfterFixedSavings / totalIdeal;
    needsBudget *= scale;
    wantsBudget *= scale;
  } else if (totalIdeal < availableAfterFixedSavings) {
    const extra = availableAfterFixedSavings - totalIdeal;
    needsBudget += extra * 0.5;
    wantsBudget += extra * 0.5;
  }

  // 4. Phân chia trong needsBudget cho từng needs category
  // Nếu có history → dùng tỷ lệ history. Else dùng default.
  const historyAvg = history ? avgSpendByCategory(history) : {};

  function allocateGroup(
    cats: Category[],
    totalBudget: number,
    defaultRatios: Record<string, number>,
    group: CategoryGroup
  ): void {
    if (cats.length === 0 || totalBudget <= 0) return;

    // Tính tổng historical spend của các cat này
    const historyTotal = cats.reduce((s, c) => s + (historyAvg[c.id] || 0), 0);

    let allocated = 0;
    const lastIdx = cats.length - 1;
    cats.forEach((c, idx) => {
      let amount: number;
      let reason: string;

      // Skip auto-allocate cho category cần user nhập (vd Tiền nhà)
      if (REQUIRE_USER_INPUT_CATS.has(c.name) && (historyAvg[c.id] || 0) === 0) {
        amount = 0;
        reason = 'Hãy thêm vào "Chi cố định" ở Bước 2 với số tiền thực tế';
        items.push({
          categoryId: c.id,
          categoryName: c.name,
          group,
          recommended: 0,
          ratioOfIncome: 0,
          reason,
          isFixed: false,
        });
        return;
      }

      if (historyTotal > 0 && historyAvg[c.id] !== undefined) {
        // Use history ratio
        const ratio = (historyAvg[c.id] || 0) / historyTotal;
        amount = roundBudget(totalBudget * ratio);
        reason = `Dựa 3 tháng trước, ${c.name} chiếm ${Math.round(ratio * 100)}% nhóm này`;
      } else {
        // Use default
        const ratio = defaultRatios[c.name] ?? 1 / cats.length;
        amount = roundBudget(totalBudget * ratio);
        reason = `Quy tắc ${rule.id}: ${c.name} ~${Math.round(ratio * 100)}% nhóm`;
      }

      // Cat cuối nhận phần còn dư để tổng đúng
      if (idx === lastIdx) {
        amount = Math.max(0, totalBudget - allocated);
        amount = roundBudget(amount);
      }
      allocated += amount;

      items.push({
        categoryId: c.id,
        categoryName: c.name,
        group,
        recommended: amount,
        ratioOfIncome: income > 0 ? amount / income : 0,
        reason,
        isFixed: false,
      });
    });
  }

  allocateGroup(needsCats, needsBudget, NEEDS_DEFAULT_RATIO, 'needs');
  allocateGroup(wantsCats, wantsBudget, WANTS_DEFAULT_RATIO, 'wants');

  return {
    income,
    totalFixed,
    savingsTarget: finalSavings,
    availableVariable: availableAfterFixedSavings,
    items,
    isInfeasible: false,
  };
}

/** Auto-detect income từ TX tháng gần nhất. */
export function detectIncomeFromHistory(history: Transaction[]): number {
  // Lấy tháng gần nhất có income > 0
  const today = new Date();
  for (let back = 0; back < 6; back++) {
    const d = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const mk = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    let sum = 0;
    for (const t of history) {
      if (t.type === 'income' && t.date.startsWith(mk)) sum += t.amount;
    }
    if (sum > 0) return sum;
  }
  return 0;
}
