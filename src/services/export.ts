// F13 — Export CSV.
// v3.137 — Spec mới theo yêu cầu: 8 cột English chuẩn + filename slug English.
//   File: finance-transactions-all-YYYY-MM-DD.csv | finance-transactions-YYYY-MM.csv | finance-transactions-YYYY-MM-DD_to_YYYY-MM-DD.csv
//   Columns: date,time,type,category,name,note,amount,currency
//   BOM UTF-8 + escape RFC 4180 cho Excel/Google Sheets đọc tiếng Việt đúng.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Transaction, Category, getTransactions, getCategories } from '../db';

const APP_SLUG = 'finance-transactions';
const CURRENCY = 'VND';

function csvEscape(s: string | number | null | undefined): string {
  if (s == null) return '';
  const str = String(s);
  const needsQuote = /[",\n\r]/.test(str);
  const escaped = str.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

export type ExportRangeKey = 'all' | 'thisMonth' | 'lastMonth' | 'thisYear';

export interface ExportRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export interface ExportResult {
  uri: string;
  rows: number;
  fileName: string;
  rangeLabel: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Tính range thực tế từ key (theo local timezone). */
export function resolveRange(key: ExportRangeKey, ref: Date = new Date()): ExportRange | undefined {
  if (key === 'all') return undefined;
  const y = ref.getFullYear();
  const m = ref.getMonth();
  if (key === 'thisMonth') {
    const last = new Date(y, m + 1, 0).getDate();
    return { startDate: `${y}-${pad(m + 1)}-01`, endDate: `${y}-${pad(m + 1)}-${pad(last)}` };
  }
  if (key === 'lastMonth') {
    const prev = new Date(y, m - 1, 1);
    const last = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
    return {
      startDate: `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-01`,
      endDate: `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(last)}`,
    };
  }
  // thisYear
  return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
}

export function rangeLabel(key: ExportRangeKey): string {
  switch (key) {
    case 'thisMonth':
      return 'Tháng này';
    case 'lastMonth':
      return 'Tháng trước';
    case 'thisYear':
      return 'Năm nay';
    case 'all':
      return 'Tất cả';
  }
}

/** Build filename theo spec: english slug, không dấu, không space. */
function buildFileName(key: ExportRangeKey, range: ExportRange | undefined, ref: Date): string {
  if (key === 'all') {
    const today = `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}-${pad(ref.getDate())}`;
    return `${APP_SLUG}-all-${today}.csv`;
  }
  if (range && key === 'thisMonth') {
    // YYYY-MM
    return `${APP_SLUG}-${range.startDate.slice(0, 7)}.csv`;
  }
  if (range && key === 'lastMonth') {
    return `${APP_SLUG}-${range.startDate.slice(0, 7)}.csv`;
  }
  if (range && key === 'thisYear') {
    return `${APP_SLUG}-${range.startDate.slice(0, 4)}.csv`;
  }
  // Fallback custom range YYYY-MM-DD_to_YYYY-MM-DD
  if (range) {
    return `${APP_SLUG}-${range.startDate}_to_${range.endDate}.csv`;
  }
  return `${APP_SLUG}-all.csv`;
}

/** Format time from `created_at` (SQLite local format hoặc ISO) → "HH:MM:SS" local, hoặc empty. */
function formatTime(createdAt: string | undefined): string {
  if (!createdAt) return '';
  try {
    // SQLite trả 'YYYY-MM-DD HH:MM:SS' UTC. Parse như UTC rồi format local.
    const isoLike = createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T') + 'Z';
    const d = new Date(isoLike);
    if (isNaN(d.getTime())) return '';
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return '';
  }
}

function isValidDate(s: string | undefined): boolean {
  if (!s || typeof s !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00');
  return !isNaN(d.getTime());
}

export async function exportTransactionsCSV(
  key: ExportRangeKey = 'all',
  ref: Date = new Date()
): Promise<ExportResult> {
  const range = resolveRange(key, ref);
  const [rawTxs, cats] = await Promise.all([getTransactions(range), getCategories()]);
  const catMap = new Map<number, Category>(cats.map((c) => [c.id, c]));

  // Filter giao dịch sai format để không xuất rác
  const txs: Transaction[] = (rawTxs as Transaction[]).filter((t) => {
    if (!t || typeof t !== 'object') return false;
    if (!isValidDate(t.date)) return false;
    const amt = Number(t.amount);
    if (!Number.isFinite(amt) || amt < 0) return false;
    if (t.type !== 'income' && t.type !== 'expense') return false;
    return true;
  });

  const BOM = '﻿'; // UTF-8 BOM cho Excel đọc tiếng Việt đúng
  const header = ['date', 'time', 'type', 'category', 'name', 'note', 'amount', 'currency'].join(',');

  const lines = txs.map((t) => {
    const cat = catMap.get(t.category_id);
    const catName = cat?.name || '';
    const note = (t.note || '').trim();
    // `name` = note nếu có, fallback category name (tên hiển thị thân thiện trong Excel)
    const name = note || catName || '';
    return [
      csvEscape(t.date),
      csvEscape(formatTime(t.created_at)),
      csvEscape(t.type),
      csvEscape(catName),
      csvEscape(name),
      csvEscape(note),
      csvEscape(Math.round(Number(t.amount))),
      csvEscape(CURRENCY),
    ].join(',');
  });

  const content = BOM + header + '\n' + lines.join('\n') + (lines.length > 0 ? '\n' : '');
  const fileName = buildFileName(key, range, ref);

  if (Platform.OS === 'web') {
    return {
      uri: `data:text/csv;charset=utf-8,${encodeURIComponent(content)}`,
      rows: txs.length,
      fileName,
      rangeLabel: rangeLabel(key),
    };
  }
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  if (!dir) throw new Error('Không có thư mục lưu file trên thiết bị này.');
  await cleanupOldExports(dir);
  const uri = `${dir}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return { uri, rows: txs.length, fileName, rangeLabel: rangeLabel(key) };
}

/** Xoá các file CSV export cũ trong cache dir, tránh tích luỹ. */
async function cleanupOldExports(dir: string): Promise<void> {
  try {
    const list = await FileSystem.readDirectoryAsync(dir);
    for (const name of list) {
      const isOldCsv =
        name.startsWith('bopai-export-') ||
        name.startsWith('bux2-giaodich-') ||
        name.startsWith(`${APP_SLUG}-`);
      if (isOldCsv && name.endsWith('.csv')) {
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

export async function shareFile(uri: string, mimeType = 'text/csv', fileName?: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      let blobUrl: string | null = null;
      try {
        // Nếu uri là data URL, tạo Blob để cleanup được URL.createObjectURL
        if (uri.startsWith('data:')) {
          const comma = uri.indexOf(',');
          const meta = uri.slice(5, comma);
          const data = decodeURIComponent(uri.slice(comma + 1));
          const blob = new Blob([data], { type: meta.split(';')[0] || mimeType });
          blobUrl = URL.createObjectURL(blob);
        }
        const a = document.createElement('a');
        a.href = blobUrl || uri;
        a.download = fileName || 'export.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return true;
      } catch {
        return false;
      } finally {
        if (blobUrl) {
          // Cleanup sau 1s để browser kịp trigger download
          setTimeout(() => URL.revokeObjectURL(blobUrl!), 1000);
        }
      }
    }
    return false;
  }
  const ok = await Sharing.isAvailableAsync();
  if (!ok) throw new Error('Thiết bị không hỗ trợ chia sẻ file.');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Xuất dữ liệu giao dịch' });
  return true;
}
