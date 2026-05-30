// v3.123 — F45 push notification cảnh báo vượt ngân sách.
// v3.145 — B1: hỗ trợ threshold 80/90/100. Title/body điều chỉnh theo mốc.
// Body generic không chứa PII (số tiền, tên category) để không lộ trên lock screen.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { t } from '../../i18n';

export type BudgetThreshold = 80 | 90 | 100;

export async function notifyOverBudget(opts: {
  categoryName: string;
  spent: number;
  budget: number;
  threshold?: BudgetThreshold;
}): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('budget-alert', {
        name: t('notif.budget.channel'),
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }
    const pct = opts.threshold ?? Math.round((opts.spent / opts.budget) * 100);
    const title =
      pct >= 100
        ? t('notif.budget.over')
        : pct >= 90
          ? t('notif.budget.near')
          : t('notif.budget.most');
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: t('notif.budget.body'),
        sound: 'default',
        data: { screen: '/(tabs)/budget', pct, spent: opts.spent, budget: opts.budget },
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[notif] over-budget fail:', e);
  }
}

/**
 * Dự kiến tổng chi cuối tháng dựa trên tốc độ hiện tại.
 * Trả về 0 nếu chưa có data đáng tin (day < 1).
 */
export function forecastMonthSpend(spentSoFar: number, today: Date = new Date()): number {
  const day = today.getDate();
  if (day <= 0 || spentSoFar <= 0) return spentSoFar;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return Math.round((spentSoFar / day) * daysInMonth);
}
