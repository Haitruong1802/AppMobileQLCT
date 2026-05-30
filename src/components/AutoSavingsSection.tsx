// v3.133 — AutoSavings section, gộp vào trong Mục tiêu tiết kiệm.
// Extract logic từ app/settings/savings.tsx để reuse, không phá feature.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Icon } from './Icon';
import { useStore } from '../store/useStore';
import { useTheme } from '../store/useTheme';
import { useT } from '../i18n/useT';
import { notify } from '../utils/notify';
import { parseActiveSavingsFromSettings } from '../services/activeSavings';
import { usePremiumTier } from '../store/usePremium';
import { ProLockedOverlay } from './ProLockedOverlay';
import {
  requestNotificationPermission,
  scheduleSavingsNudge,
  cancelSavingsNudge,
  isSavingsNudgeScheduled,
} from '../services/notifications';
import { getBills, Bill } from '../db';
import { computeSafeToSpend, parseSalaryCycleFromSettings } from '../services/safeToSpend';
import { formatNumber } from '../utils/format';

const PCT_PRESETS = [3, 5, 10];

interface Props {
  /** Số mục tiêu hoạt động — quyết định info text. */
  activeGoalsCount: number;
  /** Callback khi free user tap → mở ProUpgradeModal ở parent. */
  onLockedTap: () => void;
}

export function AutoSavingsSection({ activeGoalsCount, onLockedTap }: Props) {
  const t = useT();
  const palette = useTheme();
  const settings = useStore((s) => s.settings);
  const updateSetting = useStore((s) => s.updateSetting);
  const transactions = useStore((s) => s.transactions);
  const currentBookId = useStore((s) => s.currentBookId);
  const tier = usePremiumTier();

  const [bills, setBills] = useState<Bill[]>([]);
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

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setNotifEnabled(await isSavingsNudgeScheduled());
      })();
    }, [])
  );

  async function toggleEnabled(v: boolean) {
    if (v && tier === 'free') {
      onLockedTap();
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
    if (v && tier === 'free') {
      onLockedTap();
      return;
    }
    setSuggestEnabled(v);
    await updateSetting('savings_suggest_enabled', v ? '1' : '0');
  }

  async function toggleNotif(v: boolean) {
    if (v && tier === 'free') {
      onLockedTap();
      return;
    }
    if (v) {
      const ok = await requestNotificationPermission();
      if (!ok) return notify(t('savings.err.notifPermission'), 'error');
      const id = await scheduleSavingsNudge(22, 0);
      if (!id) return notify(t('savings.err.scheduleFailed'), 'error');
      setNotifEnabled(true);
      await updateSetting('savings_notif_enabled', '1');
    } else {
      await cancelSavingsNudge();
      setNotifEnabled(false);
      await updateSetting('savings_notif_enabled', '0');
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.headRow}>
        <Text style={styles.headTitle}>Tự động tiết kiệm</Text>
        {tier === 'pro' ? null : (
          <View style={styles.advancedPill}>
            <Icon name="Crown" size={10} color="#1f2937" strokeWidth={2.5} />
            <Text style={styles.advancedText}>Nâng cao</Text>
          </View>
        )}
      </View>
      {activeGoalsCount === 0 ? (
        <View style={styles.warnBox}>
          <Icon name="AlertCircle" size={14} color="#92400e" />
          <Text style={styles.warnText}>Tạo mục tiêu trước rồi quay lại bật tự động chích.</Text>
        </View>
      ) : null}

      <ProLockedOverlay locked={tier === 'free'} onPress={onLockedTap}>
        {/* Toggle bật/tắt auto-chích */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: palette.primaryLight }]}>
                <Icon name="Sparkles" size={18} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{t('savings.auto')}</Text>
                <Text style={styles.sectionDesc} numberOfLines={2}>
                  {t('savings.autoDesc')}
                </Text>
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

        {/* Toggle gợi ý cộng dư */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: palette.primaryLight }]}>
                <Icon name="TrendingUp" size={18} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{t('savings.suggest')}</Text>
                <Text style={styles.sectionDesc} numberOfLines={2}>
                  {t('savings.suggestDesc')}
                </Text>
              </View>
            </View>
            <Switch
              value={suggestEnabled && tier === 'pro'}
              onValueChange={toggleSuggest}
              trackColor={{ true: palette.primary, false: '#d1d5db' }}
              disabled={tier === 'free'}
            />
          </View>
        </View>

        {/* Toggle nhắc 22h */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: palette.primaryLight }]}>
                <Icon name="Bell" size={18} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{t('savings.notif22')}</Text>
                <Text style={styles.sectionDesc} numberOfLines={2}>
                  {t('savings.notif22Desc')}
                </Text>
              </View>
            </View>
            <Switch
              value={notifEnabled && tier === 'pro'}
              onValueChange={toggleNotif}
              trackColor={{ true: palette.primary, false: '#d1d5db' }}
              disabled={tier === 'free'}
            />
          </View>
        </View>
      </ProLockedOverlay>

      <Text style={styles.foot}>{t('savings.foot')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 24, gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  headTitle: { fontSize: 16, fontWeight: '800', color: '#111827', flex: 1 },
  advancedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#fbbf24',
    borderRadius: 8,
  },
  advancedText: { color: '#1f2937', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  warnBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  warnText: { flex: 1, fontSize: 12, color: '#92400e' },
  section: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  sectionDesc: { fontSize: 11, color: '#6b7280', marginTop: 3, lineHeight: 15 },
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
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  pctText: { fontSize: 13, fontWeight: '700', color: '#111827' },
  hint: { fontSize: 11, color: '#9ca3af', marginTop: 8, fontStyle: 'italic', lineHeight: 16 },
  foot: { fontSize: 11, color: '#9ca3af', marginTop: 8, lineHeight: 17, paddingHorizontal: 4 },
});
