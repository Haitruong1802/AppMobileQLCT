// F15 — Onboarding 4 màn cho user mới.
// v3.143 — Rollback về layout ban đầu (icon to center + title + desc + dots dưới + 1 button).
//   Polish nhẹ: wording chuyên nghiệp hơn, bỏ em-dash, anti-spam nút.
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import { Icon } from '../../src/components/Icon';
import { useTheme } from '../../src/store/useTheme';
import { useT } from '../../src/i18n/useT';
import { t } from '../../src/i18n';

type Step = {
  iconName: string;
  iconBgColor: string;
  iconFgColor: string;
  title: string;
  desc: string;
  cta: string;
};

export default function Onboarding() {
  useT();
  const router = useRouter();
  const updateSetting = useStore((s) => s.updateSetting);
  const palette = useTheme();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const steps: Step[] = [
    {
      iconName: 'Wallet',
      iconBgColor: palette.primaryLight,
      iconFgColor: palette.primary,
      title: t('onboarding.s1.title'),
      desc: t('onboarding.s1.desc'),
      cta: t('onboarding.continue'),
    },
    {
      iconName: 'Sparkles',
      iconBgColor: palette.primaryLight,
      iconFgColor: palette.primary,
      title: t('onboarding.s2.title'),
      desc: t('onboarding.s2.desc'),
      cta: t('onboarding.continue'),
    },
    {
      iconName: 'BarChart3',
      iconBgColor: palette.primaryLight,
      iconFgColor: palette.primary,
      title: t('onboarding.s3.title'),
      desc: t('onboarding.s3.desc'),
      cta: t('onboarding.continue'),
    },
    {
      iconName: 'Lock',
      iconBgColor: palette.primaryLight,
      iconFgColor: palette.primary,
      title: t('onboarding.s4.title'),
      desc: t('onboarding.s4.desc'),
      cta: t('onboarding.start'),
    },
  ];

  const current = steps[step];

  async function finish() {
    if (busy) return;
    setBusy(true);
    try {
      await updateSetting('onboarded', '1');
    } catch {
      /* noop */
    }
    router.replace('/(tabs)');
  }

  function next() {
    if (busy) return;
    if (step < steps.length - 1) setStep(step + 1);
    else finish();
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.skipRow}>
        {step > 0 ? (
          <TouchableOpacity onPress={back} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t('onboarding.back')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ height: 24 }} />
        )}
        {step < steps.length - 1 ? (
          <TouchableOpacity onPress={finish} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ height: 24 }} />
        )}
      </View>

      <View style={styles.content}>
        <View style={[styles.iconBox, { backgroundColor: current.iconBgColor }]}>
          <Icon name={current.iconName} size={64} color={current.iconFgColor} strokeWidth={1.6} />
        </View>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.desc}>{current.desc}</Text>
      </View>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === step ? palette.primary : '#d1d5db',
                  width: i === step ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: palette.primary }, busy && { opacity: 0.6 }]}
          onPress={next}
          disabled={busy}
          activeOpacity={0.85}
          accessibilityLabel={current.cta}
        >
          <Text style={styles.nextBtnText}>{current.cta}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  skipBtn: { padding: 8 },
  skipText: { color: '#6b7280', fontWeight: '600', fontSize: 14 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconBox: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  desc: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 340,
  },
  bottom: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 8 : 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16 },
  dot: { height: 8, borderRadius: 4 },
  nextBtn: { padding: 16, borderRadius: 14, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
