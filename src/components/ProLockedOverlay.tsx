// v3.132 — Overlay khoá tinh tế cho tính năng Pro khi user Free.
// Children render mờ + không bắt touch. TouchableOpacity transparent trên toàn vùng → tap = onPress.
// Top-right có lock pill nhỏ.
import { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from './Icon';

interface Props {
  locked: boolean;
  onPress?: () => void;
  children: ReactNode;
  /** Vị trí badge: 'tr' (top-right) hoặc 'none'. Default 'tr'. */
  badgePosition?: 'tr' | 'none';
}

export function ProLockedOverlay({ locked, onPress, children, badgePosition = 'tr' }: Props) {
  if (!locked) return <>{children}</>;
  return (
    <View style={styles.wrapper}>
      <View style={styles.dim} pointerEvents="none">
        {children}
      </View>
      {/* Lock badge */}
      {badgePosition === 'tr' ? (
        <View style={styles.lockPill} pointerEvents="none">
          <Icon name="Lock" size={11} color="#1f2937" strokeWidth={2.5} />
          <Text style={styles.lockText}>Pro</Text>
        </View>
      ) : null}
      {/* Transparent tap target */}
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={0.6}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  dim: { opacity: 0.55 },
  lockPill: {
    position: 'absolute',
    top: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#fbbf24',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  lockText: {
    color: '#1f2937',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
