// Translate seeded default book name "Sổ Cá nhân".
// User-created books keep their literal name.
import { t } from './index';

const DEFAULT_NAMES = new Set<string>([
  'Sổ Cá nhân',
  'Personal book',
  '个人账本',
]);

export function displayBookName(b: { name: string; is_default?: number }): string {
  if (b.is_default === 1 || DEFAULT_NAMES.has(b.name)) return t('books.default');
  return b.name;
}
