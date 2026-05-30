// v3.123 — Shared cache + permission + helpers cho các module notif/*.
import * as Notifications from 'expo-notifications';
import { NOTIF_SCHEDULED_CACHE_MS } from '../../utils/constants';

// Cache list scheduled notifications. Settings/Notifications gọi isXxxScheduled 6 lần lúc mount,
// mỗi cái call native bridge ~50-200ms. Cache TTL 5s, invalidate sau cancel/schedule.
let _scheduledCache: Awaited<ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>> | null = null;
let _scheduledCacheAt = 0;

export async function getCachedScheduled() {
  if (_scheduledCache && Date.now() - _scheduledCacheAt < NOTIF_SCHEDULED_CACHE_MS) {
    return _scheduledCache;
  }
  try {
    _scheduledCache = await Notifications.getAllScheduledNotificationsAsync();
    _scheduledCacheAt = Date.now();
    return _scheduledCache;
  } catch {
    return [];
  }
}

export function invalidateScheduledCache() {
  _scheduledCache = null;
  _scheduledCacheAt = 0;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function isScheduled(identifier: string): Promise<boolean> {
  try {
    const list = await getCachedScheduled();
    return list.some((n) => n.identifier === identifier);
  } catch {
    return false;
  }
}

export async function cancelById(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    invalidateScheduledCache();
  } catch {
    /* noop */
  }
}
