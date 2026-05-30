// F9 — Cool-down cho chi tiêu lớn. Tâm lý học behavioral nudge.
// Khi user nhập chi > ngưỡng cho category "tiêu vào quá tay" → popup countdown + so sánh
// "X = N bữa trưa" → user phải chờ N giây mới bấm xác nhận được.
// v3.99 — Giảm countdown 5s → 3s (đại ca thấy 5s lâu). Emoji ⏳ → 🍺 (ly bia, hợp Giao lưu).
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { useTheme } from '../store/useTheme';
import { formatNumber } from '../utils/format';
import { FONT_SIZE, FONT_WEIGHT, GRAY, RADIUS, SEMANTIC, SPACING } from '../theme/tokens';

const COUNTDOWN_SECONDS = 3;

/** Bảng so sánh giá: X đồng tương đương... */
const COMPARISONS: { name: string; emoji: string; price: number }[] = [
  { name: 'bữa trưa', emoji: '🍜', price: 50_000 },
  { name: 'ly cà phê', emoji: '☕', price: 35_000 },
  { name: 'lần Grab', emoji: '🚖', price: 45_000 },
  { name: 'lần đổ xăng', emoji: '⛽', price: 60_000 },
  { name: 'đêm Đà Lạt', emoji: '🏔', price: 800_000 },
  { name: 'AirPods 4', emoji: '🎧', price: 3_500_000 },
];

function bestComparison(amount: number): { name: string; emoji: string; count: number } | null {
  // Tìm item mà amount/price ra số đẹp (5-30 lần)
  for (const c of COMPARISONS) {
    const count = Math.round(amount / c.price);
    if (count >= 3 && count <= 30) {
      return { name: c.name, emoji: c.emoji, count };
    }
  }
  // Fallback: dùng bữa trưa
  const count = Math.round(amount / COMPARISONS[0].price);
  if (count >= 2) return { name: COMPARISONS[0].name, emoji: COMPARISONS[0].emoji, count };
  return null;
}

type Props = {
  visible: boolean;
  amount: number;
  categoryName: string;
  note?: string;
  onProceed: () => void;
  onCancel: () => void;
};

export function CoolDownModal({ visible, amount, categoryName, note, onProceed, onCancel }: Props) {
  const palette = useTheme();
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setSecondsLeft(COUNTDOWN_SECONDS);
      progress.setValue(0);
      return;
    }
    // Animate progress 0→1 over COUNTDOWN_SECONDS
    Animated.timing(progress, {
      toValue: 1,
      duration: COUNTDOWN_SECONDS * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    // Counter
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [visible, progress]);

  const ready = secondsLeft === 0;
  const cmp = bestComparison(amount);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🍺</Text>
          <Text style={styles.title}>Khoản này hơi lớn so với thường ngày</Text>

          <View style={styles.amountBox}>
            <Text style={styles.amount}>{formatNumber(amount)}đ</Text>
            <Text style={styles.cat}>{note ? `"${note}" · ` : ''}{categoryName}</Text>
          </View>

          {cmp ? (
            <View style={styles.compareBox}>
              <Text style={styles.compareEmoji}>{cmp.emoji}</Text>
              <Text style={styles.compareText}>
                ≈ <Text style={styles.compareNum}>{cmp.count}</Text> {cmp.name}
              </Text>
            </View>
          ) : null}

          <Text style={styles.hint}>
            Chờ {COUNTDOWN_SECONDS} giây để cân nhắc nha. Vẫn muốn ghi thì bấm nút bên dưới.
          </Text>

          {/* Progress bar */}
          <View style={styles.progressBg}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: progressWidth, backgroundColor: palette.primary },
              ]}
            />
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Huỷ ghi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.proceedBtn,
                { backgroundColor: ready ? palette.primary : GRAY[200] },
              ]}
              onPress={onProceed}
              disabled={!ready}
            >
              <Text
                style={[styles.proceedText, { color: ready ? '#fff' : GRAY[400] }]}
              >
                {ready ? 'Vẫn ghi' : `Chờ ${secondsLeft}s`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emoji: { fontSize: 40 },
  title: {
    fontSize: FONT_SIZE.titleLg,
    fontWeight: FONT_WEIGHT.extrabold,
    color: GRAY[900],
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  amountBox: {
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  amount: {
    fontSize: FONT_SIZE.hero,
    fontWeight: FONT_WEIGHT.extrabold,
    color: SEMANTIC.danger.text,
  },
  cat: { fontSize: FONT_SIZE.small, color: GRAY[500], marginTop: SPACING.xs },
  compareBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: SEMANTIC.warning.bg,
    paddingHorizontal: SPACING.md + 2,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  compareEmoji: { fontSize: 22 },
  compareText: {
    fontSize: FONT_SIZE.bodyLg,
    color: SEMANTIC.warning.text,
    fontWeight: FONT_WEIGHT.semibold,
  },
  compareNum: { fontWeight: FONT_WEIGHT.extrabold, fontSize: FONT_SIZE.title },
  hint: {
    fontSize: FONT_SIZE.small,
    color: GRAY[500],
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  progressBg: {
    width: '100%',
    height: 6,
    backgroundColor: GRAY[200],
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  progressFill: { height: '100%' },
  btnRow: { flexDirection: 'row', gap: SPACING.sm, width: '100%' },
  cancelBtn: {
    flex: 1,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    backgroundColor: GRAY[100],
  },
  cancelText: { color: GRAY[800], fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.body },
  proceedBtn: {
    flex: 1,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  proceedText: { fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.body },
});
