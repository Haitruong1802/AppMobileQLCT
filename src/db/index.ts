import * as SQLite from 'expo-sqlite';
import { SCHEMA, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './schema';

let _db: SQLite.SQLiteDatabase | null = null;
let _initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const DB_VERSION = 2; // bump khi đổi schema/seed
const SCHEMA_STATEMENTS = SCHEMA.split(';').map((s) => s.trim()).filter(Boolean);

export async function getDb() {
  if (_db) return _db;
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const db = await SQLite.openDatabaseAsync('bopai.db');
    // v3.119 — Bật FK enforcement ngay từ đầu (mặc định OFF trong SQLite)
    try {
      await db.execAsync('PRAGMA foreign_keys = ON');
    } catch (e) {
      console.warn('[bopai-db] PRAGMA fail:', e);
    }
    // Mỗi CREATE TABLE riêng để fail một câu không kéo cả batch
    for (const stmt of SCHEMA_STATEMENTS) {
      try {
        await db.execAsync(stmt);
      } catch (e) {
        console.warn('[bopai-db] schema stmt fail:', stmt.slice(0, 60), e);
      }
    }
    // v3.108 — Xoá schema bảng ai_usage (F11) orphan. User DB cũ có table → giữ nguyên (idempotent, không cần DROP).
    // Schema v3 (F23): thêm cột is_visible cho categories — soft delete default cats
    try {
      await db.execAsync('ALTER TABLE categories ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 1');
    } catch {
      // Column đã tồn tại — bỏ qua
    }
    // v3.120 — Schema: is_impulse flag cho category, cool-down (F9) check theo column thay vì hardcode tên VN.
    try {
      await db.execAsync('ALTER TABLE categories ADD COLUMN is_impulse INTEGER NOT NULL DEFAULT 0');
    } catch {
      /* column exists */
    }
    // Schema v10: source tracking — biết transaction từ đâu (manual/bill/recurring/transfer/scan)
    try {
      await db.execAsync('ALTER TABLE transactions ADD COLUMN source TEXT');
    } catch {
      /* column exists */
    }
    try {
      await db.execAsync('ALTER TABLE transactions ADD COLUMN source_id INTEGER');
    } catch {
      /* column exists */
    }

    // Schema v9 (F54): bills — hoá đơn sắp đến hạn (tiền nhà, internet, gói data...)
    try {
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS bills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          amount INTEGER NOT NULL,
          due_date TEXT NOT NULL,
          category_id INTEGER,
          repeat_period TEXT,
          paid_at TEXT,
          notify_days_before INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      );
    } catch (e) {
      console.warn('[bopai-db] bills stmt fail:', e);
    }

    // Schema v8 (F35): photo attachment cho transactions
    try {
      await db.execAsync('ALTER TABLE transactions ADD COLUMN photo_uri TEXT');
    } catch {
      /* column exists */
    }

    // Schema v7 (F47): category patterns — học từ user history
    try {
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS category_patterns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          keyword TEXT NOT NULL,
          category_id INTEGER NOT NULL,
          count INTEGER NOT NULL DEFAULT 1,
          last_used TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(keyword, category_id)
        )`
      );
    } catch (e) {
      console.warn('[bopai-db] category_patterns stmt fail:', e);
    }

    // Schema v11 (F58): multi-book — 1 user nhiều sổ riêng (Cá nhân / Gia đình / Cửa hàng)
    try {
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS books (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          icon TEXT NOT NULL DEFAULT 'Wallet',
          color TEXT NOT NULL DEFAULT '#10b981',
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      );
    } catch (e) {
      console.warn('[bopai-db] books stmt fail:', e);
    }
    // NOTE v3.22: ALTER book_id phải chạy SAU CREATE TABLE wallets/savings_goals/recurring_rules
    // (đã move xuống cuối getDb()). Bug v3.21 trên máy mới cài: ALTER chạy trước CREATE → fail caught →
    // CREATE TABLE không có book_id → INSERT crash "table wallets has no column named book_id".
    // Seed default book
    try {
      const w = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM books');
      if (!w || w.count === 0) {
        await db.runAsync(
          'INSERT INTO books (id, name, icon, color, is_default) VALUES (?, ?, ?, ?, ?)',
          [1, 'Sổ Cá nhân', 'Wallet', '#10b981', 1]
        );
      }
    } catch (e) {
      console.warn('[bopai-db] books seed fail:', e);
    }

    // Schema v6 (F32): multi-wallet
    try {
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS wallets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          icon TEXT NOT NULL DEFAULT 'Wallet',
          color TEXT NOT NULL DEFAULT '#10b981',
          initial_balance INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      );
    } catch (e) {
      console.warn('[bopai-db] wallets stmt fail:', e);
    }
    try {
      await db.execAsync('ALTER TABLE transactions ADD COLUMN wallet_id INTEGER NOT NULL DEFAULT 1');
    } catch {
      /* column exists — bỏ qua */
    }
    // Seed default wallet "Ví chính" nếu chưa có
    try {
      const w = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM wallets');
      if (!w || w.count === 0) {
        await db.runAsync(
          'INSERT INTO wallets (name, icon, color, initial_balance, sort_order, is_default) VALUES (?, ?, ?, ?, ?, ?)',
          ['Ví chính', 'Wallet', '#10b981', 0, 0, 1]
        );
      }
    } catch (e) {
      console.warn('[bopai-db] wallets seed fail:', e);
    }

    // Schema v5 (F26): savings goals
    try {
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS savings_goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          target INTEGER NOT NULL,
          current INTEGER NOT NULL DEFAULT 0,
          deadline TEXT,
          icon TEXT NOT NULL DEFAULT 'Gift',
          color TEXT NOT NULL DEFAULT '#10b981',
          completed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      );
    } catch (e) {
      console.warn('[bopai-db] savings_goals stmt fail:', e);
    }
    // Schema v12 (F6): streak — chuỗi ngày ghi sổ liên tiếp + freeze pass + badge milestones
    try {
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS streaks (
          id INTEGER PRIMARY KEY,
          current_streak INTEGER NOT NULL DEFAULT 0,
          longest_streak INTEGER NOT NULL DEFAULT 0,
          last_active_date TEXT,
          freeze_passes INTEGER NOT NULL DEFAULT 1,
          freeze_pass_week TEXT,
          badges TEXT NOT NULL DEFAULT '[]'
        )`
      );
      // Ensure single row id=1
      const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM streaks');
      if (!row || row.count === 0) {
        await db.runAsync(
          'INSERT INTO streaks (id, current_streak, longest_streak, freeze_passes, badges) VALUES (1, 0, 0, 1, ?)',
          ['[]']
        );
      }
    } catch (e) {
      console.warn('[bopai-db] streaks stmt fail:', e);
    }

    // Schema v4 (F24): recurring rules
    try {
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS recurring_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount INTEGER NOT NULL,
          category_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          note TEXT,
          frequency TEXT NOT NULL,
          next_run TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1,
          last_run TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      );
    } catch (e) {
      console.warn('[bopai-db] recurring_rules stmt fail:', e);
    }

    // v3.22: ALTER book_id CHẠY SAU TẤT CẢ CREATE TABLE (fix bug "table X has no column named book_id"
    // trên máy mới cài lần đầu)
    for (const tbl of ['wallets', 'transactions', 'budgets', 'bills', 'savings_goals', 'recurring_rules']) {
      try {
        await db.execAsync(`ALTER TABLE ${tbl} ADD COLUMN book_id INTEGER NOT NULL DEFAULT 1`);
      } catch {
        /* column exists — bỏ qua */
      }
    }

    // Schema v13 (Active Savings): snapshot mỗi ngày để track safe, expense, allocated
    try {
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS daily_snapshots (
          date TEXT PRIMARY KEY,
          safe_amount INTEGER NOT NULL,
          expense_amount INTEGER NOT NULL DEFAULT 0,
          auto_allocated INTEGER NOT NULL DEFAULT 0,
          manual_added INTEGER NOT NULL DEFAULT 0,
          suggested_handled INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      );
    } catch (e) {
      console.warn('[bopai-db] daily_snapshots stmt fail:', e);
    }

    // v3.110 — Composite index cho streak query (recomputeStreak SELECT DISTINCT DATE WHERE book_id=?)
    //   User 10k+ TX có thể chậm khi boot/focus tab. Index giúp tra cứu nhanh.
    try {
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_tx_book_created ON transactions(book_id, created_at)');
    } catch (e) {
      console.warn('[bopai-db] create idx_tx_book_created fail:', e);
    }
    // v3.121 — Thêm index cho pie chart (category+type) + wallet balance + bill due_date
    try {
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_tx_category_type ON transactions(category_id, type)');
    } catch (e) {
      console.warn('[bopai-db] create idx_tx_category_type fail:', e);
    }
    try {
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_tx_wallet_date ON transactions(wallet_id, date)');
    } catch (e) {
      console.warn('[bopai-db] create idx_tx_wallet_date fail:', e);
    }
    try {
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_bills_due ON bills(due_date)');
    } catch (e) {
      console.warn('[bopai-db] create idx_bills_due fail:', e);
    }

    await seedIfEmpty(db);

    // v3.94 — Migration 1-lần: đổi category "Phí liên lạc" → "Đầu tư" (đại ca yêu cầu 24/5)
    try {
      const migRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'cat_invest_rename_v1'"
      );
      if (!migRow || migRow.value !== '1') {
        // v3.119 — Giới hạn rename chỉ cho default category, tránh đè custom của user trùng tên
        await db.runAsync(
          "UPDATE categories SET name = 'Đầu tư', icon = 'TrendingUp' WHERE name = 'Phí liên lạc' AND type = 'expense' AND is_default = 1"
        );
        // v3.120 — Đánh dấu 4 default category dễ tiêu xài bốc đồng (Cool-down trigger)
        await db.runAsync(
          "UPDATE categories SET is_impulse = 1 WHERE is_default = 1 AND name IN ('Quần áo', 'Mỹ phẩm', 'Giao lưu', 'Tạp hoá')"
        );
        await db.runAsync(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('cat_invest_rename_v1', '1')"
        );
      }
    } catch (e) {
      console.warn('[bopai-db] migration cat_invest_rename fail:', e);
    }

    // v3.108 — Migration: namespace savings settings theo book_id (Fix HIGH A multi-book leak)
    //   Setting cũ `budget_savings_${month}` + `wizard_goal_applied_${month}` shared global
    //   → copy sang key mới `budget_savings_${bookId}_${month}` với bookId=1 (default book).
    try {
      const ns = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'savings_book_ns_v2'"
      );
      if (!ns || ns.value !== '1') {
        // Copy old keys → new namespaced keys (bookId=1 default cho single-book user cũ)
        await db.runAsync(`
          INSERT OR IGNORE INTO settings (key, value)
          SELECT 'budget_savings_1_' || SUBSTR(key, LENGTH('budget_savings_') + 1) AS new_key, value
          FROM settings WHERE key LIKE 'budget_savings_____-__'
        `);
        await db.runAsync(`
          INSERT OR IGNORE INTO settings (key, value)
          SELECT 'wizard_goal_applied_1_' || SUBSTR(key, LENGTH('wizard_goal_applied_') + 1) AS new_key, value
          FROM settings WHERE key LIKE 'wizard_goal_applied_____-__'
        `);
        // v3.109 — Cleanup keys cũ sau migrate (giảm phình settings table)
        await db.runAsync("DELETE FROM settings WHERE key LIKE 'budget_savings_____-__'");
        await db.runAsync("DELETE FROM settings WHERE key LIKE 'wizard_goal_applied_____-__'");
        await db.runAsync(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('savings_book_ns_v2', '1')"
        );
      }
    } catch (e) {
      console.warn('[bopai-db] migration savings_book_ns fail:', e);
    }

    _db = db;
    return db;
  })();
  try {
    return await _initPromise;
  } finally {
    _initPromise = null;
  }
}

