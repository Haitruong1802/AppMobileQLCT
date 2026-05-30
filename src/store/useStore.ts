import { create } from 'zustand';
import {
  Category,
  Transaction,
  Budget,
  Wallet,
  Book,
  getAllCategories,
  getTransactions,
  addTransaction as dbAdd,
  updateTransaction as dbUpdate,
  deleteTransaction as dbDel,
  addCategory as dbAddCat,
  updateCategory as dbUpdCat,
  deleteCategory as dbDelCat,
  getBudgets,
  setBudget as dbSetBudget,
  deleteBudget as dbDelBudget,
  getAllSettings,
  setSetting as dbSetSetting,
  ensureCategoriesSeeded,
  getWallets,
  addWallet as dbAddWallet,
  updateWallet as dbUpdWallet,
  deleteWallet as dbDelWallet,
  getBooks,
  addBook as dbAddBook,
  updateBook as dbUpdBook,
  deleteBook as dbDelBook,
} from '../db';
import { DEFAULT_CATEGORIES } from '../db/schema';
import { notifyOverBudget, type BudgetThreshold } from '../services/notifications';
import { parsePremiumState } from '../services/premium';
import { recordActivity, recomputeStreak, RecordActivityResult } from '../services/streak';

type State = {
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  wallets: Wallet[];
  books: Book[];
  currentBookId: number;
  currentWalletId: number | null; // null = "Tất cả ví"
  settings: Record<string, string>;
  currentMonth: string; // YYYY-MM
  /** F6 — delta info từ lần addTransaction gần nhất, dùng cho toast/animation. */
  lastStreakDelta: RecordActivityResult | null;
  clearStreakDelta: () => void;

  loadCategories: () => Promise<void>;
  loadTransactions: (opts?: { startDate?: string; endDate?: string }) => Promise<void>;
  addTransaction: (t: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
  updateTransaction: (id: number, t: Partial<Omit<Transaction, 'id' | 'created_at'>>) => Promise<void>;
  deleteTransaction: (id: number) => Promise<void>;
  addCategoryAction: (c: { name: string; icon: string; color: string; type: 'expense' | 'income' }) => Promise<void>;
  updateCategoryAction: (id: number, fields: Partial<Pick<Category, 'name' | 'icon' | 'color' | 'is_visible'>>) => Promise<void>;
  deleteCategoryAction: (id: number) => Promise<{ deleted: boolean; reassigned: number }>;
  loadBudgets: (month?: string) => Promise<void>;
  setBudget: (categoryId: number, amount: number, month?: string) => Promise<void>;
  removeBudget: (categoryId: number, month?: string) => Promise<void>;
  loadSettings: () => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
  setCurrentMonth: (month: string) => void;
  loadWallets: () => Promise<void>;
  addWalletAction: (w: { name: string; icon?: string; color?: string; initial_balance?: number }) => Promise<void>;
  updateWalletAction: (id: number, fields: Partial<Pick<Wallet, 'name' | 'icon' | 'color' | 'initial_balance'>>) => Promise<void>;
  deleteWalletAction: (id: number) => Promise<{ deleted: boolean; reassigned: number }>;
  setCurrentWalletId: (id: number | null) => void;
  loadBooks: () => Promise<void>;
  addBookAction: (b: { name: string; icon?: string; color?: string }) => Promise<void>;
  updateBookAction: (id: number, fields: Partial<Pick<Book, 'name' | 'icon' | 'color'>>) => Promise<void>;
  deleteBookAction: (id: number) => Promise<void>;
  setCurrentBookId: (id: number) => Promise<void>;
};

function currentMonthStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export const useStore = create<State>((set, get) => ({
  categories: [],
  transactions: [],
  budgets: [],
  wallets: [],
  books: [],
  currentBookId: 1,
  currentWalletId: null,
  settings: {},
  currentMonth: currentMonthStr(),
  lastStreakDelta: null,
  clearStreakDelta: () => set({ lastStreakDelta: null }),

  loadCategories: async () => {
    try {
      await ensureCategoriesSeeded();
      // Load ALL categories (kể cả ẩn) — UI filter is_visible khi hiển thị
      const cats = await getAllCategories();
      if (cats.length > 0) {
        // Filter to visible for main use
        set({ categories: cats.filter((c) => (c.is_visible ?? 1) === 1) });
        return;
      }
      console.warn('[store] DB returned 0 categories, using in-memory fallback');
    } catch (e) {
      console.warn('[store] loadCategories error, using in-memory fallback:', e);
    }
    set({
      categories: DEFAULT_CATEGORIES.map((c, i) => ({
        id: i + 1,
        name: c.name,
        icon: c.icon,
        color: c.color,
        type: c.type as 'expense' | 'income',
        is_default: 1,
        is_visible: 1,
      })),
    });
  },
  loadTransactions: async (opts) => {
    set({ transactions: await getTransactions({ ...opts, bookId: get().currentBookId }) });
  },
  addTransaction: async (t) => {
    // v3.56 — Guard: không cho nhập TX với date tương lai
    const todayD = new Date();
    const todayStr = `${todayD.getFullYear()}-${String(todayD.getMonth() + 1).padStart(2, '0')}-${String(todayD.getDate()).padStart(2, '0')}`;
    if (t.date > todayStr) {
      throw new Error('Không thể ghi giao dịch với ngày trong tương lai');
    }
    await dbAdd({ ...t, book_id: get().currentBookId });
    // F6 — record streak activity (idempotent với cùng ngày)
    try {
      const res = await recordActivity(t.date, get().currentBookId);
      set({ lastStreakDelta: res });
    } catch (e) {
      console.warn('[store] streak record fail:', e);
    }
    // F45 — check vượt ngân sách (v3.56: chỉ notify cho TX cùng tháng hiện tại)
    // v3.145 — B1: Pro nhận cảnh báo 80/90/100 (mỗi mốc 1 lần/tháng). Free chỉ 100.
    if (t.type === 'expense') {
      const txMonth = t.date.slice(0, 7);
      const currentMonth = todayStr.slice(0, 7);
      if (txMonth === currentMonth) {
        try {
          const budgets = await getBudgets(txMonth);
          const b = budgets.find((x) => x.category_id === t.category_id);
          if (b) {
            const monthTxs = await getTransactions({
              startDate: `${txMonth}-01`,
              endDate: `${txMonth}-31`,
              bookId: get().currentBookId,
            });
            const totalSpent = monthTxs
              .filter((x) => x.category_id === t.category_id && x.type === 'expense')
              .reduce((s, x) => s + x.amount, 0);
            const spentBefore = totalSpent - t.amount;
            const tier = parsePremiumState(get().settings).tier;
            const thresholds: BudgetThreshold[] = tier === 'pro' ? [80, 90, 100] : [100];
            const cat = get().categories.find((c) => c.id === t.category_id);
            if (cat) {
              for (const threshold of thresholds) {
                const cutPoint = (b.amount * threshold) / 100;
                if (totalSpent >= cutPoint && spentBefore < cutPoint) {
                  const warnKey = `budget_warned_${get().currentBookId}_${t.category_id}_${txMonth}_${threshold}`;
                  if (get().settings[warnKey] === '1') continue;
                  await get().updateSetting(warnKey, '1');
                  await notifyOverBudget({
                    categoryName: cat.name,
                    spent: totalSpent,
                    budget: b.amount,
                    threshold,
                  });
                }
              }
            }
          }
        } catch (e) {
          console.warn('[store] over-budget check fail:', e);
        }
      }
    }
    await get().loadTransactions();
  },
  updateTransaction: async (id, t) => {
    // v3.56 — Guard: không cho update TX sang date tương lai
    if (t.date) {
      const todayD = new Date();
      const todayStr = `${todayD.getFullYear()}-${String(todayD.getMonth() + 1).padStart(2, '0')}-${String(todayD.getDate()).padStart(2, '0')}`;
      if (t.date > todayStr) {
        throw new Error('Không thể ghi giao dịch với ngày trong tương lai');
      }
    }
    await dbUpdate(id, t);
    // v3.43 — recompute streak (có thể đổi date)
    try {
      await recomputeStreak(new Date(), get().currentBookId);
    } catch {
      /* noop */
    }
    await get().loadTransactions();
  },
  deleteTransaction: async (id) => {
    await dbDel(id);
    try {
      await recomputeStreak(new Date(), get().currentBookId);
    } catch {
      /* noop */
    }
    await get().loadTransactions();
  },
  addCategoryAction: async (c) => {
    await dbAddCat(c);
    await get().loadCategories();
  },
  updateCategoryAction: async (id, fields) => {
    await dbUpdCat(id, fields);
    await get().loadCategories();
  },
  deleteCategoryAction: async (id) => {
    const res = await dbDelCat(id);
    await get().loadCategories();
    await get().loadTransactions();
    return res;
  },
  loadBudgets: async (month) => {
    const m = month ?? get().currentMonth;
    set({ budgets: await getBudgets(m, get().currentBookId) });
  },
  setBudget: async (categoryId, amount, month) => {
    const m = month ?? get().currentMonth;
    await dbSetBudget(categoryId, amount, m, get().currentBookId);
    await get().loadBudgets(m);
  },
  removeBudget: async (categoryId, month) => {
    const m = month ?? get().currentMonth;
    // v3.63 — Pass bookId tránh cross-book pollution
    await dbDelBudget(categoryId, m, get().currentBookId);
    await get().loadBudgets(m);
    // v3.62 — Khi xoá xong mà không còn budget nào của tháng → cleanup savings setting + wizard flag
    //         (savings = 1.8tr lưu từ Wizard cũ sẽ vô nghĩa khi user xoá hết budgets).
    const remaining = get().budgets;
    if (remaining.length === 0) {
      try {
        // v3.108 — Cleanup key namespaced theo book hiện tại
        const { setSetting, savingsKey, wizardAppliedKey } = await import('../db');
        const bid = get().currentBookId;
        await setSetting(savingsKey(bid, m), '');
        await setSetting(wizardAppliedKey(bid, m), '');
      } catch (e) {
        console.warn('[store] cleanup savings settings fail:', e);
      }
    }
  },
  loadSettings: async () => {
    set({ settings: await getAllSettings() });
  },
  updateSetting: async (key, value) => {
    await dbSetSetting(key, value);
    set({ settings: { ...get().settings, [key]: value } });
  },
  setCurrentMonth: (month) => {
    set({ currentMonth: month });
  },
  loadWallets: async () => {
    try {
      const list = await getWallets(get().currentBookId);
      set({ wallets: list });
    } catch (e) {
      console.warn('[store] loadWallets fail:', e);
    }
  },
  addWalletAction: async (w) => {
    await dbAddWallet({ ...w, book_id: get().currentBookId });
    await get().loadWallets();
  },
  updateWalletAction: async (id, fields) => {
    await dbUpdWallet(id, fields);
    await get().loadWallets();
  },
  deleteWalletAction: async (id) => {
    const res = await dbDelWallet(id);
    await get().loadWallets();
    await get().loadTransactions();
    // Reset currentWalletId nếu đã xoá
    if (get().currentWalletId === id) set({ currentWalletId: null });
    return res;
  },
  setCurrentWalletId: (id) => {
    set({ currentWalletId: id });
  },
  loadBooks: async () => {
    try {
      const list = await getBooks();
      set({ books: list });
      // Ensure currentBookId valid
      if (!list.find((b) => b.id === get().currentBookId)) {
        const def = list.find((b) => b.is_default === 1) || list[0];
        if (def) set({ currentBookId: def.id });
      }
    } catch (e) {
      console.warn('[store] loadBooks fail:', e);
    }
  },
  addBookAction: async (b) => {
    await dbAddBook(b);
    await get().loadBooks();
  },
  updateBookAction: async (id, fields) => {
    await dbUpdBook(id, fields);
    await get().loadBooks();
  },
  deleteBookAction: async (id) => {
    await dbDelBook(id);
    await get().loadBooks();
    // Nếu currentBookId vừa bị xoá → switch sang default
    if (get().currentBookId === id) {
      const def = get().books.find((b) => b.is_default === 1) || get().books[0];
      if (def) {
        await get().setCurrentBookId(def.id);
      }
    }
  },
  setCurrentBookId: async (id) => {
    set({ currentBookId: id, currentWalletId: null });
    // Reload all data theo book mới
    await get().loadWallets();
    await get().loadTransactions();
    await get().loadBudgets();
  },
}));
