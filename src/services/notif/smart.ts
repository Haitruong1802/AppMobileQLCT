// v3.123 — Smart nudge: nhận xét cá nhân hoá sau N ngày (3-7 random).
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { isScheduled, cancelById } from './_shared';

export const SMART_NUDGE_ID = 'bop-smart-nudge';

export async function scheduleSmartNudge(content: string, daysAhead: number = 5): Promise<string | null> {
  await cancelSmartNudge();
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('smart-nudge', {
        name: 'Nhận xét cá nhân hoá',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }
    const id = await Notifications.scheduleNotificationAsync({
      identifier: SMART_NUDGE_ID,
      content: {
        title: 'Nhận xét tuần',
        body: content,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: daysAhead * 24 * 60 * 60,
        repeats: false,
      },
    });
    return id;
  } catch (e) {
    console.warn('[notif] schedule smart fail:', e);
    return null;
  }
}

export async function cancelSmartNudge(): Promise<void> {
  await cancelById(SMART_NUDGE_ID);
}

export async function isSmartNudgeScheduled(): Promise<boolean> {
  return isScheduled(SMART_NUDGE_ID);
}