async function seedIfEmpty(db: SQLite.SQLiteDatabase) {
  try {
    const catRow = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM categories'
    );
    if (!catRow || catRow.count === 0) {
      if (__DEV__) console.log('[bopai-db] seeding default categories');
      for (const c of DEFAULT_CATEGORIES) {
        try {
          await db.runAsync(
            'INSERT INTO categories (name, icon, color, type, is_default) VALUES (?, ?, ?, ?, 1)',
            [c.name, c.icon, c.color, c.type]
          );
        } catch (e) {
          console.warn('[bopai-db] insert cat fail:', c.name, e);
        }
      }
    }
  } catch (e) {
    console.warn('[bopai-db] seed categories fail:', e);
  }
  try {
    const setRow = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM settings'
    );
    if (!setRow || setRow.count === 0) {
      for (const s of DEFAULT_SETTINGS) {
        await db.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [
          s.key,
          s.value,
        ]);
      }
    }
  } catch (e) {
    console.warn('[bopai-db] seed settings fail:', e);
  }
  try {
    await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
      'db_version',
      String(DB_VERSION),
    ]);
  } catch (e) {
    /* noop */
  }
}

/** Re-seed nếu DB đã có nhưng categories rỗng (hỏng giữa chừng). */
export async function ensureCategoriesSeeded() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );
  if (!row || row.count === 0) {
    if (__DEV__) console.log('[bopai-db] re-seed categories (empty after init)');
    for (const c of DEFAULT_CATEGORIES) {
      try {
        await db.runAsync(
          'INSERT INTO categories (name, icon, color, type, is_default) VALUES (?, ?, ?, ?, 1)',
          [c.name, c.icon, c.color, c.type]
        );
      } catch (e) {
        console.warn('[bopai-db] re-seed fail:', c.name, e);
      }
    }
  }
}

