// v3.123 — F10g Morning budget 9h sáng.
// Push 9h sáng mỗi ngày với content tự nhiên, dẫn user mở app để xem hạn mức.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { isScheduled, cancelById } from './_shared';

export const MORNING_BUDGET_ID = 'bop-morning-budget';

export const MORNING_VARIANTS = [
  'Chào buổi sáng. Hạn mức chi hôm nay đã sẵn sàng, vào xem nhé.',
  'Bắt đầu ngày mới bằng cách xem ngân sách của bạn hôm nay.',
  'Sáng nay bạn có thể xài thoải mái bao nhiêu? Mở app xem ngay.',
  'Một ngày mới, hạn mức mới. Tap để xem chi tiết.',
  'Hạn mức hôm nay đã cập nhật. Lướt qua 30 giây trước khi bắt đầu ngày.',
];

export async function scheduleMorningBudget(
  hour: number = 9,
  minute: number = 0
): Promise<string | null> {
  await cancelMorningBudget();
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('morning-budget', {
        name: 'Hạn mức sáng',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }
    const body = MORNING_VARIANTS[Math.floor(Math.random() * MORNING_VARIANTS.length)];
    const id = await Notifications.scheduleNotificationAsync({
      identifier: MORNING_BUDGET_ID,
      content: {
        title: 'Hạn mức hôm nay',
        body,
        sound: 'default',
        data: { screen: '/summary/today' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return id;
  } catch (e) {
    console.warn('[notif] schedule morning fail:', e);
    return null;
  }
}

export async function cancelMorningBudget(): Promise<void> {
  await cancelById(MORNING_BUDGET_ID);
}

export async function isMorningBudgetScheduled(): Promise<boolean> {
  return isScheduled(MORNING_BUDGET_ID);
}
