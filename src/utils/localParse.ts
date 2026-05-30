// Parse số tiền tiếng Việt local — không cần API.
// "60k" → 60000, "1tr5" → 1500000, "1.5tr" → 1500000, "60.000" → 60000

export function parseAmountLocal(text: string): number | null {
  if (!text) return null;
  const t = text.toLowerCase().trim();

  // "1tr5" / "1tr500" — số trước "tr" và sau "tr"
  const trCombo = t.match(/(\d+)\s*tr\s*(\d+)/);
  if (trCombo) {
    const main = parseInt(trCombo[1], 10);
    const sub = trCombo[2];
    const subNum = sub.length === 1 ? parseInt(sub, 10) * 100_000 : parseInt(sub, 10) * 1000;
    return main * 1_000_000 + subNum;
  }

  // "1.5tr" / "1,5tr" / "2 tr" / "10 triệu"
  const trMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(?:tr|triệu|trieu)\b/);
  if (trMatch) {
    return Math.round(parseFloat(trMatch[1].replace(',', '.')) * 1_000_000);
  }

  // "60k" / "60 K" / "60 nghìn" / "60 ngàn"
  const kMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(?:k|nghìn|ngan|nghin|ngàn|ng)\b/);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1].replace(',', '.')) * 1000);
  }

  // "60.000" / "60,000" / "60000"
  const num = t.match(/(\d{1,3}(?:[.,]\d{3})+|\d{4,})/);
  if (num) {
    return parseInt(num[1].replace(/[.,]/g, ''), 10);
  }

  // Just plain digit "60" — assume thousands if > 0
  const plain = t.match(/(\d+)/);
  if (plain) {
    const n = parseInt(plain[1], 10);
    // Nếu chỉ 1-3 chữ số rời → coi như x1000 (vd "60" = "60k" common shortcut)
    if (n > 0 && n < 1000) return n * 1000;
    return n;
  }

  return null;
}

/** Detect type income vs expense from keywords. */
export function detectTypeLocal(text: string): 'expense' | 'income' {
  const t = text.toLowerCase();
  if (/lương|thưởng|tip|được tặng|nhận|thu nhập|hoàn tiền|refund/.test(t)) {
    return 'income';
  }
  return 'expense';
}

/** Extract note: bỏ phần số + đơn vị, chỉ lấy text mô tả. */
export function extractNoteLocal(text: string): string {
  let s = text;
  // 1. Bỏ "1tr5", "60k", "10 triệu", "60.000đ", etc. (số có suffix đơn vị)
  s = s.replace(/\d+(?:[.,]\d+)?\s*(?:tr|triệu|trieu|k|nghìn|nghin|ngàn|ng)\b/gi, '');
  s = s.replace(/\d+\s*tr\s*\d+/gi, '');
  s = s.replace(/\d{1,3}(?:[.,]\d{3})+\s*đ?/g, '');
  s = s.replace(/\d{4,}\s*đ?/g, '');
  // 2. v3.47 — Bỏ số rời 1-3 chữ số (vd "30 ăn sáng" → "ăn sáng", "60" ngầm hiểu = 60k đã được parseAmount nhận)
  s = s.replace(/\b\d{1,3}\b/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  // Capitalize first letter
  if (s.length > 0) s = s[0].toUpperCase() + s.slice(1);
  return s.slice(0, 80);
}
