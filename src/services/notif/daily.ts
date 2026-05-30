// v3.123 — Daily reminder (legacy F25). Hiện tại có Morning + Summary nên ít dùng.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { isScheduled, cancelById } from './_shared';
import { t } from '../../i18n';

export const DAILY_ID = 'bop-daily-reminder';

export async function scheduleDailyReminder(hour: number, minute: number): Promise<string | null> {
  await cancelDailyReminder();
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily-reminder', {
        name: t('notif.daily.channel'),
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }
    const id = await Notifications.scheduleNotificationAsync({
      identifier: DAILY_ID,
      content: {
        title: t('notif.daily.title'),
        body: t('notif.daily.body'),
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return id;
  } catch (e) {
    console.warn('[notif] schedule fail:', e);
    return null;
  }
}

export async function cancelDailyReminder(): Promise<void> {
  await cancelById(DAILY_ID);
}

export async function isDailyReminderScheduled(): Promise<boolean> {
  return isScheduled(DAILY_ID);
}
