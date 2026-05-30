export const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  type TEXT NOT NULL,
  is_default INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  note TEXT,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  month TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  UNIQUE(category_id, month)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);
`;

// Icons = tên Lucide React Native component (KHÔNG dùng emoji).
export const DEFAULT_CATEGORIES = [
  // expense
  { name: 'Ăn uống', icon: 'Utensils', color: '#f59e0b', type: 'expense' },
  { name: 'Tạp hoá', icon: 'ShoppingBag', color: '#10b981', type: 'expense' },
  { name: 'Quần áo', icon: 'Shirt', color: '#3b82f6', type: 'expense' },
  { name: 'Mỹ phẩm', icon: 'Sparkles', color: '#ec4899', type: 'expense' },
  { name: 'Giao lưu', icon: 'Beer', color: '#fbbf24', type: 'expense' },
  { name: 'Y tế', icon: 'Pill', color: '#22c55e', type: 'expense' },
  { name: 'Giáo dục', icon: 'BookOpen', color: '#8b5cf6', type: 'expense' },
  { name: 'Tiền điện', icon: 'Zap', color: '#06b6d4', type: 'expense' },
  { name: 'Đi lại', icon: 'Bus', color: '#ef4444', type: 'expense' },
  { name: 'Đầu tư', icon: 'TrendingUp', color: '#a855f7', type: 'expense' },
  { name: 'Tiền nhà', icon: 'Home', color: '#f97316', type: 'expense' },
  { name: 'Khác', icon: 'MoreHorizontal', color: '#6b7280', type: 'expense' },
  // income
  { name: 'Lương', icon: 'Wallet', color: '#16a34a', type: 'income' },
  { name: 'Thưởng', icon: 'Gift', color: '#dc2626', type: 'income' },
  { name: 'Thu khác', icon: 'Coins', color: '#0891b2', type: 'income' },
];

export const DEFAULT_SETTINGS = [
  { key: 'theme', value: 'mint' }, // mint | grape | sunset | ocean | mono
  { key: 'currency', value: 'VND' },
];