/** Reset DB hoàn toàn — xoá hết data + clear PIN/biometric + re-init.
 * Streak tự reset vì SQLite file bị xoá kèm.
 * Onboarded flag được giữ vì user đã từng onboard — không nên ép qua 4 màn lại.
 * v3.60 — Cleanup ảnh attach (photo_uri) tránh orphan files trong documentDirectory. */
export async function resetDatabase() {
  // v3.60 — Trước khi xoá DB, scan + xoá tất cả ảnh user đã attach (photo_uri non-null)
  if (_db) {
    try {
      const photoRows = await _db.getAllAsync<{ photo_uri: string }>(
        "SELECT photo_uri FROM transactions WHERE photo_uri IS NOT NULL AND photo_uri != ''"
      );
      const FileSystem = await import('expo-file-system/legacy');
      for (const r of photoRows) {
        try {
          const info = await FileSystem.getInfoAsync(r.photo_uri);
          if (info.exists) {
            await FileSystem.deleteAsync(r.photo_uri, { idempotent: true });
          }
        } catch (e) {
          console.warn('[bopai-db] photo delete fail:', r.photo_uri, e);
        }
      }
    } catch (e) {
      console.warn('[bopai-db] scan photos fail:', e);
    }
    try {
      await _db.closeAsync();
    } catch {
      /* noop */
    }
  }
  _db = null;
  _initPromise = null;
  try {
    await SQLite.deleteDatabaseAsync('bopai.db');
  } catch (e) {
    console.warn('[bopai-db] delete fail:', e);
  }
  // F bảo mật B6 — clear PIN + biometric khi reset DB để tránh user bị khoá app sau reset
  try {
    const { clearPin } = await import('../services/lock');
    await clearPin();
  } catch (e) {
    console.warn('[bopai-db] clearPin fail:', e);
  }
  const db = await getDb();
  // Giữ onboarded = 1 để không redirect về onboarding sau reset
  try {
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      ['onboarded', '1']
    );
  } catch (e) {
    console.warn('[bopai-db] keep onboarded fail:', e);
  }
  return db;
}

// =========================
// TYPES
// =========================
export type Category = {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
  is_default: number;
  is_visible?: number;
  is_impulse?: number; // v3.120 — flag cool-down (F9), thay COOLDOWN_CATS hardcode
};

export type TransactionSource = 'manual' | 'bill' | 'recurring' | 'transfer' | 'scan';

export type Transaction = {
  id: number;
  amount: number;
  category_id: number;
  note: string | null;
  type: 'expense' | 'income';
  date: string;
  created_at: string;
  wallet_id?: number;
  photo_uri?: string | null;
  source?: TransactionSource | null;
  source_id?: number | null;
};

export type Wallet = {
  id: number;
  name: string;
  icon: string;
  color: string;
  initial_balance: number;
  sort_order: number;
  is_default: number;
  created_at: string;
};

export type Budget = {
  id: number;
  category_id: number;
  amount: number;
  month: string; // YYYY-MM
};

// =========================
// CATEGORIES
// =========================
export async function getCategories(type?: 'expense' | 'income'): Promise<Category[]> {
  const db = await getDb();
  if (type) {
    return await db.getAllAsync<Category>(
      'SELECT * FROM categories WHERE type = ? AND COALESCE(is_visible,1) = 1 ORDER BY id',
      [type]
    );
  }
  return await db.getAllAsync<Category>(
    'SELECT * FROM categories WHERE COALESCE(is_visible,1) = 1 ORDER BY id'
  );
}

/** Lấy tất cả categories kể cả đã ẩn (dùng trong Settings để toggle visibility). */
export async function getAllCategories(): Promise<Category[]> {
  const db = await getDb();
  return await db.getAllAsync<Category>('SELECT * FROM categories ORDER BY id');
}

export async function addCategory(c: {
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
}): Promise<number> {
  const db = await getDb();
  const r = await db.runAsync(
    'INSERT INTO categories (name, icon, color, type, is_default, is_visible) VALUES (?, ?, ?, ?, 0, 1)',
    [c.name.trim(), c.icon, c.color, c.type]
  );
  return r.lastInsertRowId;
}

export async function updateCategory(
  id: number,
  fields: Partial<Pick<Category, 'name' | 'icon' | 'color' | 'is_visible'>>
): Promise<void> {
  const db = await getDb();
  const setParts: string[] = [];
  const params: any[] = [];
  for (const k of ['name', 'icon', 'color', 'is_visible'] as const) {
    if (fields[k] !== undefined) {
      setParts.push(`${k} = ?`);
      params.push(fields[k]);
    }
  }
  if (!setParts.length) return;
  params.push(id);
  await db.runAsync(`UPDATE categories SET ${setParts.join(', ')} WHERE id = ?`, params);
}

export async function deleteCategory(id: number): Promise<{ deleted: boolean; reassigned: number }> {
  const db = await getDb();
  const cat = await db.getFirstAsync<Category>('SELECT * FROM categories WHERE id = ?', [id]);
  if (!cat) return { deleted: false, reassigned: 0 };
  // Đếm transactions tham chiếu
  const ref = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions WHERE category_id = ?',
    [id]
  );
  const reassigned = ref?.count ?? 0;
  if (cat.is_default === 1) {
    // Default: chỉ soft delete (ẩn)
    await db.runAsync('UPDATE categories SET is_visible = 0 WHERE id = ?', [id]);
    return { deleted: false, reassigned: 0 };
  }
  // Custom: chuyển transactions sang "Khác" expense (id=12 default) hoặc Khác thu (id=15)
  if (reassigned > 0) {
    const fallbackName = cat.type === 'expense' ? 'Khác' : 'Thu khác';
    const fallback = await db.getFirstAsync<Category>(
      'SELECT * FROM categories WHERE name = ? AND type = ? AND is_default = 1 LIMIT 1',
      [fallbackName, cat.type]
    );
    if (fallback) {
      await db.runAsync('UPDATE transactions SET category_id = ? WHERE category_id = ?', [
        fallback.id,
        id,
      ]);
    }
  }
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
  return { deleted: true, reassigned };
}

// =========================
// TRANSACTIONS
// =========================
/** v3.121 — VACUUM compact DB sau khi xoá nhiều record (giảm size, defragment). */
export async function optimizeDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync('VACUUM');
}

export async function addTransaction(
  t: Omit<Transaction, 'id' | 'created_at'> & { book_id?: number }
): Promise<number> {
  const db = await getDb();
  const walletId = t.wallet_id ?? 1;
  const bookId = t.book_id ?? 1;
  const r = await db.runAsync(
    'INSERT INTO transactions (amount, category_id, note, type, date, wallet_id, photo_uri, source, source_id, book_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      t.amount,
      t.category_id,
      t.note,
      t.type,
      t.date,
      walletId,
      t.photo_uri ?? null,
      t.source ?? 'manual',
      t.source_id ?? null,
      bookId,
    ]
  );
  return r.lastInsertRowId;
}

