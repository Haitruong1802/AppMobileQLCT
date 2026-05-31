// Translate built-in goal name "Quỹ tiết kiệm chung" (Wizard auto-created).
// Goals user tự đặt tên → giữ nguyên.
import { t } from './index';

const DEFAULT_NAMES = new Set<string>([
  'Quỹ tiết kiệm chung',
  'General savings fund',
  '通用储蓄金',
]);

export function displayGoalName(goal: { name: string }): string {
  if (DEFAULT_NAMES.has(goal.name)) return t('goals.fundGeneral');
  return goal.name;
}
