// F10b — Cấu hình chu kỳ lương cho Safe-to-spend.
// Mặc định OFF (dùng tháng dương lịch). Bật → tính safe-to-spend theo chu kỳ N ngày từ ngày lương.
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { useStore } from '../../src/store/useStore';
import { useTheme } from '../../src/store/useTheme';
import {
  computeSafeToSpend,
  parseSalaryCycleFromSettings,
  SalaryCycleType,
} from '../../src/services/safeToSpend';
import { getBills, Bill } from '../../src/db';
import { formatNumber } from '../../src/utils/format';
import { useT } from '../../src/i18n/useT';

type CycleOption = {
  type: SalaryCycleType;
  days?: number;
  label: string;
  desc: string;
};

function buildCycleOptions(t: (k: string) => string): CycleOption[] {
  return [
    { type: 'monthly', label: t('salary.monthly'), desc: t('salary.monthlyDesc') },
    { type: 'days', days: 15, label: t('salary.every15'), desc: t('salary.every15Desc') },
    { type: 'days', days: 7, label: t('salary.weekly'), desc: t('salary.weeklyDesc') },
  ];
}

export default function SalarySettings() {
  const t = useT();
  const router = useRouter();
  const palette = useTheme();
  const settings = useStore((s) => s.settings);
  const updateSetting = useStore((s) => s.updateSetting);
  const transactions = useStore((s) => s.transactions);
  const currentBookId = useStore((s) => s.currentBookId);
  const CYCLE_OPTIONS = buildCycleOptions(t);

  const initial = parseSalaryCycleFromSettings(settings);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [payday, setPayday] = useState(String(initial.payday));
  const [cycleType, setCycleType] = useState<SalaryCycleType>(initial.cycleType);
  const [cycleDays, setCycleDays] = useState(initial.cycleDays);
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


  async function toggle(v: boolean) {
    setEnabled(v);
    await updateSetting('salary_cycle_enabled', v ? '1' : '0');
  }

  async function changePayday(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 2);
    setPayday(digits);
    const n = parseInt(digits, 10);
    if (n >= 1 && n <= 31) {
      await updateSetting('salary_payday', String(n));
    }
  }

  async function pickCycle(opt: CycleOption) {
    setCycleType(opt.type);
    await updateSetting('salary_cycle_type', opt.type);
    if (opt.type === 'days' && opt.days) {
      setCycleDays(opt.days);
      await updateSetting('salary_cycle_days', String(opt.days));
    }
  }

  // Preview safe-to-spend với config hiện tại
  const currentConfig = {
    enabled,
    payday: Math.max(1, Math.min(31, parseInt(payday, 10) || 10)),
    cycleType,
    cycleDays,
  };
  const preview = computeSafeToSpend(transactions, bills, new Date(), currentConfig);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('salary.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: palette.primaryLight }]}>
                <Icon name="CalendarDays" size={20} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{t('salary.enable')}</Text>
                <Text style={styles.sectionDesc}>{t('salary.enableDesc')}</Text>
              </View>
            </View>
            <Switch
              value={enabled}
              onValueChange={toggle}
              trackColor={{ true: palette.primary, false: '#d1d5db' }}
            />
          </View>
        </View>

        {!enabled ? (
          <View style={styles.tipBox}>
            <Icon name="AlertCircle" size={16} color="#92400e" />
            <Text style={styles.tipText}>{t('salary.off')}</Text>
          </View>
        ) : null}

        {enabled ? (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>{t('salary.payday')}</Text>
              <TextInput
                style={styles.input}
                value={payday}
                onChangeText={changePayday}
                keyboardType="number-pad"
                placeholder="10"
                placeholderTextColor="#9ca3af"
                maxLength={2}
              />
              <Text style={styles.fieldHint}>{t('salary.paydayHint')}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>{t('salary.cycle')}</Text>
              <View style={styles.presetGrid}>
                {CYCLE_OPTIONS.map((opt, idx) => {
                  const selected =
                    cycleType === opt.type &&
                    (opt.type === 'monthly' || cycleDays === opt.days);
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.presetBtn,
                        selected && {
                          backgroundColor: palette.primaryLight,
                          borderColor: palette.primary,
                          borderWidth: 2,
                        },
                      ]}
                      onPress={() => pickCycle(opt)}
                    >
                      <Text
                        style={[
                          styles.presetLabel,
                          selected && { color: palette.primary, fontWeight: '800' },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.presetDesc}>{opt.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.fieldHint}>{t('salary.cycleHint')}</Text>
              {/* v3.65 — M5: Custom days input (cycle khác 7/15/30) */}
              {cycleType === 'days' ? (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.label}>{t('salary.customDays')}</Text>
                  <TextInput
                    style={styles.input}
                    value={String(cycleDays)}
                    onChangeText={(v) => {
                      const n = parseInt(v.replace(/\D/g, ''), 10);
                      if (Number.isFinite(n) && n > 0 && n <= 60) {
                        setCycleDays(n);
                        updateSetting('salary_cycle_days', String(n));
                      } else if (!v) {
                        setCycleDays(0);
                      }
                    }}
                    keyboardType="number-pad"
                    placeholder="Vd: 20"
                    placeholderTextColor="#9ca3af"
                    maxLength={2}
                  />
                  <Text style={styles.fieldHint}>Nhập 1-60 ngày tuỳ chu kỳ lương của bạn</Text>
                </View>
              ) : null}
            </View>

            {/* Preview */}
            <View style={[styles.section, { backgroundColor: palette.primaryLight, borderWidth: 1, borderColor: palette.primary + '40' }]}>
              <Text style={[styles.label, { color: palette.primary }]}>{t('salary.preview')}</Text>
              <Text style={styles.previewRange}>{t('salary.range', { range: preview.rangeLabel })}</Text>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>{t('salary.previewIncome')}</Text>
                <Text style={[styles.previewValue, { color: palette.income }]}>
                  {formatNumber(preview.monthIncome)}đ
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>{t('salary.previewExpense')}</Text>
                <Text style={[styles.previewValue, { color: palette.expense }]}>
                  −{formatNumber(preview.monthExpense)}đ
                </Text>
              </View>
              {preview.pendingBills > 0 ? (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{t('salary.previewPending')}</Text>
                  <Text style={[styles.previewValue, { color: '#9a3412' }]}>
                    −{formatNumber(preview.pendingBills)}đ
                  </Text>
                </View>
              ) : null}
              <View style={[styles.previewRow, styles.previewTotal]}>
                <Text style={styles.previewTotalLabel}>
                  {t('salary.previewTotal', { days: preview.daysRemaining })}
                </Text>
                <Text style={[styles.previewTotalValue, { color: palette.primary }]}>
                  {preview.safeAmount === null
                    ? '-'
                    : `${formatNumber(preview.safeAmount)}đ`}
                </Text>
              </View>
              {preview.safeAmount === null ? (
                <Text style={[styles.fieldHint, { marginTop: 6 }]}>{t('salary.previewEmpty')}</Text>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
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
  container: { padding: 20 },
  section: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 16, marginBottom: 14 },
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
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  fieldHint: { fontSize: 11, color: '#9ca3af', marginTop: 6, lineHeight: 16 },
  presetGrid: { gap: 8 },
  presetBtn: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  presetLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  presetDesc: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  tipBox: {
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
  tipText: { flex: 1, fontSize: 12, color: '#92400e', lineHeight: 17 },
  previewRange: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 10 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  previewLabel: { fontSize: 13, color: '#374151', fontWeight: '500' },
  previewValue: { fontSize: 13, fontWeight: '700' },
  previewTotal: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  previewTotalLabel: { fontSize: 13, color: '#111827', fontWeight: '700', flex: 1 },
  previewTotalValue: { fontSize: 17, fontWeight: '800' },
});
