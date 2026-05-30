import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useStore } from '../src/store/useStore';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { LockScreen } from '../src/components/LockScreen';
import { ToastHost } from '../src/components/Toast';
import { useAuth, BG_LOCK_THRESHOLD_MS } from '../src/store/useAuth';
import { hasPin } from '../src/services/lock';
import { fireDueRules } from '../src/services/recurring';
import { seedDefaultPatterns, getBills } from '../src/db';
import { setLocale } from '../src/i18n';
import { runDailyAllocation, cleanupRoundingArtifacts } from '../src/services/activeSavings';
import { recomputeStreak } from '../src/services/streak';
import {
  requestNotificationPermission,
  scheduleMorningBudget,
  scheduleDailySummary,
} from '../src/services/notifications';
import { setSetting, getSetting } from '../src/db';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const loadCategories = useStore((s) => s.loadCategories);
  const loadTransactions = useStore((s) => s.loadTransactions);
  const loadBudgets = useStore((s) => s.loadBudgets);
  const loadSettings = useStore((s) => s.loadSettings);
  const loadWallets = useStore((s) => s.loadWallets);
  const loadBooks = useStore((s) => s.loadBooks);
  const setCurrentMonth = useStore((s) => s.setCurrentMonth);
  const settings = useStore((s) => s.settings);
  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    // Reset currentMonth về tháng hiện tại mỗi lần app boot
    const d = new Date();
    const thisMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(thisMonth);

    (async () => {
      try {
        await loadCategories();
      } catch (e) {
        if (__DEV__) console.warn('loadCategories fail:', e);
      }
      try {
        await loadTransactions();
      } catch (e) {
        if (__DEV__) console.warn('loadTransactions fail:', e);
      }
      try {
        await loadBudgets();
      } catch (e) {
        if (__DEV__) console.warn('loadBudgets fail:', e);
      }
      try {
        await loadSettings();
      } catch (e) {
        if (__DEV__) console.warn('loadSettings fail:', e);
      }
      // v1.0 free-only: đánh dấu user bản phát hành sớm để Phase 2 grandfather giữ Pro miễn phí.
      try {
        const ea = await getSetting('early_adopter');
        if (ea !== '1') await setSetting('early_adopter', '1');
      } catch (e) {
        if (__DEV__) console.warn('early_adopter mark fail:', e);
      }
      try {
        await loadBooks();
      } catch (e) {
        if (__DEV__) console.warn('loadBooks fail:', e);
      }
      try {
        await loadWallets();
      } catch (e) {
        if (__DEV__) console.warn('loadWallets fail:', e);
      }
      try {
        await seedDefaultPatterns();
      } catch (e) {
        if (__DEV__) console.warn('seedDefaultPatterns fail:', e);
      }
      try {
        // v3.119 — fire rules đúng sổ hiện tại, tránh cross-book leak
        const fired = await fireDueRules(useStore.getState().currentBookId);
        if (fired > 0) {
          await loadTransactions();
        }
      } catch (e) {
        if (__DEV__) console.warn('fireDueRules fail:', e);
      }
      // v3.28 — Migration 1 lần cleanup số lẻ từ version cũ trước khi daily allocation
      try {
        await cleanupRoundingArtifacts();
      } catch (e) {
        if (__DEV__) console.warn('cleanupRoundingArtifacts fail:', e);
      }
      // v3.43 — Recompute streak từ transactions table (fix data cũ + TX ngày quá khứ)
      // v3.108 — Pass currentBookId từ store (đã load xong ở loadBooks line 65)
      try {
        await recomputeStreak(new Date(), useStore.getState().currentBookId);
      } catch (e) {
        if (__DEV__) console.warn('recomputeStreak fail:', e);
      }
      // v3.33 — Auto-enable 2 notif xương sống (sáng + tối) lần đầu sau onboard
      try {
        const done = await getSetting('notif_auto_setup_v1');
        if (done !== '1') {
          const granted = await requestNotificationPermission();
          if (granted) {
            await scheduleMorningBudget(9, 0);
            await scheduleDailySummary(20, 0);
            await setSetting('morning_enabled', '1');
            await setSetting('morning_hour', '9');
            await setSetting('summary_enabled', '1');
            await setSetting('summary_hour', '20');
          }
          await setSetting('notif_auto_setup_v1', '1');
        }
      } catch (e) {
        if (__DEV__) console.warn('notif auto-setup fail:', e);
      }
      // v3.23 Active Savings: chạy daily allocation 1 lần/ngày
      try {
        const state = useStore.getState();
        const bills = await getBills(state.currentBookId);
        await runDailyAllocation(state.transactions, bills, state.settings, new Date(), state.currentBookId);
      } catch (e) {
        if (__DEV__) console.warn('runDailyAllocation fail:', e);
      }
      setBootDone(true);
    })();
  }, [loadCategories, loadTransactions, loadBudgets, loadSettings, loadWallets, loadBooks]);

  // Gate onboarding: nếu chưa onboard → redirect tới /onboarding (trừ khi đang ở đó)
  useEffect(() => {
    if (!bootDone) return;
    const onboarded = settings.onboarded === '1';
    const inOnboarding = segments[0] === 'onboarding';
    if (!onboarded && !inOnboarding) {
      router.replace('/onboarding');
    }
  }, [bootDone, settings.onboarded, segments, router]);

  // Sync i18n locale từ settings mỗi khi load
  // v3.59 — Xử lý đủ 3 case vi/en/zh (trước đó zh bị fallback về vi gây flash)
  useEffect(() => {
    const locale = settings.locale === 'en' ? 'en' : settings.locale === 'zh' ? 'zh' : 'vi';
    setLocale(locale);
  }, [settings.locale]);

  // F21 — Lock app khi mở lần đầu hoặc trở lại sau >5 phút background
  const setLocked = useAuth((s) => s.setLocked);
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!bootDone) return;
    // Lock ngay khi boot nếu user đã set PIN
    (async () => {
      const pinSet = await hasPin();
      if (pinSet) setLocked(true);
    })();
  }, [bootDone, setLocked]);

  // F5 — handle notification tap: nếu data.screen có path, navigate đến đó
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { screen?: string } | undefined;
      if (data?.screen && typeof data.screen === 'string') {
        // Defer navigate để Stack đã mount
        setTimeout(() => {
          try {
            router.push(data.screen as any);
          } catch (e) {
            if (__DEV__) console.warn('[notif] navigate fail:', e);
          }
        }, 200);
      }
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background' || state === 'inactive') {
        backgroundedAtRef.current = Date.now();
      } else if (state === 'active') {
        // Re-sync currentMonth khi user trở lại app (qua đêm có thể đã sang tháng mới)
        const d = new Date();
        const thisMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        setCurrentMonth(thisMonth);

        const since = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (since && Date.now() - since >= BG_LOCK_THRESHOLD_MS) {
          const pinSet = await hasPin();
          if (pinSet) setLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, [setLocked, setCurrentMonth]);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="edit/[id]"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="streak/index"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="settings/index" />
            <Stack.Screen name="settings/categories" options={{ headerShown: false }} />
            <Stack.Screen name="settings/security" options={{ headerShown: false }} />
            <Stack.Screen name="settings/recurring" options={{ headerShown: false }} />
            <Stack.Screen name="settings/advanced" options={{ headerShown: false }} />
            <Stack.Screen name="settings/wallets" options={{ headerShown: false }} />
            <Stack.Screen name="settings/salary" options={{ headerShown: false }} />
            <Stack.Screen name="settings/language" options={{ headerShown: false }} />
            <Stack.Screen name="settings/savings" options={{ headerShown: false }} />
            <Stack.Screen name="settings/theme" options={{ headerShown: false }} />
            {/* v3.116 — Sổ kế toán mở lại (đã có menu trong tab Khác) */}
            <Stack.Screen name="settings/books" options={{ headerShown: false }} />
            <Stack.Screen name="goals/index" options={{ headerShown: false }} />
            <Stack.Screen name="insights/index" options={{ headerShown: false }} />
            <Stack.Screen name="bills/index" options={{ headerShown: false }} />
            <Stack.Screen name="summary/today" options={{ headerShown: false }} />
            <Stack.Screen name="budget-wizard/index" options={{ headerShown: false }} />
            <Stack.Screen name="premium/index" options={{ headerShown: false }} />
            <Stack.Screen
              name="onboarding/index"
              options={{ headerShown: false, gestureEnabled: false }}
            />
          </Stack>
          <LockScreen />
          <ToastHost />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
