// Cài đặt nâng cao: DEV-only test pet stages.
// v3.78 — Xoá block "API key Gemini riêng" (app 100% offline, không dùng AI).
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { notify } from '../../src/utils/notify';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { useTheme } from '../../src/store/useTheme';
import { useT } from '../../src/i18n/useT';
import { t } from '../../src/i18n';
import { getDb } from '../../src/db';

export default function Advanced() {
  const router = useRouter();
  useT();
  const palette = useTheme();

  // DEV: Set streak giả để test pet stages.
  // KHÔNG gọi recomputeStreak (sẽ overwrite về 0 vì không có TX).
  // Quay về tab Nhập → useFocusEffect tự refresh streak state.
  async function setTestStreak(days: number) {
    try {
      const db = await getDb();
      const todayLocal = (() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      })();
      await db.runAsync(
        'UPDATE streaks SET current_streak = ?, longest_streak = MAX(longest_streak, ?), last_active_date = ? WHERE id = 1',
        [days, days, todayLocal]
      );
      notify(`✓ Đã set streak = ${days} ngày. Quay về tab Nhập → tap 🔥 xem pet.`);
    } catch (e: any) {
      notify(`Lỗi: ${e?.message || 'unknown'}`);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings.advanced')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* DEV: Test pet stages bằng cách set streak giả */}
        <View style={[styles.section, { borderWidth: 1, borderColor: '#fde68a', backgroundColor: '#fffbeb' }]}>
          <View style={styles.sectionHead}>
            <View style={[styles.sectionIcon, { backgroundColor: '#fef3c7' }]}>
              <Icon name="Sparkles" size={20} color="#92400e" />
            </View>
            <Text style={[styles.sectionTitle, { color: '#92400e' }]}>DEV · Test Pet stages</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Set streak giả để xem pet stage tương ứng. Dùng để test, không phải feature thật.
          </Text>
          <View style={styles.testRow}>
            {[1, 7, 30, 100, 365].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.testBtn, { backgroundColor: palette.primary }]}
                onPress={() => setTestStreak(d)}
              >
                <Text style={styles.testBtnText}>{d}d</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
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
  section: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 16, marginBottom: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sectionDesc: { fontSize: 13, color: '#6b7280', lineHeight: 20, marginBottom: 12 },
  testRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  testBtn: { flex: 1, minWidth: 50, padding: 10, borderRadius: 10, alignItems: 'center' },
  testBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
