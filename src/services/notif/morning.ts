// v3.123 — F10g Morning budget 9h sáng.
// Push 9h sáng mỗi ngày với content tự nhiên, dẫn user mở app để xem hạn mức.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { isScheduled, cancelById } from './_shared';
import { t } from '../../i18n';

export const MORNING_BUDGET_ID = 'bop-morning-budget';

export async function scheduleMorningBudget(
  hour: number = 9,
  minute: number = 0
): Promise<string | null> {
  await cancelMorningBudget();
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('morning-budget', {
        name: t('notif.morning.channel'),
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }
    const id = await Notifications.scheduleNotificationAsync({
      identifier: MORNING_BUDGET_ID,
      content: {
        title: t('notif.morning.title'),
        body: t('notif.morning.body'),
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
