// v3.23 — Cài đặt Tự động tiết kiệm.
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { useStore } from '../../src/store/useStore';
import { useTheme } from '../../src/store/useTheme';
import { useT } from '../../src/i18n/useT';
import { notify } from '../../src/utils/notify';
import { parseActiveSavingsFromSettings } from '../../src/services/activeSavings';
import { usePremiumTier } from '../../src/store/usePremium';
import { ProUpgradeModal } from '../../src/components/ProUpgradeModal';
import { ProLockedOverlay } from '../../src/components/ProLockedOverlay';
import {
  requestNotificationPermission,
  scheduleSavingsNudge,
  cancelSavingsNudge,
  isSavingsNudgeScheduled,
} from '../../src/services/notifications';
import { getSavingsGoals, getBills, SavingsGoal, Bill } from '../../src/db';
import { computeSafeToSpend, parseSalaryCycleFromSettings } from '../../src/services/safeToSpend';
import { formatNumber } from '../../src/utils/format';

const PCT_PRESETS = [3, 5, 10];

export default function ActiveSavingsSettings() {
  const t = useT();
  const router = useRouter();
  const palette = useTheme();
  const settings = useStore((s) => s.settings);
  const updateSetting = useStore((s) => s.updateSetting);
  const transactions = useStore((s) => s.transactions);
  const currentBookId = useStore((s) => s.currentBookId);
  const [bills, setBills] = useState<Bill[]>([]);
  // v3.65 — L7: Load bills để compute safe-to-spend preview thật từ data user
  useEffect(() => {
    (async () => {
      try {
        setBills(await getBills(currentBookId));
      } catch {
        /* noop */
      }
    })();
  }, [currentBookId]);

  const initial = parseActiveSavingsFromSettings(settings);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [pct, setPct] = useState(initial.pct);
  const [suggestEnabled, setSuggestEnabled] = useState(initial.suggestEnabled);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [activeGoals, setActiveGoals] = useState<SavingsGoal[]>([]);
  const tier = usePremiumTier();
  const [proModalOpen, setProModalOpen] = useState(false);

  // v3.115 — useFocusEffect để re-sync khi user tắt notif từ Settings hệ thống rồi quay lại
  useFocusEffect(
    useCallback(() => {
      (async () => {
        setNotifEnabled(await isSavingsNudgeScheduled());
        const goals = await getSavingsGoals(currentBookId);
        setActiveGoals(goals.filter((g) => !g.completed_at));
      })();
    }, [currentBookId])
  );

  async function toggleEnabled(v: boolean) {
    // v3.131 — Free tap → mở modal upgrade (không redirect ngay)
    if (v && tier === 'free') {
      setProModalOpen(true);
      return;
    }
    setEnabled(v);
    await updateSetting('savings_auto_enabled', v ? '1' : '0');
  }

  async function changePct(p: number) {
    setPct(p);
    await updateSetting('savings_auto_pct', String(p));
  }

  async function toggleSuggest(v: boolean) {
    setSuggestEnabled(v);
    await updateSetting('savings_suggest_enabled', v ? '1' : '0');
  }

  async function toggleNotif(v: boolean) {
    if (v) {
      const ok = await requestNotificationPermission();
      if (!ok) return notify(t('savings.err.notifPermission'));
      const id = await scheduleSavingsNudge(22, 0);
      if (!id) return notify(t('savings.err.scheduleFailed'));
      setNotifEnabled(true);
      await updateSetting('savings_notif_enabled', '1');
    } else {
      await cancelSavingsNudge();
      setNotifEnabled(false);
      await updateSetting('savings_notif_enabled', '0');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('savings.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {activeGoals.length === 0 ? (
          <View style={styles.warnBox}>
            <Icon name="AlertCircle" size={16} color="#92400e" />
            <Text style={styles.warnText}>{t('savings.warnNoGoals')}</Text>
          </View>
        ) : (
          <View style={styles.infoBox}>
            <Icon name="Crown" size={16} color={palette.primary} />
            <Text style={styles.infoText}>{t('savings.infoGoals', { n: activeGoals.length })}</Text>
          </View>
        )}

        {/* Toggle bật/tắt — v3.132 wrap trong ProLockedOverlay khi Free */}
        <ProLockedOverlay locked={tier === 'free'} onPress={() => setProModalOpen(true)}>
          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <View style={styles.sectionHead}>
                <View style={[styles.sectionIcon, { backgroundColor: palette.primaryLight }]}>
                  <Icon name="Crown" size={20} color={palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{t('savings.auto')}</Text>
                  <Text style={styles.sectionDesc}>{t('savings.autoDesc')}</Text>
                </View>
              </View>
              <Switch
                value={enabled && tier === 'pro'}
                onValueChange={toggleEnabled}
                trackColor={{ true: palette.primary, false: '#d1d5db' }}
                disabled={tier === 'free'}
              />
            </View>
            {enabled && tier === 'pro' ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.label}>{t('savings.pctLabel')}</Text>
                <View style={styles.pctRow}>
                  {PCT_PRESETS.map((p) => {
                    const selected = pct === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.pctBtn,
                          selected && { backgroundColor: palette.primary, borderColor: palette.primary },
                        ]}
                        onPress={() => changePct(p)}
                      >
                        <Text style={[styles.pctText, selected && { color: '#fff', fontWeight: '800' }]}>
                          {p}%
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {(() => {
                  const cycleConfig = parseSalaryCycleFromSettings(settings);
                  const safe = computeSafeToSpend(transactions, bills, new Date(), cycleConfig);
                  const safeAmount = safe.safeAmount ?? 0;
                  const daily = Math.floor((safeAmount * pct) / 100 / 1000) * 1000;
                  return (
                    <Text style={styles.hint}>
                      {safeAmount > 0
                        ? t('savings.hintWithData', { safe: formatNumber(safeAmount), pct, daily: formatNumber(daily) })
                        : t('savings.hintEmpty', { pct })}
                    </Text>
                  );
                })()}
              </View>
            ) : null}
          </View>
        </ProLockedOverlay>

        {/* Toggle gợi ý cộng dư */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: palette.primaryLight }]}>
                <Icon name="Sparkles" size={20} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{t('savings.suggest')}</Text>
                <Text style={styles.sectionDesc}>{t('savings.suggestDesc')}</Text>
              </View>
            </View>
            <Switch
              value={suggestEnabled}
              onValueChange={toggleSuggest}
              trackColor={{ true: palette.primary, false: '#d1d5db' }}
            />
          </View>
        </View>

        {/* Toggle notif 22h */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: palette.primaryLight }]}>
                <Icon name="Bell" size={20} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{t('savings.notif22')}</Text>
                <Text style={styles.sectionDesc}>{t('savings.notif22Desc')}</Text>
              </View>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={toggleNotif}
              trackColor={{ true: palette.primary, false: '#d1d5db' }}
            />
          </View>
        </View>

        <Text style={styles.foot}>{t('savings.foot')}</Text>
      </ScrollView>

      <ProUpgradeModal
        visible={proModalOpen}
        feature="autoSavings"
        onClose={() => setProModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  container: { padding: 16 },
  warnBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  warnText: { flex: 1, fontSize: 12, color: '#92400e', lineHeight: 17 },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12, color: '#065f46', lineHeight: 17 },
  section: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  sectionDesc: { fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 17 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  pctRow: { flexDirection: 'row', gap: 8 },
  pctBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  pctText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  hint: { fontSize: 11, color: '#9ca3af', marginTop: 8, fontStyle: 'italic', lineHeight: 16 },
  foot: { fontSize: 11, color: '#9ca3af', marginTop: 14, lineHeight: 17, paddingHorizontal: 4 },
});
