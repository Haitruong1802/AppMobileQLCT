// v3.147 — Screen chọn Theme màu. Tách khỏi Settings main để gọn.
//   Free user thấy Premium themes ở locked state, tap → ProUpgradeModal.
//   Mua Pro xong KHÔNG tự đổi theme — user phải chủ động chọn.
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { useStore } from '../../src/store/useStore';
import { usePremiumTier } from '../../src/store/usePremium';
import { PALETTES, Palette } from '../../src/theme/colors';
import { useTheme } from '../../src/store/useTheme';
import { ProUpgradeModal } from '../../src/components/ProUpgradeModal';
import { notify } from '../../src/utils/notify';

export default function ThemeScreen() {
  const router = useRouter();
  const settings = useStore((s) => s.settings);
  const updateSetting = useStore((s) => s.updateSetting);
  const tier = usePremiumTier();
  const activePalette = useTheme();
  const currentKey = settings.theme || activePalette.key;

  const [proModalOpen, setProModalOpen] = useState(false);

  const freeThemes = PALETTES.filter((p) => !p.isPremium);
  const premiumThemes = PALETTES.filter((p) => p.isPremium);

  async function pickTheme(p: Palette) {
    if (p.isPremium && tier === 'free') {
      setProModalOpen(true);
      return;
    }
    if (p.key === currentKey) return;
    try {
      await updateSetting('theme', p.key);
      notify(`Đã đổi sang theme ${p.label}.`, 'success');
    } catch {
      notify('Không đổi được theme.', 'error');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="ChevronLeft" size={22} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>Theme màu</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Tùy chỉnh giao diện</Text>
        <Text style={styles.subheading}>
          Chọn bảng màu phù hợp với phong cách của bạn. Theme cao cấp dành cho gói Pro.
        </Text>

        {/* Free section */}
        <Text style={styles.sectionLabel}>Cơ bản</Text>
        <View style={styles.list}>
          {freeThemes.map((p) => (
            <ThemeRow
              key={p.key}
              palette={p}
              isActive={p.key === currentKey}
              isLocked={false}
              onPress={() => pickTheme(p)}
            />
          ))}
        </View>

        {/* Premium section */}
        <Text style={styles.sectionLabel}>Cao cấp</Text>
        <View style={styles.list}>
          {premiumThemes.map((p) => (
            <ThemeRow
              key={p.key}
              palette={p}
              isActive={p.key === currentKey}
              isLocked={tier === 'free'}
              onPress={() => pickTheme(p)}
            />
          ))}
        </View>
      </ScrollView>

      <ProUpgradeModal
        visible={proModalOpen}
        onClose={() => setProModalOpen(false)}
        feature="theme"
      />
    </SafeAreaView>
  );
}

function ThemePreview({ palette, isLocked }: { palette: Palette; isLocked: boolean }) {
  // Nếu có gradient hero (Galaxy/Pride...) → render preview pill nhiều màu segments
  const stops = palette.gradients?.hero?.stops;
  if (stops && stops.length >= 2) {
    return (
      <View style={[styles.gradientPreview, isLocked && { opacity: 0.55 }]}>
        {stops.map((s, i) => (
          <View key={i} style={[styles.gradientSegment, { backgroundColor: s.color }]} />
        ))}
      </View>
    );
  }
  // Fallback: 3 swatch overlap
  return (
    <View style={styles.swatches}>
      {palette.previewColors.map((c, i) => (
        <View
          key={i}
          style={[
            styles.swatch,
            { backgroundColor: c },
            i > 0 && { marginLeft: -8 },
            isLocked && { opacity: 0.55 },
          ]}
        />
      ))}
    </View>
  );
}

function ThemeRow({
  palette,
  isActive,
  isLocked,
  onPress,
}: {
  palette: Palette;
  isActive: boolean;
  isLocked: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, isActive && { borderColor: palette.primary, borderWidth: 2 }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <ThemePreview palette={palette} isLocked={isLocked} />
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, isLocked && { color: '#6b7280' }]}>{palette.label}</Text>
          {palette.isPremium ? (
            <View style={styles.premiumChip}>
              <Icon name="Crown" size={10} color="#92400e" strokeWidth={2.5} />
              <Text style={styles.premiumChipText}>Cao cấp</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.desc} numberOfLines={2}>
          {palette.description}
        </Text>
      </View>
      {isActive ? (
        <View style={[styles.activeBadge, { backgroundColor: palette.primary }]}>
          <Icon name="Check" size={14} color="#fff" strokeWidth={3} />
        </View>
      ) : isLocked ? (
        <View style={styles.lockBadge}>
          <Icon name="Lock" size={14} color="#6b7280" strokeWidth={2.2} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: '#111827' },

  scroll: { padding: 20, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subheading: { fontSize: 13, color: '#6b7280', lineHeight: 19, marginBottom: 20 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 10,
  },

  list: { gap: 10, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: '#fafbfd',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eef0f4',
  },
  swatches: { flexDirection: 'row', alignItems: 'center', width: 64 },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  gradientPreview: {
    flexDirection: 'row',
    width: 64,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  gradientSegment: { flex: 1, height: '100%' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', color: '#111827' },
  desc: { fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 17 },
  premiumChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#fef3c7',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  premiumChipText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  activeBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
});
