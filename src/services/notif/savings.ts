// v3.123 — Active Savings nudge 22h tối kiểm tra dư hôm nay, gợi ý cộng vào goal.
// Content static, user mở app sẽ thấy banner UnusedBanner thật ở tab Nhập.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { isScheduled, cancelById } from './_shared';

export const SAVINGS_NUDGE_ID = 'bop-savings-nudge';

export const SAVINGS_VARIANTS = [
  'Trước khi nghỉ, kiểm tra xem hôm nay còn dư bao nhiêu để cộng vào mục tiêu.',
  'Mục tiêu của bạn đang chờ. Vào xem hôm nay có dư không?',
  'Hôm nay tiết kiệm được bao nhiêu? Mở app xem để cộng vào mục tiêu.',
  'Đến giờ kiểm tra mục tiêu. Một thao tác nhỏ, một bước gần hơn.',
  'Cuối ngày, dành 30 giây vun thêm cho mục tiêu của bạn.',
];

export async function scheduleSavingsNudge(
  hour: number = 22,
  minute: number = 0
): Promise<string | null> {
  await cancelSavingsNudge();
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('savings-nudge', {
        name: 'Mục tiêu tiết kiệm',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }
    const body = SAVINGS_VARIANTS[Math.floor(Math.random() * SAVINGS_VARIANTS.length)];
    const id = await Notifications.scheduleNotificationAsync({
      identifier: SAVINGS_NUDGE_ID,
      content: {
        title: 'Mục tiêu tiết kiệm',
        body,
        sound: 'default',
        data: { screen: '/(tabs)/' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return id;
  } catch (e) {
    console.warn('[notif] schedule savings nudge fail:', e);
    return null;
  }
}

export async function cancelSavingsNudge(): Promise<void> {
  await cancelById(SAVINGS_NUDGE_ID);
}

export async function isSavingsNudgeScheduled(): Promise<boolean> {
  return isScheduled(SAVINGS_NUDGE_ID);
}
