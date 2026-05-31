// F24 — Recurring service: tính next_run + fire rules đến hạn.
import {
  getRecurringRules,
  updateRecurringRule,
  addTransaction,
  Frequency,
  RecurringRule,
} from '../db';
import { todayISO } from '../utils/date';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function computeNextRun(currentRun: string, frequency: Frequency): string {
  const [y, m, d] = currentRun.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  return dateStr(date);
}

export function frequencyLabel(f: Frequency): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { t } = require('../i18n') as typeof import('../i18n');
  switch (f) {
    case 'daily':
      return t('recurring.freqDaily');
    case 'weekly':
      return t('recurring.freqWeekly');
    case 'biweekly':
      return t('recurring.freqBiweekly');
    case 'monthly':
      return t('recurring.freqMonthly');
    case 'quarterly':
      return t('recurring.freqQuarterly');
    case 'yearly':
      return t('recurring.freqYearly');
  }
}

/**
 * Quét rules active, fire mọi rule có next_run <= today.
 * Có thể fire nhiều lần (nếu rule overdue nhiều kỳ).
 * Trả về số transaction đã tạo.
 */
export async function fireDueRules(bookId?: number): Promise<number> {
  const today = todayISO();
  // v3.119 — Filter theo bookId để rule sổ A không fire vào sổ B (cross-book leak)
  const rules = await getRecurringRules(bookId);
  let fired = 0;
  for (const r of rules) {
    if (!r.active) continue;
    let nextRun = r.next_run;
    let safety = 0;
    while (nextRun <= today && safety < 36) {
      try {
        await addTransaction({
          amount: r.amount,
          category_id: r.category_id,
          type: r.type,
          note: r.note || '[Lặp]',
          date: nextRun,
          source: 'recurring',
          source_id: r.id,
          book_id: bookId,
        });
        fired++;
      } catch (e) {
        if (__DEV__) console.warn('[recurring] fire fail rule', r.id, e);
        break;
      }
      const newNext = computeNextRun(nextRun, r.frequency);
      await updateRecurringRule(r.id, { next_run: newNext, last_run: nextRun });
      nextRun = newNext;
      safety++;
    }
  }
  return fired;
}

export type { RecurringRule };
