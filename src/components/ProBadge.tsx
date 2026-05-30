// v3.125 — Badge "PRO" nhỏ, dùng ở header / topbar / list item.
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from './Icon';

type Size = 'sm' | 'md';

export function ProBadge({ size = 'sm' }: { size?: Size }) {
  const s = size === 'sm' ? styles.sm : styles.md;
  return (
    <View style={[styles.badge, s]}>
      <Icon name="Crown" size={size === 'sm' ? 10 : 12} color="#1f2937" strokeWidth={2.5} />
      <Text style={[styles.text, { fontSize: size === 'sm' ? 9 : 11 }]}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fbbf24',
    borderRadius: 6,
  },
  sm: { paddingHorizontal: 6, paddingVertical: 2 },
  md: { paddingHorizontal: 8, paddingVertical: 3 },
  text: {
    color: '#1f2937',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
