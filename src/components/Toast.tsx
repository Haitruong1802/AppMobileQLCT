// v3.120 — Toast host slide-in bottom, dùng cùng useToastStore.
// v3.129 — Bound height max 64px, max 3 lines text ellipsis, không stretch web.
import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ToastItem, useToastStore } from '../store/useToast';

function ToastRow({ item }: { item: ToastItem }) {
  const opacity = useRef(new Animated.Value(0)).current;
  // v3.146 — Toast slide xuống từ trên: bắt đầu translateY=-20, animate về 0.
  const translateY = useRef(new Animated.Value(-20)).current;
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  // v3.146 — Nền trong suốt nhẹ để không choán nội dung phía sau (anh Bux2 thấy nền đen đặc nặng).
  const bg =
    item.variant === 'success'
      ? 'rgba(16, 185, 129, 0.92)'
      : item.variant === 'error'
        ? 'rgba(220, 38, 38, 0.92)'
        : 'rgba(31, 41, 55, 0.82)';

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity, transform: [{ translateY }] }]}>
      <Pressable onPress={() => dismiss(item.id)}>
        <Text style={styles.text} numberOfLines={3}>
          {item.msg}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function ToastHost() {
  const items = useToastStore((s) => s.items);
  if (items.length === 0) return null;
  return (
    <SafeAreaView pointerEvents="box-none" style={styles.host} edges={['top']}>
      <View pointerEvents="box-none" style={styles.stack}>
        {items.map((it) => (
          <ToastRow key={it.id} item={it} />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  host: {
    // v3.146 — Đặt ở trên đầu màn hình thay vì sát đáy (anh Bux2 thấy vướng
    //   với nút Lưu sticky + tab bar). Pattern phổ biến trong iOS native notifications.
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
  },
  stack: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 6,
    width: '100%',
    alignItems: 'center',
  },
  toast: {
    maxWidth: 420,
    width: '90%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  text: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
});
