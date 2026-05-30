// Hộp số liệu chuẩn: label nhỏ + value lớn + optional icon.
// Dùng cho tab Báo cáo, screen Summary, Streak modal stats.
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { FONT_SIZE, FONT_WEIGHT, GRAY, RADIUS, SPACING } from '../theme/tokens';

type Props = {
  label: string;
  value: string | number;
  icon?: string;
  iconColor?: string;
  valueColor?: string;
  align?: 'center' | 'flex-start';
};

export function StatBox({ label, value, icon, iconColor, valueColor, align = 'flex-start' }: Props) {
  return (
    <View style={[styles.box, { alignItems: align }]}>
      <View style={styles.head}>
        {icon ? <Icon name={icon} size={13} color={iconColor || GRAY[500]} /> : null}
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={[styles.value, { color: valueColor || GRAY[900] }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    padding: SPACING.md - 2,
    backgroundColor: GRAY[50],
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  label: {
    fontSize: FONT_SIZE.tiny + 1,
    color: GRAY[500],
    fontWeight: FONT_WEIGHT.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  value: { fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.extrabold },
});
