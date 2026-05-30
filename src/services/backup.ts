// v3.126 — Pro feature: Backup full JSON + Restore.
// v3.127 — AES-256 encrypt, file extension `.bux2bak` (custom format).
// v3.128 — Strict validation + friendly error. Restore atomic: validate trước, wipe sau.
// v3.130 — Polyfill secure random cho RN Hermes (crypto-js cần random source).
import 'react-native-get-random-values';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import CryptoJS from 'crypto-js';
import { getDb } from '../db';

export const BACKUP_VERSION = 2; // v2 = encrypted format
export const BACKUP_FILE_PREFIX = 'bux2-backup-';
export const BACKUP_FILE_EXT = '.bux2bak';
export const BACKUP_MAGIC = 'BUX2BAK';

// Secret key obfuscated. Người reverse-engineer app vẫn có thể tìm ra,
// nhưng casual user mở file backup không đọc được.
const SECRET_PARTS = ['Bux2', 'v3', 'secure', 'vault', '2026', 'salt'];
const SECRET_KEY = SECRET_PARTS.join('-') + '!#$' + SECRET_PARTS.length;

/** Error class custom để UI distinguish lỗi validation vs lỗi runtime khác. */
export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

const GENERIC_INVALID = 'File khôi phục không hợp lệ, vui lòng chọn đúng file sao lưu của Bux2.';

export interface BackupBundle {
  version: number;
  exportedAt: string;
  data: {
    categories: any[];
    transactions: any[];
    wallets: any[];
    books: any[];
    bills: any[];
    savings_goals: any[];
    recurring_rules: any[];
    budgets: any[];
    settings: any[];
    daily_snapshots: any[];
    category_patterns: any[];
    streaks: any[];
  };
}

const TABLES: Array<keyof BackupBundle['data']> = [
  'categories',
  'transactions',
  'wallets',
  'books',
  'bills',
  'savings_goals',
  'recurring_rules',
  'budgets',
  'settings',
  'daily_snapshots',
  'category_patterns',
  'streaks',
];

// v3.150 — Anti-share-Pro: settings keys liên quan entitlement KHÔNG được export/import
//   để user A chia file backup không transfer Pro sang user B.
//   Entitlement chỉ được khôi phục qua App Store / Google Play restore purchase (production)
//   hoặc qua activation ở DEV mode trên cùng thiết bị.
const PREMIUM_ENTITLEMENT_KEYS = new Set([
  'is_pro',
  'pro_package',
  'pro_activated_at',
  'pro_expires_at',
]);

/** Export tất cả bảng SQLite ra encrypted bundle (.bux2bak). */
export async function exportFullBackup(): Promise<{ uri: string; bytes: number }> {
  const db = await getDb();
  const data: any = {};
  for (const t of TABLES) {
    try {
      const rows = await db.getAllAsync(`SELECT * FROM ${t}`);
      // v3.150 — Filter out Pro entitlement khỏi settings table khi export.
      if (t === 'settings' && Array.isArray(rows)) {
        data[t] = (rows as any[]).filter((r) => !PREMIUM_ENTITLEMENT_KEYS.has(r?.key));
      } else {
        data[t] = rows;
      }
    } catch {
      data[t] = [];
    }
  }
  const bundle: BackupBundle = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
  const json = JSON.stringify(bundle);
  // v3.127 — Encrypt với AES-256, prefix magic header để detect format khi restore.
  const cipher = CryptoJS.AES.encrypt(json, SECRET_KEY).toString();
  const fileContent = `${BACKUP_MAGIC}|${BACKUP_VERSION}|${cipher}`;
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `${BACKUP_FILE_PREFIX}${stamp}${BACKUP_FILE_EXT}`;

  if (Platform.OS === 'web') {
    return { uri: `data:application/octet-stream;base64,${btoa(unescape(encodeURIComponent(fileContent)))}`, bytes: fileContent.length };
  }
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  if (!dir) throw new Error('Không có thư mục lưu file trên thiết bị này.');
  await cleanupOldBackups(dir);
  const uri = `${dir}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, fileContent, { encoding: FileSystem.EncodingType.UTF8 });
  return { uri, bytes: fileContent.length };
}

async function cleanupOldBackups(dir: string): Promise<void> {
  try {
    const list = await FileSystem.readDirectoryAsync(dir);
    for (const name of list) {
      if (name.startsWith(BACKUP_FILE_PREFIX) && (name.endsWith(BACKUP_FILE_EXT) || name.endsWith('.json'))) {
        try {
          await FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true });
        } catch {
          /* noop */
        }
      }
    }
  } catch {
    /* noop */
  }
}

/** Share backup file qua iOS/Android share sheet. */
export async function shareBackup(uri: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      try {
        const a = document.createElement('a');
        a.href = uri;
        a.download = `bux2-backup${BACKUP_FILE_EXT}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch {
        throw new Error('Trình duyệt không hỗ trợ tải file. Vui lòng dùng app mobile.');
      }
    }
    return;
  }
  const ok = await Sharing.isAvailableAsync();
  if (!ok) throw new Error('Thiết bị không hỗ trợ chia sẻ file.');
  await Sharing.shareAsync(uri, { mimeType: 'application/octet-stream', dialogTitle: 'Sao lưu Bux2' });
}