export async function updateTransaction(id: number, t: Partial<Omit<Transaction, 'id' | 'created_at'>>) {
  const db = await getDb();
  const fields: string[] = [];
  const params: any[] = [];
  for (const k of ['amount', 'category_id', 'note', 'type', 'date', 'wallet_id', 'photo_uri'] as const) {
    if (t[k] !== undefined) {
      fields.push(`${k} = ?`);
      params.push(t[k]);
    }
  }
  if (!fields.length) return;
  params.push(id);
  await db.runAsync(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, params);
}

export async function getTransaction(id: number): Promise<Transaction | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<Transaction>('SELECT * FROM transactions WHERE id = ?', [id])) ?? null
  );
}

export async function getTransactions(opts: {
  startDate?: string;
  endDate?: string;
  walletId?: number;
  bookId?: number;
} = {}): Promise<Transaction[]> {
  const db = await getDb();
  let sql = 'SELECT * FROM transactions';
  const params: any[] = [];
  const conds: string[] = [];
  if (opts.startDate) {
    conds.push('date >= ?');
    params.push(opts.startDate);
  }
  if (opts.endDate) {
    conds.push('date <= ?');
    params.push(opts.endDate);
  }
  if (opts.walletId) {
    conds.push('wallet_id = ?');
    params.push(opts.walletId);
  }
  if (opts.bookId) {
    conds.push('book_id = ?');
    params.push(opts.bookId);
  }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY date DESC, created_at DESC';
  return await db.getAllAsync<Transaction>(sql, params);
}

// =========================
// BOOKS (F58 — multi-ledger)
// =========================
export type Book = {
  id: number;
  name: string;
  icon: string;
  color: string;
  is_default: number;
  created_at: string;
};

export async function getBooks(): Promise<Book[]> {
  const db = await getDb();
  return await db.getAllAsync<Book>('SELECT * FROM books ORDER BY id');
}

export async function addBook(b: { name: string; icon?: string; color?: string }): Promise<number> {
  const db = await getDb();
  const r = await db.runAsync(
    'INSERT INTO books (name, icon, color) VALUES (?, ?, ?)',
    [b.name.trim(), b.icon || 'Wallet', b.color || '#10b981']
  );
  // Auto-create 1 default wallet "Ví chính" for new book
  await db.runAsync(
    'INSERT INTO wallets (name, icon, color, initial_balance, sort_order, is_default, book_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['Ví chính', 'Wallet', b.color || '#10b981', 0, 0, 1, r.lastInsertRowId]
  );
  return r.lastInsertRowId;
}

export async function updateBook(
  id: number,
  fields: Partial<Pick<Book, 'name' | 'icon' | 'color'>>
): Promise<void> {
  const db = await getDb();
  const setParts: string[] = [];
  const params: any[] = [];
  for (const k of ['name', 'icon', 'color'] as const) {
    if (fields[k] !== undefined) {
      setParts.push(`${k} = ?`);
      params.push(fields[k]);
    }
  }
  if (!setParts.length) return;
  params.push(id);
  await db.runAsync(`UPDATE books SET ${setParts.join(', ')} WHERE id = ?`, params);
}

export async function deleteBook(id: number): Promise<{ deleted: boolean }> {
  const db = await getDb();
  const b = await db.getFirstAsync<Book>('SELECT * FROM books WHERE id = ?', [id]);
  if (!b) return { deleted: false };
  if (b.is_default === 1) throw new Error('Không thể xoá sổ mặc định');
  // Xoá hết data của sổ này
  for (const tbl of ['transactions', 'budgets', 'bills', 'savings_goals', 'recurring_rules', 'wallets']) {
    await db.runAsync(`DELETE FROM ${tbl} WHERE book_id = ?`, [id]);
  }
  await db.runAsync('DELETE FROM books WHERE id = ?', [id]);
  return { deleted: true };
}

// =========================
// WALLETS (F32)
// =========================
export async function getWallets(bookId?: number): Promise<Wallet[]> {
  const db = await getDb();
  if (bookId) {
    return await db.getAllAsync<Wallet>(
      'SELECT * FROM wallets WHERE book_id = ? ORDER BY sort_order, id',
      [bookId]
    );
  }
  return await db.getAllAsync<Wallet>('SELECT * FROM wallets ORDER BY sort_order, id');
}

export async function addWallet(w: {
  name: string;
  icon?: string;
  color?: string;
  initial_balance?: number;
  book_id?: number;
}): Promise<number> {
  const db = await getDb();
  const r = await db.runAsync(
    'INSERT INTO wallets (name, icon, color, initial_balance, book_id) VALUES (?, ?, ?, ?, ?)',
    [w.name.trim(), w.icon || 'Wallet', w.color || '#10b981', w.initial_balance ?? 0, w.book_id ?? 1]
  );
  return r.lastInsertRowId;
}

/** v3.64 — H3: Đặt ví làm mặc định. Unset is_default tất cả ví khác, set =1 cho ví được chọn. */
export async function setDefaultWallet(walletId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE wallets SET is_default = 0');
  await db.runAsync('UPDATE wallets SET is_default = 1 WHERE id = ?', [walletId]);
}

export async function updateWallet(
  id: number,
  fields: Partial<Pick<Wallet, 'name' | 'icon' | 'color' | 'initial_balance' | 'sort_order'>>
): Promise<void> {
  const db = await getDb();
  const setParts: string[] = [];
  const params: any[] = [];
  for (const k of ['name', 'icon', 'color', 'initial_balance', 'sort_order'] as const) {
    if (fields[k] !== undefined) {
      setParts.push(`${k} = ?`);
      params.push(fields[k]);
    }
  }
  if (!setParts.length) return;
  params.push(id);
  await db.runAsync(`UPDATE wallets SET ${setParts.join(', ')} WHERE id = ?`, params);
}

export async function deleteWallet(id: number): Promise<{ deleted: boolean; reassigned: number }> {
  const db = await getDb();
  const w = await db.getFirstAsync<Wallet>('SELECT * FROM wallets WHERE id = ?', [id]);
  if (!w) return { deleted: false, reassigned: 0 };
  if (w.is_default === 1) {
    throw new Error('Không thể xoá ví mặc định');
  }
  // Count transactions referencing
  const ref = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions WHERE wallet_id = ?',
    [id]
  );
  const reassigned = ref?.count ?? 0;
  if (reassigned > 0) {
    // Reassign về ví mặc định
    const def = await db.getFirstAsync<Wallet>('SELECT * FROM wallets WHERE is_default = 1 LIMIT 1');
    if (def) {
      await db.runAsync('UPDATE transactions SET wallet_id = ? WHERE wallet_id = ?', [def.id, id]);
    }
  }
  await db.runAsync('DELETE FROM wallets WHERE id = ?', [id]);
  return { deleted: true, reassigned };
}

