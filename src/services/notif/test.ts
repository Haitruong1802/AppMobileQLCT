// v3.123 — Test notifications: 1 cái thử cấu hình, 1 cái thử all với content thật.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { requestNotificationPermission } from './_shared';
import { MORNING_VARIANTS } from './morning';
import { SUMMARY_VARIANTS } from './summary';
import { SAVINGS_VARIANTS } from './savings';

export async function sendTestNotification(): Promise<boolean> {
  const ok = await requestNotificationPermission();
  if (!ok) return false;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily-reminder', {
        name: 'Nhắc ghi chi tiêu',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Thông báo thử',
        body: 'Nếu bạn thấy thông báo này, cấu hình thông báo đã hoạt động.',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 3,
        repeats: false,
      },
    });
    return true;
  } catch (e) {
    console.warn('[notif] test fail:', e);
    return false;
  }
}

export async function sendAllTestNotifications(): Promise<number> {
  const ok = await requestNotificationPermission();
  if (!ok) return 0;

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('test-all', {
        name: 'Test tất cả thông báo',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    } catch {
      /* noop */
    }
  }

  const items: { title: string; body: string; data: any; delay: number }[] = [
    {
      title: 'Hạn mức hôm nay',
      body: MORNING_VARIANTS[Math.floor(Math.random() * MORNING_VARIANTS.length)],
      data: { screen: '/summary/today' },
      delay: 3,
    },
    {
      title: 'Tóm tắt hôm nay',
      body: SUMMARY_VARIANTS[Math.floor(Math.random() * SUMMARY_VARIANTS.length)],
      data: { screen: '/summary/today' },
      delay: 7,
    },
    {
      title: 'Mục tiêu tiết kiệm',
      body: SAVINGS_VARIANTS[Math.floor(Math.random() * SAVINGS_VARIANTS.length)],
      data: { screen: '/(tabs)/' },
      delay: 11,
    },
    {
      title: 'Tóm tắt tuần',
      body: 'Tuần qua bạn chi tiêu thế nào? Mở app xem nhận xét chi tiết.',
      data: { screen: '/summary/today' },
      delay: 15,
    },
    {
      title: 'Nhận xét tuần',
      body: 'Giao lưu tuần này hơi nhiều. Xem chi tiết trong app.',
      data: { screen: '/(tabs)/' },
      delay: 19,
    },
  ];

  let scheduled = 0;
  for (const it of items) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: it.title,
          body: it.body,
          sound: 'default',
          data: it.data,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: it.delay,
          repeats: false,
        },
      });
      scheduled++;
    } catch (e) {
      console.warn('[notif] test-all schedule fail:', e);
    }
  }
  return scheduled;
}
