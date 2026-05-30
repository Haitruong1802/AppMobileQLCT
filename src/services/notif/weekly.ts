// v3.123 — Tóm tắt tuần Chủ nhật 10:00 với content cá nhân hoá (truyền từ smartNudge).
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { isScheduled, cancelById } from './_shared';

export const WEEKLY_NUDGE_ID = 'bop-weekly-nudge';

export async function scheduleWeeklyNudge(content: string): Promise<string | null> {
  await cancelWeeklyNudge();
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('weekly-nudge', {
        name: 'Tóm tắt tuần',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }
    const id = await Notifications.scheduleNotificationAsync({
      identifier: WEEKLY_NUDGE_ID,
      content: {
        title: 'Tóm tắt tuần',
        body: content,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // 1 = Sunday in expo-notifications WEEKLY
        hour: 10,
        minute: 0,
      },
    });
    return id;
  } catch (e) {
    console.warn('[notif] schedule weekly fail:', e);
    return null;
  }
}

export async function cancelWeeklyNudge(): Promise<void> {
  await cancelById(WEEKLY_NUDGE_ID);
}

export async function isWeeklyNudgeScheduled(): Promise<boolean> {
  return isScheduled(WEEKLY_NUDGE_ID);
}