export async function getWalletBalance(walletId: number): Promise<number> {
  const db = await getDb();
  const w = await db.getFirstAsync<Wallet>('SELECT * FROM wallets WHERE id = ?', [walletId]);
  if (!w) return 0;
  const totals = await db.getFirstAsync<{ income: number; expense: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
     FROM transactions WHERE wallet_id = ?`,
    [walletId]
  );
  const income = totals?.income ?? 0;
  const expense = totals?.expense ?? 0;
  return (w.initial_balance ?? 0) + income - expense;
}

/** Transfer giữa 2 ví — tạo 2 transaction paired. */
export async function transferBetweenWallets(opts: {
  fromWalletId: number;
  toWalletId: number;
  amount: number;
  date: string;
  note?: string;
}): Promise<void> {
  const db = await getDb();
  if (opts.fromWalletId === opts.toWalletId) throw new Error('2 ví phải khác nhau');
  if (opts.amount <= 0) throw new Error('Số tiền phải > 0');
  // Tìm category "Khác" expense + income default để gắn
  const expCat = await db.getFirstAsync<Category>(
    "SELECT * FROM categories WHERE type = 'expense' AND is_default = 1 ORDER BY id DESC LIMIT 1"
  );
  const incCat = await db.getFirstAsync<Category>(
    "SELECT * FROM categories WHERE type = 'income' AND is_default = 1 ORDER BY id DESC LIMIT 1"
  );
  if (!expCat || !incCat) throw new Error('Thiếu danh mục mặc định');
  const noteFrom = `Chuyển → ${opts.note || ''}`.trim();
  const noteTo = `Nhận ← ${opts.note || ''}`.trim();
  // v3.119 — Wrap 3 statement trong transaction để atomic (tránh ví A trừ mà ví B không cộng nếu crash giữa).
  await db.withTransactionAsync(async () => {
    const expRes = await db.runAsync(
      'INSERT INTO transactions (amount, category_id, note, type, date, wallet_id, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [opts.amount, expCat.id, noteFrom, 'expense', opts.date, opts.fromWalletId, 'transfer']
    );
    const incRes = await db.runAsync(
      'INSERT INTO transactions (amount, category_id, note, type, date, wallet_id, source, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [opts.amount, incCat.id, noteTo, 'income', opts.date, opts.toWalletId, 'transfer', expRes.lastInsertRowId]
    );
    await db.runAsync('UPDATE transactions SET source_id = ? WHERE id = ?', [
      incRes.lastInsertRowId,
      expRes.lastInsertRowId,
    ]);
  });
}

export async function deleteTransaction(id: number) {
  const db = await getDb();
  // v3.146 — Nếu TX này được tạo từ payBill (source='bill'), reset bill.paid_at
  //   cho bill non-recurring để UI không hiển thị "đã thanh toán" mồ côi.
  //   Bill recurring đã advance due_date nên không cần reset.
  try {
    const tx = await db.getFirstAsync<{ source: string | null; source_id: number | null }>(
      'SELECT source, source_id FROM transactions WHERE id = ?',
      [id]
    );
    if (tx && tx.source === 'bill' && tx.source_id) {
      await db.runAsync('UPDATE bills SET paid_at = NULL WHERE id = ? AND repeat_period IS NULL', [
        tx.source_id,
      ]);
    }
  } catch {
    /* noop — không chặn xoá TX nếu cleanup fail */
  }
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}

// =========================
// BUDGETS
// =========================
export async function getBudgets(month: string, bookId?: number): Promise<Budget[]> {
  const db = await getDb();
  if (bookId) {
    return await db.getAllAsync<Budget>('SELECT * FROM budgets WHERE month = ? AND book_id = ?', [month, bookId]);
  }
  return await db.getAllAsync<Budget>('SELECT * FROM budgets WHERE month = ?', [month]);
}

export async function setBudget(category_id: number, amount: number, month: string, bookId: number = 1) {
  const db = await getDb();
  // Check existing record cho book/category/month
  const existing = await db.getFirstAsync<Budget>(
    'SELECT * FROM budgets WHERE category_id = ? AND month = ? AND book_id = ?',
    [category_id, month, bookId]
  );
  if (existing) {
    await db.runAsync('UPDATE budgets SET amount = ? WHERE id = ?', [amount, existing.id]);
  } else {
    await db.runAsync(
      'INSERT INTO budgets (category_id, amount, month, book_id) VALUES (?, ?, ?, ?)',
      [category_id, amount, month, bookId]
    );
  }
}

export async function deleteBudget(category_id: number, month: string, bookId?: number) {
  // v3.63 — Pass bookId để tránh xoá nhầm budget book khác cùng (category_id, month)
  const db = await getDb();
  if (bookId !== undefined) {
    await db.runAsync('DELETE FROM budgets WHERE category_id = ? AND month = ? AND book_id = ?', [category_id, month, bookId]);
  } else {
    await db.runAsync('DELETE FROM budgets WHERE category_id = ? AND month = ?', [category_id, month]);
  }
}

/** v3.53 — Xoá toàn bộ budgets của 1 tháng (dùng khi Wizard apply lại). */
export async function clearBudgetsForMonth(month: string, bookId?: number) {
  const db = await getDb();
  const bid = bookId ?? 1;
  await db.runAsync('DELETE FROM budgets WHERE month = ? AND book_id = ?', [month, bid]);
}

// =========================
// SETTINGS
// =========================
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    key,
  ]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
    [key, value, value]
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT * FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// =========================
// RECURRING RULES (F24)
// =========================
// v3.65 — L3: thêm 'daily' option cho recurring (gói data theo ngày, deposit hàng ngày...)
export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export type RecurringRule = {
  id: number;
  amount: number;
  category_id: number;
  type: 'expense' | 'income';
  note: string | null;
  frequency: Frequency;
  next_run: string; // YYYY-MM-DD
  active: number;
  last_run: string | null;
  created_at: string;
};

export async function getRecurringRules(bookId?: number): Promise<RecurringRule[]> {
  const db = await getDb();
  if (bookId) {
    return await db.getAllAsync<RecurringRule>(
      'SELECT * FROM recurring_rules WHERE book_id = ? ORDER BY active DESC, next_run ASC',
      [bookId]
    );
  }
  return await db.getAllAsync<RecurringRule>(
    'SELECT * FROM recurring_rules ORDER BY active DESC, next_run ASC'
  );
}

export async function addRecurringRule(r: {
  amount: number;
  category_id: number;
  type: 'expense' | 'income';
  note?: string;
  frequency: Frequency;
  next_run: string;
  book_id?: number;
}): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO recurring_rules (amount, category_id, type, note, frequency, next_run, book_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [r.amount, r.category_id, r.type, r.note ?? null, r.frequency, r.next_run, r.book_id ?? 1]
  );
  return res.lastInsertRowId;
}

export async function updateRecurringRule(id: number, fields: Partial<RecurringRule>): Promise<void> {
  const db = await getDb();
  const setParts: string[] = [];
  const params: any[] = [];
  for (const k of ['amount', 'category_id', 'type', 'note', 'frequency', 'next_run', 'active', 'last_run'] as const) {
    if (fields[k] !== undefined) {
      setParts.push(`${k} = ?`);
      params.push(fields[k]);
    }
  }
  if (!setParts.length) return;
  params.push(id);
  await db.runAsync(`UPDATE recurring_rules SET ${setParts.join(', ')} WHERE id = ?`, params);
}

export async function deleteRecurringRule(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM recurring_rules WHERE id = ?', [id]);
}

// =========================
// SAVINGS GOALS (F26)
// =========================
export type SavingsGoal = {
  id: number;
  name: string;
  target: number;
  current: number;
  deadline: string | null;
  icon: string;
  color: string;
  completed_at: string | null;
  created_at: string;
};

// v3.108 — Default bookId=1 thay vì optional → tránh race condition trả goals cross-book khi caller quên truyền.
export async function getSavingsGoals(bookId: number = 1): Promise<SavingsGoal[]> {
  const db = await getDb();
  return await db.getAllAsync<SavingsGoal>(
    'SELECT * FROM savings_goals WHERE book_id = ? ORDER BY completed_at IS NULL DESC, created_at DESC',
    [bookId]
  );
}

export async function addSavingsGoal(g: {
  name: string;
  target: number;
  deadline?: string;
  icon?: string;
  color?: string;
  book_id?: number;
}): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO savings_goals (name, target, deadline, icon, color, book_id) VALUES (?, ?, ?, ?, ?, ?)',
    [g.name.trim(), g.target, g.deadline || null, g.icon || 'Gift', g.color || '#10b981', g.book_id ?? 1]
  );
  return res.lastInsertRowId;
}

export async function updateSavingsGoal(
  id: number,
  fields: Partial<Pick<SavingsGoal, 'name' | 'target' | 'current' | 'deadline' | 'icon' | 'color' | 'completed_at'>>
): Promise<void> {
  const db = await getDb();
  const setParts: string[] = [];
  const params: any[] = [];
  for (const k of ['name', 'target', 'current', 'deadline', 'icon', 'color', 'completed_at'] as const) {
    if (fields[k] !== undefined) {
      setParts.push(`${k} = ?`);
      params.push(fields[k]);
    }
  }
  if (!setParts.length) return;
  params.push(id);
  await db.runAsync(`UPDATE savings_goals SET ${setParts.join(', ')} WHERE id = ?`, params);
}

export async function deleteSavingsGoal(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM savings_goals WHERE id = ?', [id]);
  // v3.109 — Cleanup stale wizard_goal_id setting nếu goal bị xoá manual
  //   Tránh wizard re-run sau đó fallback name+icon nhầm với goal khác.
  await db.runAsync(
    "UPDATE settings SET value = '' WHERE key LIKE 'wizard_goal_id_%' AND value = ?",
    [String(id)]
  );
}

export async function addToSavingsGoal(id: number, amount: number): Promise<SavingsGoal | null> {
  const db = await getDb();
  await db.runAsync('UPDATE savings_goals SET current = current + ? WHERE id = ?', [amount, id]);
  const g = await db.getFirstAsync<SavingsGoal>('SELECT * FROM savings_goals WHERE id = ?', [id]);
  if (g && g.current >= g.target && !g.completed_at) {
    await db.runAsync(
      "UPDATE savings_goals SET completed_at = datetime('now') WHERE id = ?",
      [id]
    );
    return { ...g, completed_at: new Date().toISOString() };
  }
  return g;
}

// =========================
// DAILY SNAPSHOTS (v13 — Active Savings)
// =========================
export type DailySnapshot = {
  date: string;
  safe_amount: number;
  expense_amount: number;
  auto_allocated: number;
  manual_added: number;
  suggested_handled: number; // 1 nếu user đã accept/dismiss banner cộng dư
  created_at: string;
};

export async function getSnapshot(date: string): Promise<DailySnapshot | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<DailySnapshot>(
      'SELECT * FROM daily_snapshots WHERE date = ?',
      [date]
    )) ?? null
  );
}

export async function upsertSnapshot(s: Omit<DailySnapshot, 'created_at'>): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO daily_snapshots (date, safe_amount, expense_amount, auto_allocated, manual_added, suggested_handled)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       safe_amount = excluded.safe_amount,
       expense_amount = excluded.expense_amount,
       auto_allocated = excluded.auto_allocated,
       manual_added = excluded.manual_added,
       suggested_handled = excluded.suggested_handled`,
    [s.date, s.safe_amount, s.expense_amount, s.auto_allocated, s.manual_added, s.suggested_handled]
  );
}

