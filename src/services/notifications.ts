// v3.123 — Barrel re-export sau khi tách thành notif/* modules.
// Existing imports `from '../../src/services/notifications'` vẫn work backward compat.
export { requestNotificationPermission } from './notif/_shared';
export {
  scheduleDailyReminder,
  cancelDailyReminder,
  isDailyReminderScheduled,
} from './notif/daily';
export {
  scheduleWeeklyNudge,
  cancelWeeklyNudge,
  isWeeklyNudgeScheduled,
} from './notif/weekly';
export {
  scheduleSmartNudge,
  cancelSmartNudge,
  isSmartNudgeScheduled,
} from './notif/smart';
export {
  scheduleDailySummary,
  cancelDailySummary,
  isDailySummaryScheduled,
} from './notif/summary';
export {
  scheduleMorningBudget,
  cancelMorningBudget,
  isMorningBudgetScheduled,
} from './notif/morning';
export {
  scheduleSavingsNudge,
  cancelSavingsNudge,
  isSavingsNudgeScheduled,
} from './notif/savings';
export { notifyOverBudget, forecastMonthSpend, type BudgetThreshold } from './notif/budget';
export { sendTestNotification, sendAllTestNotifications } from './notif/test';
