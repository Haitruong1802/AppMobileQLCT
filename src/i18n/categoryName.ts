// Translate tên category. CHỈ default category (is_default=1) được dịch theo locale.
// Category user tự thêm → giữ nguyên tên user nhập (vì là input của user, dịch sẽ phá).
import { t } from './index';

/** Bản đồ tên VN gốc (trong DB schema) → slug i18n key. */
const SLUG_MAP: Record<string, string> = {
  'Ăn uống': 'food',
  'Tạp hoá': 'grocery',
  'Quần áo': 'clothes',
  'Mỹ phẩm': 'cosmetics',
  'Giao lưu': 'social',
  'Y tế': 'medical',
  'Giáo dục': 'education',
  'Tiền điện': 'utilities',
  'Đi lại': 'transport',
  'Đầu tư': 'invest',
  'Tiền nhà': 'rent',
  'Khác': 'other',
  'Lương': 'salary',
  'Thưởng': 'bonus',
  'Thu khác': 'other_income',
};

export function displayCategoryName(cat: { name: string; is_default?: number }): string {
  if (cat.is_default !== 1) return cat.name;
  const slug = SLUG_MAP[cat.name];
  if (!slug) return cat.name;
  return t(`cat.default.${slug}`);
}