export async function markSnapshotHandled(date: string, manualAdded: number = 0): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE daily_snapshots SET suggested_handled = 1, manual_added = manual_added + ? WHERE date = ?',
    [manualAdded, date]
  );
}

// =========================
// BILLS (F54)
// =========================
export type Bill = {
  id: number;
  name: string;
  amount: number;
  due_date: string; // YYYY-MM-DD
  category_id: number | null;
  repeat_period: 'monthly' | 'quarterly' | 'yearly' | null;
  paid_at: string | null;
  notify_days_before: number;
  created_at: string;
};

export async function getBills(bookId?: number): Promise<Bill[]> {
  const db = await getDb();
  if (bookId) {
    return await db.getAllAsync<Bill>(
      'SELECT * FROM bills WHERE book_id = ? ORDER BY paid_at IS NULL DESC, due_date ASC',
      [bookId]
    );
  }
  return await db.getAllAsync<Bill>(
    'SELECT * FROM bills ORDER BY paid_at IS NULL DESC, due_date ASC'
  );
}

export async function addBill(b: {
  name: string;
  amount: number;
  due_date: string;
  category_id?: number;
  repeat_period?: 'monthly' | 'quarterly' | 'yearly';
  notify_days_before?: number;
  book_id?: number;
}): Promise<number> {
  const db = await getDb();
  const r = await db.runAsync(
    'INSERT INTO bills (name, amount, due_date, category_id, repeat_period, notify_days_before, book_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      b.name.trim(),
      b.amount,
      b.due_date,
      b.category_id ?? null,
      b.repeat_period ?? null,
      b.notify_days_before ?? 1,
      b.book_id ?? 1,
    ]
  );
  return r.lastInsertRowId;
}

