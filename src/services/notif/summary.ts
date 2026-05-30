// v3.123 — F5 Daily Summary 20:00 mỗi tối.
// Content static random từ 5 variants, user mở app sẽ thấy data thật ở /summary/today.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { isScheduled, cancelById } from './_shared';

export const DAILY_SUMMARY_ID = 'bop-daily-summary';

export const SUMMARY_VARIANTS = [
  'Tổng kết chi tiêu hôm nay đã sẵn sàng. Vào xem 1 phút nhé.',
  'Đã 20h, ghi xong giao dịch hôm nay chưa? Vào kiểm tra.',
  'Một phút nhìn lại ngày hôm nay. Tap để mở.',
  'Hôm nay bạn xài bao nhiêu? Xem chi tiết trong app.',
  'Đến giờ tổng kết. Mở app 30 giây cho ngày hôm nay.',
];

export async function scheduleDailySummary(
  hour: number = 20,
  minute: number = 0
): Promise<string | null> {
  await cancelDailySummary();
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily-summary', {
        name: 'Tóm tắt hôm nay',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }
    const body = SUMMARY_VARIANTS[Math.floor(Math.random() * SUMMARY_VARIANTS.length)];
    const id = await Notifications.scheduleNotificationAsync({
      identifier: DAILY_SUMMARY_ID,
      content: {
        title: 'Tóm tắt hôm nay',
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
    console.warn('[notif] schedule summary fail:', e);
    return null;
  }
}

export async function cancelDailySummary(): Promise<void> {
  await cancelById(DAILY_SUMMARY_ID);
}

export async function isDailySummaryScheduled(): Promise<boolean> {
  return isScheduled(DAILY_SUMMARY_ID);
}