/** Đọc file backup từ URI, decrypt + parse + validate strict. Throw BackupValidationError nếu sai. */
export async function readBackupFile(uri: string): Promise<BackupBundle> {
  // 1. Đọc file. Lỗi I/O (file không tồn tại, permission) → generic error.
  let content: string;
  try {
    content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  } catch {
    throw new BackupValidationError('Không đọc được file đã chọn.');
  }
  if (!content || content.length < 10) {
    throw new BackupValidationError(GENERIC_INVALID);
  }

  // 2. Detect format theo magic header
  if (content.startsWith(BACKUP_MAGIC + '|')) {
    return parseEncryptedFormat(content);
  }
  // 3. v1 legacy: plain JSON (backward compat backup cũ)
  return parseLegacyJsonFormat(content);
}

function parseEncryptedFormat(content: string): BackupBundle {
  const parts = content.split('|');
  if (parts.length < 3) {
    throw new BackupValidationError(GENERIC_INVALID);
  }
  const fileVersion = parseInt(parts[1], 10);
  if (!Number.isFinite(fileVersion) || fileVersion < 1) {
    throw new BackupValidationError(GENERIC_INVALID);
  }
  if (fileVersion > BACKUP_VERSION) {
    throw new BackupValidationError(
      `Backup phiên bản ${fileVersion} mới hơn app. Vui lòng cập nhật app trước khi khôi phục.`
    );
  }
  const cipher = parts.slice(2).join('|');
  if (!cipher) {
    throw new BackupValidationError(GENERIC_INVALID);
  }
  let json: string;
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, SECRET_KEY);
    json = bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    throw new BackupValidationError(GENERIC_INVALID);
  }
  if (!json) {
    throw new BackupValidationError(GENERIC_INVALID);
  }
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new BackupValidationError(GENERIC_INVALID);
  }
  return validateBundle(parsed);
}

function parseLegacyJsonFormat(content: string): BackupBundle {
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new BackupValidationError(GENERIC_INVALID);
  }
  return validateBundle(parsed);
}

/** Strict validation: check version + data structure + mỗi table key phải là array. */
function validateBundle(parsed: any): BackupBundle {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BackupValidationError(GENERIC_INVALID);
  }
  if (typeof parsed.version !== 'number' || parsed.version < 1) {
    throw new BackupValidationError(GENERIC_INVALID);
  }
  if (parsed.version > BACKUP_VERSION) {
    throw new BackupValidationError(
      `Backup phiên bản ${parsed.version} mới hơn app (${BACKUP_VERSION}). Vui lòng cập nhật app.`
    );
  }
  if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
    throw new BackupValidationError(GENERIC_INVALID);
  }
  // Mỗi table key (nếu có) phải là array. Cho phép missing → coi như rỗng khi import.
  for (const t of TABLES) {
    const v = (parsed.data as any)[t];
    if (v !== undefined && !Array.isArray(v)) {
      throw new BackupValidationError(GENERIC_INVALID);
    }
  }
  // Bắt buộc có ít nhất 1 table có data (chống file rỗng giả mạo)
  const hasAnyData = TABLES.some((t) => Array.isArray((parsed.data as any)[t]) && (parsed.data as any)[t].length > 0);
  if (!hasAnyData) {
    throw new BackupValidationError('File backup rỗng, không có dữ liệu để khôi phục.');
  }
  return parsed as BackupBundle;
}