export async function updateBill(
  id: number,
  fields: Partial<Pick<Bill, 'name' | 'amount' | 'due_date' | 'category_id' | 'repeat_period' | 'paid_at' | 'notify_days_before'>>
): Promise<void> {
  const db = await getDb();
  const setParts: string[] = [];
  const params: any[] = [];
  for (const k of ['name', 'amount', 'due_date', 'category_id', 'repeat_period', 'paid_at', 'notify_days_before'] as const) {
    if (fields[k] !== undefined) {
      setParts.push(`${k} = ?`);
      params.push(fields[k]);
    }
  }
  if (!setParts.length) return;
  params.push(id);
  await db.runAsync(`UPDATE bills SET ${setParts.join(', ')} WHERE id = ?`, params);
}

export async function deleteBill(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM bills WHERE id = ?', [id]);
}

/** Đánh dấu bill đã thanh toán + tạo transaction tương ứng + advance due_date nếu lặp. */
export async function payBill(id: number, walletId: number): Promise<void> {
  const db = await getDb();
  const b = await db.getFirstAsync<Bill>('SELECT * FROM bills WHERE id = ?', [id]);
  if (!b) return;
  // v3.119 — Wrap atomic: tạo TX + advance due_date / mark paid phải đi cùng nhau.
  // v3.146 — Local date thay UTC để pay bill cuối ngày VN không bị nhảy sang hôm sau.
  const nowD = new Date();
  const today = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}-${String(nowD.getDate()).padStart(2, '0')}`;
  const catId = b.category_id ?? (await db.getFirstAsync<Category>(
    "SELECT * FROM categories WHERE type = 'expense' AND is_default = 1 ORDER BY id DESC LIMIT 1"
  ))?.id;
  await db.withTransactionAsync(async () => {
    if (catId) {
      await db.runAsync(
        'INSERT INTO transactions (amount, category_id, note, type, date, wallet_id, source, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [b.amount, catId, `Hoá đơn ${b.name}`, 'expense', today, walletId, 'bill', id]
      );
    }
    if (b.repeat_period) {
      const [y, m, d] = b.due_date.split('-').map(Number);
      const next = new Date(y, m - 1, d);
      if (b.repeat_period === 'monthly') next.setMonth(next.getMonth() + 1);
      else if (b.repeat_period === 'quarterly') next.setMonth(next.getMonth() + 3);
      else if (b.repeat_period === 'yearly') next.setFullYear(next.getFullYear() + 1);
      const ny = next.getFullYear();
      const nm = String(next.getMonth() + 1).padStart(2, '0');
      const nd = String(next.getDate()).padStart(2, '0');
      await db.runAsync('UPDATE bills SET due_date = ?, paid_at = NULL WHERE id = ?', [
        `${ny}-${nm}-${nd}`,
        id,
      ]);
    } else {
      await db.runAsync("UPDATE bills SET paid_at = datetime('now') WHERE id = ?", [id]);
    }
  });
}

// =========================
// CATEGORY PATTERNS (F47)
// =========================
export type CategoryPattern = {
  id: number;
  keyword: string;
  category_id: number;
  count: number;
  last_used: string;
};

/** Strip Vietnamese diacritics + map đ→d. Để pattern match không phụ thuộc dấu. */
function removeDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Tokenize note thành keywords lowercase KHÔNG DẤU, bỏ dấu chấm/phẩy. */
function tokenize(text: string): string[] {
  return removeDiacritics(text)
    .toLowerCase()
    .replace(/[.,!?;:()[\]{}'"]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

export async function suggestCategoryFromNote(
  note: string,
  type: 'expense' | 'income'
): Promise<{ category_id: number; confidence: number } | null> {
  if (!note.trim()) return null;
  const db = await getDb();
  const keywords = tokenize(note);
  if (keywords.length === 0) return null;
  // Query patterns matching any keyword + category type
  const placeholders = keywords.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ category_id: number; count: number; type: string }>(
    `SELECT cp.category_id, cp.count, c.type
     FROM category_patterns cp
     JOIN categories c ON c.id = cp.category_id
     WHERE cp.keyword IN (${placeholders}) AND c.type = ?`,
    [...keywords, type]
  );
  if (rows.length === 0) return null;
  // Vote by count
  const vote: Record<number, number> = {};
  let total = 0;
  for (const r of rows) {
    vote[r.category_id] = (vote[r.category_id] || 0) + r.count;
    total += r.count;
  }
  const sorted = Object.entries(vote).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;
  const [topId, topCount] = sorted[0];
  return {
    category_id: parseInt(topId, 10),
    confidence: total > 0 ? topCount / total : 0,
  };
}

/** Lưu lại pattern khi user submit transaction — học cho lần sau. */
export async function learnCategoryPattern(note: string, categoryId: number): Promise<void> {
  const db = await getDb();
  const keywords = tokenize(note);
  for (const k of keywords) {
    try {
      await db.runAsync(
        `INSERT INTO category_patterns (keyword, category_id, count, last_used)
         VALUES (?, ?, 1, datetime('now'))
         ON CONFLICT(keyword, category_id) DO UPDATE SET
           count = count + 1,
           last_used = datetime('now')`,
        [k, categoryId]
      );
    } catch (e) {
      console.warn('[bopai-db] learn pattern fail:', k, e);
    }
  }
}

/** Seed common VN patterns lần đầu (chỉ run khi table rỗng). */
const VN_PATTERNS: { keyword: string; categoryName: string; type: 'expense' | 'income' }[] = [
  { keyword: 'cafe', categoryName: 'Giao lưu', type: 'expense' },
  { keyword: 'trà', categoryName: 'Giao lưu', type: 'expense' },
  { keyword: 'sữa', categoryName: 'Giao lưu', type: 'expense' },
  { keyword: 'highlands', categoryName: 'Giao lưu', type: 'expense' },
  { keyword: 'phúc', categoryName: 'Giao lưu', type: 'expense' },
  { keyword: 'starbucks', categoryName: 'Giao lưu', type: 'expense' },
  { keyword: 'bia', categoryName: 'Giao lưu', type: 'expense' },
  { keyword: 'nhậu', categoryName: 'Giao lưu', type: 'expense' },
  { keyword: 'ăn', categoryName: 'Ăn uống', type: 'expense' },
  { keyword: 'trưa', categoryName: 'Ăn uống', type: 'expense' },
  { keyword: 'sáng', categoryName: 'Ăn uống', type: 'expense' },
  { keyword: 'tối', categoryName: 'Ăn uống', type: 'expense' },
  { keyword: 'phở', categoryName: 'Ăn uống', type: 'expense' },
  { keyword: 'bún', categoryName: 'Ăn uống', type: 'expense' },
  { keyword: 'cơm', categoryName: 'Ăn uống', type: 'expense' },
  { keyword: 'mì', categoryName: 'Ăn uống', type: 'expense' },
  { keyword: 'pizza', categoryName: 'Ăn uống', type: 'expense' },
  { keyword: 'kfc', categoryName: 'Ăn uống', type: 'expense' },
  { keyword: 'lotteria', categoryName: 'Ăn uống', type: 'expense' },
  { keyword: 'grab', categoryName: 'Đi lại', type: 'expense' },
  { keyword: 'xe', categoryName: 'Đi lại', type: 'expense' },
  { keyword: 'xăng', categoryName: 'Đi lại', type: 'expense' },
  { keyword: 'taxi', categoryName: 'Đi lại', type: 'expense' },
  { keyword: 'gojek', categoryName: 'Đi lại', type: 'expense' },
  { keyword: 'be', categoryName: 'Đi lại', type: 'expense' },
  { keyword: 'điện', categoryName: 'Tiền điện', type: 'expense' },
  { keyword: 'nước', categoryName: 'Tiền điện', type: 'expense' },
  { keyword: 'wifi', categoryName: 'Tiền điện', type: 'expense' },
  { keyword: 'internet', categoryName: 'Tiền điện', type: 'expense' },
  // v3.94 — Phí liên lạc đã được rename → Đầu tư. Patterns cho Đầu tư:
  { keyword: 'đầu tư', categoryName: 'Đầu tư', type: 'expense' },
  { keyword: 'chứng khoán', categoryName: 'Đầu tư', type: 'expense' },
  { keyword: 'cổ phiếu', categoryName: 'Đầu tư', type: 'expense' },
  { keyword: 'vàng', categoryName: 'Đầu tư', type: 'expense' },
  { keyword: 'bitcoin', categoryName: 'Đầu tư', type: 'expense' },
  { keyword: 'btc', categoryName: 'Đầu tư', type: 'expense' },
  { keyword: 'quỹ', categoryName: 'Đầu tư', type: 'expense' },
  { keyword: 'nhà', categoryName: 'Tiền nhà', type: 'expense' },
  { keyword: 'trọ', categoryName: 'Tiền nhà', type: 'expense' },
  { keyword: 'thuê', categoryName: 'Tiền nhà', type: 'expense' },
  { keyword: 'thuốc', categoryName: 'Y tế', type: 'expense' },
  { keyword: 'khám', categoryName: 'Y tế', type: 'expense' },
  { keyword: 'bệnh', categoryName: 'Y tế', type: 'expense' },
  { keyword: 'viện', categoryName: 'Y tế', type: 'expense' },
  { keyword: 'pharmacity', categoryName: 'Y tế', type: 'expense' },
  { keyword: 'long châu', categoryName: 'Y tế', type: 'expense' },
  { keyword: 'sách', categoryName: 'Giáo dục', type: 'expense' },
  { keyword: 'học', categoryName: 'Giáo dục', type: 'expense' },
  { keyword: 'khoá', categoryName: 'Giáo dục', type: 'expense' },
  { keyword: 'fahasa', categoryName: 'Giáo dục', type: 'expense' },
  { keyword: 'quần', categoryName: 'Quần áo', type: 'expense' },
  { keyword: 'áo', categoryName: 'Quần áo', type: 'expense' },
  { keyword: 'giày', categoryName: 'Quần áo', type: 'expense' },
  { keyword: 'uniqlo', categoryName: 'Quần áo', type: 'expense' },
  { keyword: 'mỹ phẩm', categoryName: 'Mỹ phẩm', type: 'expense' },
  { keyword: 'son', categoryName: 'Mỹ phẩm', type: 'expense' },
  { keyword: 'kem', categoryName: 'Mỹ phẩm', type: 'expense' },
  { keyword: 'guardian', categoryName: 'Mỹ phẩm', type: 'expense' },
  { keyword: 'watsons', categoryName: 'Mỹ phẩm', type: 'expense' },
  { keyword: 'tạp', categoryName: 'Tạp hoá', type: 'expense' },
  { keyword: 'siêu thị', categoryName: 'Tạp hoá', type: 'expense' },
  { keyword: 'coopmart', categoryName: 'Tạp hoá', type: 'expense' },
  { keyword: 'bigc', categoryName: 'Tạp hoá', type: 'expense' },
  { keyword: 'winmart', categoryName: 'Tạp hoá', type: 'expense' },
  { keyword: 'vinmart', categoryName: 'Tạp hoá', type: 'expense' },
  { keyword: 'family', categoryName: 'Tạp hoá', type: 'expense' },
  { keyword: 'mart', categoryName: 'Tạp hoá', type: 'expense' },
  // Income
  { keyword: 'lương', categoryName: 'Lương', type: 'income' },
  { keyword: 'thưởng', categoryName: 'Thưởng', type: 'income' },
  { keyword: 'tết', categoryName: 'Thưởng', type: 'income' },
  { keyword: 'tip', categoryName: 'Thưởng', type: 'income' },
];

// v3.108 — Helper key namespaced theo book_id để tránh multi-book leak (HIGH A)
export function savingsKey(bookId: number, month: string): string {
  return `budget_savings_${bookId}_${month}`;
}
export function wizardAppliedKey(bookId: number, month: string): string {
  return `wizard_goal_applied_${bookId}_${month}`;
}

const PATTERN_SEED_VERSION = '4'; // Bump: normalize keyword không dấu để match cả "An trua" lẫn "Ăn trưa"

export async function seedDefaultPatterns(): Promise<void> {
  const db = await getDb();
  const currentVer = await getSetting('pattern_seed_version');
  if (currentVer === PATTERN_SEED_VERSION) return;

  // Cleanup keyword cũ có dấu — re-seed bản không dấu để khớp với tokenize() đã normalize.
  try {
    await db.runAsync(
      "DELETE FROM category_patterns WHERE keyword IN ('điện thoại', 'data', 'sim')"
    );
  } catch (e) {
    console.warn('[bopai-db] cleanup old patterns fail:', e);
  }

  const cats = await db.getAllAsync<Category>('SELECT * FROM categories');
  const catByName = new Map<string, Category>(cats.map((c) => [c.name, c]));

  // Re-seed: với mỗi default keyword, normalize bỏ dấu rồi insert (count tối thiểu = 5, winner sticky)
  for (const p of VN_PATTERNS) {
    const cat = catByName.get(p.categoryName);
    if (!cat) continue;
    if (cat.type !== p.type) continue;
    const keywordNorm = removeDiacritics(p.keyword.toLowerCase());
    try {
      await db.runAsync(
        `INSERT INTO category_patterns (keyword, category_id, count)
         VALUES (?, ?, 5)
         ON CONFLICT(keyword, category_id) DO UPDATE SET count = MAX(count, 5)`,
        [keywordNorm, cat.id]
      );
    } catch {
      /* noop */
    }
  }
  // Đánh dấu version để không re-seed nữa
  await setSetting('pattern_seed_version', PATTERN_SEED_VERSION);
}

// v3.108 — Xoá AI USAGE COUNTER (F11) orphan từ thời Gemini (app 100% offline không cần track quota)
