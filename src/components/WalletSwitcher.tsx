// F32 — Chuyển ví ở Lịch / Báo cáo / Ngân sách. null = Tất cả.
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { useStore } from '../store/useStore';

export function WalletSwitcher() {
  const wallets = useStore((s) => s.wallets);
  const currentWalletId = useStore((s) => s.currentWalletId);
  const setCurrentWalletId = useStore((s) => s.setCurrentWalletId);

  if (wallets.length <= 1) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.wrap}>
      <TouchableOpacity
        style={[
          styles.pill,
          currentWalletId === null && styles.pillActive,
        ]}
        onPress={() => setCurrentWalletId(null)}
      >
        <Text
          style={[
            styles.pillText,
            currentWalletId === null && { color: '#111827', fontWeight: '700' },
          ]}
        >
          Tất cả ví
        </Text>
      </TouchableOpacity>
      {wallets.map((w) => {
        const selected = currentWalletId === w.id;
        return (
          <TouchableOpacity
            key={w.id}
            style={[
              styles.pill,
              selected && { borderColor: w.color, borderWidth: 2, backgroundColor: w.color + '15' },
            ]}
            onPress={() => setCurrentWalletId(w.id)}
          >
            <Icon name={w.icon} size={12} color={selected ? w.color : '#6b7280'} />
            <Text
              style={[
                styles.pillText,
                selected && { color: w.color, fontWeight: '700' },
              ]}
              numberOfLines={1}
            >
              {w.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', marginBottom: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 6,
  },
  pillActive: {
    backgroundColor: '#fff',
    borderColor: '#111827',
    borderWidth: 1.5,
  },
  pillText: { fontSize: 12, color: '#6b7280', fontWeight: '600', maxWidth: 100 },
});
