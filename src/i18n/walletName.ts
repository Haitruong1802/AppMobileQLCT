// Translate seeded default wallet name "Ví chính".
// User-created wallets keep their literal name.
import { t } from './index';

const DEFAULT_NAMES = new Set<string>([
  'Ví chính',
  'Main wallet',
  '主钱包',
]);

export function displayWalletName(w: { name: string; is_default?: number }): string {
  if (w.is_default === 1 || DEFAULT_NAMES.has(w.name)) return t('wallet.default');
  return w.name;
}
