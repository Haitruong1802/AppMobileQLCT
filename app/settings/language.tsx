// Cài đặt ngôn ngữ — 3 option + nút Áp dụng. User pick rồi mới apply.
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { useStore } from '../../src/store/useStore';
import { useTheme } from '../../src/store/useTheme';
import { AVAILABLE_LOCALES, Locale, setLocale, parseLocale } from '../../src/i18n';
import { useT } from '../../src/i18n/useT';

export default function LanguageSettings() {
  const t = useT();
  const router = useRouter();
  const palette = useTheme();
  const settings = useStore((s) => s.settings);
  const updateSetting = useStore((s) => s.updateSetting);

  const current: Locale = parseLocale(settings.locale);
  const [picked, setPicked] = useState<Locale>(current);

  async function apply() {
    if (picked === current) {
      router.back();
      return;
    }
    setLocale(picked); // Sync ngay để UI re-render sau khi updateSetting
    await updateSetting('locale', picked);
    router.back();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('language.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.hint}>{t('language.hint')}</Text>

        {AVAILABLE_LOCALES.map((l) => {
          const selected = picked === l.code;
          return (
            <TouchableOpacity
              key={l.code}
              style={[
                styles.row,
                selected && {
                  backgroundColor: palette.primaryLight,
                  borderColor: palette.primary,
                  borderWidth: 2,
                },
              ]}
              onPress={() => setPicked(l.code)}
              activeOpacity={0.7}
            >
              <Text style={styles.flag}>{l.flag}</Text>
              <Text
                style={[
                  styles.label,
                  selected && { color: palette.primary, fontWeight: '800' },
                ]}
              >
                {l.label}
              </Text>
              <View
                style={[
                  styles.radio,
                  selected && { borderColor: palette.primary, backgroundColor: palette.primary },
                ]}
              >
                {selected ? <Icon name="Check" size={14} color="#fff" /> : null}
              </View>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.note}>{t('language.note')}</Text>

        <TouchableOpacity
          style={[
            styles.applyBtn,
            { backgroundColor: palette.primary },
            picked === current && { opacity: 0.5 },
          ]}
          onPress={apply}
          disabled={picked === current}
          activeOpacity={0.85}
        >
          <Text style={styles.applyText}>{t('language.apply')}</Text>
        </TouchableOpacity>
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
  container: { padding: 16 },
  hint: { fontSize: 12, color: '#6b7280', lineHeight: 17, marginBottom: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  flag: { fontSize: 28 },
  label: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { fontSize: 11, color: '#9ca3af', fontStyle: 'italic', marginTop: 14, lineHeight: 16 },
  applyBtn: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