/**
 * Import bundle: wipe + replace. Atomic qua DB transaction.
 *   Pre-condition: bundle đã được validate bằng readBackupFile().
 *   Nếu transaction fail giữa chừng → SQLite rollback, data hiện tại NGUYÊN.
 */
export async function importFullBackup(bundle: BackupBundle): Promise<{
  restoredCount: Record<string, number>;
}> {
  const db = await getDb();
  const restored: Record<string, number> = {};

  // v3.150 — Snapshot Pro entitlement hiện tại của user trước khi wipe.
  //   Backup không lưu Pro nữa (anti-share), nhưng entitlement của thiết bị hiện tại
  //   phải được giữ lại sau khi restore data. Nếu user thật sự đã mua Pro, key đang ở DB
  //   này sẽ được preserve.
  let preservedEntitlement: { key: string; value: string }[] = [];
  try {
    const rows = await db.getAllAsync<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key IN (${Array.from(PREMIUM_ENTITLEMENT_KEYS).map(() => '?').join(',')})`,
      Array.from(PREMIUM_ENTITLEMENT_KEYS)
    );
    preservedEntitlement = rows;
  } catch {
    /* noop — không chặn restore nếu read fail */
  }

  // Tắt FK tạm thời để xoá theo thứ tự ngẫu nhiên, sau đó bật lại.
  await db.execAsync('PRAGMA foreign_keys = OFF');
  try {
    await db.withTransactionAsync(async () => {
      // 1. Wipe data hiện tại (chỉ trong transaction, fail → rollback)
      for (const t of TABLES) {
        try {
          await db.runAsync(`DELETE FROM ${t}`);
        } catch {
          /* bảng có thể không tồn tại trên DB cũ */
        }
      }
      // 2. Reset auto-increment để id match data backup
      try {
        await db.runAsync('DELETE FROM sqlite_sequence');
      } catch {
        /* noop */
      }
      // 3. Insert lại theo thứ tự TABLES (FK reference valid khi parent insert trước)
      for (const t of TABLES) {
        let rows: any[] = (bundle.data as any)[t] || [];
        // v3.150 — Settings: filter Pro entitlement khỏi data import.
        //   Backup mới đã filter ở export, nhưng backup cũ có thể chứa Pro keys.
        if (t === 'settings' && Array.isArray(rows)) {
          rows = rows.filter((r) => !PREMIUM_ENTITLEMENT_KEYS.has(r?.key));
        }
        if (!Array.isArray(rows) || rows.length === 0) {
          restored[t] = 0;
          continue;
        }
        const firstKeys = Object.keys(rows[0]);
        if (firstKeys.length === 0) {
          restored[t] = 0;
          continue;
        }
        const placeholders = firstKeys.map(() => '?').join(',');
        const sql = `INSERT INTO ${t} (${firstKeys.join(',')}) VALUES (${placeholders})`;
        let inserted = 0;
        for (const row of rows) {
          try {
            await db.runAsync(sql, firstKeys.map((k) => row[k] ?? null));
            inserted++;
          } catch {
            /* skip dòng lỗi (vd cột mismatch sau migration schema) */
          }
        }
        restored[t] = inserted;
      }
      // 4. v3.150 — Restore Pro entitlement của thiết bị (preserved trước wipe)
      for (const r of preservedEntitlement) {
        try {
          await db.runAsync(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            [r.key, r.value]
          );
        } catch {
          /* noop */
        }
      }
    });
  } finally {
    // Luôn bật lại FK dù success hay throw
    await db.execAsync('PRAGMA foreign_keys = ON');
  }
  return { restoredCount: restored };
}
