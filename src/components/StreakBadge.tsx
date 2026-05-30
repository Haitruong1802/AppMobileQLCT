// F6 — Streak ghi sổ — pill nhỏ ở header tab Nhập.
// v3.82 — Tap pill → router.push('/streak') mở native iOS modal sheet (mượt, pull-down gesture native).
//   Trước đây dùng <Modal> + PanResponder → khựng vì JS bridge.
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { StreakState } from '../services/streak';

type Props = {
  streak: StreakState;
};

export function StreakBadge({ streak }: Props) {
  const router = useRouter();
  const display = streak.displayStreak;
  // v3.108 — Fix LOW: extend dead condition cover case streak gãy nhưng còn badge unlocked
  //   Trước: dead chỉ true khi currentStreak>0 → sau reset (currentStreak=0) + còn badge → pill hiện 🔥 0 confusing.
  //   Sau: dead cũng true khi đã từng có badge (badges.length>0) → display 💤 0 đúng UX.
  const dead = !streak.isAlive && (streak.currentStreak > 0 || streak.badges.length > 0);
  const color = dead ? '#9ca3af' : '#f97316';

  // v3.44 — Flame burst animation khi streak tăng
  const prevDisplayRef = useRef(display);
  const flameScale = useRef(new Animated.Value(1)).current;
  const flameRotate = useRef(new Animated.Value(0)).current;
  const p1 = useRef(new Animated.Value(0)).current;
  const p2 = useRef(new Animated.Value(0)).current;
  const p3 = useRef(new Animated.Value(0)).current;
  const [burstActive, setBurstActive] = useState(false);

  useEffect(() => {
    if (display > prevDisplayRef.current && display > 0) {
      setBurstActive(true);
      flameScale.setValue(1);
      flameRotate.setValue(0);
      p1.setValue(0);
      p2.setValue(0);
      p3.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(flameScale, { toValue: 1.6, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.spring(flameScale, { toValue: 1, friction: 3, tension: 80, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(flameRotate, { toValue: -1, duration: 100, useNativeDriver: true }),
          Animated.timing(flameRotate, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(flameRotate, { toValue: 0, duration: 100, useNativeDriver: true }),
        ]),
        Animated.timing(p1, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(p2, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(p3, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start(() => setBurstActive(false));
    }
    prevDisplayRef.current = display;
  }, [display, flameScale, flameRotate, p1, p2, p3]);

  const rotateInterpol = flameRotate.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-20deg', '20deg'],
  });

  // v3.100 — KHÔNG ẩn pill cho user mới (streak=0). Trước đó ẩn → user mới không vào được /streak.
  //   User mới streak=0 sẽ thấy pill với 🥚 + "Pet" label để mở route đặt tên + onboard.
  const isNewUser = display === 0 && streak.currentStreak === 0 && streak.badges.length === 0;
  const pillEmoji = isNewUser ? '🥚' : dead ? '💤' : '🔥';

  return (
    <TouchableOpacity
      style={[styles.badge, (dead || isNewUser) && styles.badgeDead]}
      onPress={() => router.push('/streak')}
      activeOpacity={0.8}
    >
      <View style={{ position: 'relative' }}>
        <Animated.Text
          style={[
            styles.flame,
            { transform: [{ scale: flameScale }, { rotate: rotateInterpol }] },
          ]}
        >
          {pillEmoji}
        </Animated.Text>
        {burstActive ? <FlameBurst p1={p1} p2={p2} p3={p3} /> : null}
      </View>
      {isNewUser ? (
        <Text style={[styles.num, { color: '#6b7280' }]}>Pet</Text>
      ) : (
        <Text style={[styles.num, { color }]}>{display}</Text>
      )}
    </TouchableOpacity>
  );
}

/** Particle emoji burst overlay khi streak tăng. 3 emoji 🔥 toả 3 hướng. */
function FlameBurst({
  p1,
  p2,
  p3,
}: {
  p1: Animated.Value;
  p2: Animated.Value;
  p3: Animated.Value;
}) {
  const distance = 28;
  const fontSize = 12;
  const mk = (v: Animated.Value, tx: number, ty: number) => ({
    position: 'absolute' as const,
    top: '50%' as const,
    left: '50%' as const,
    fontSize,
    transform: [
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, tx] }) },
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, ty] }) },
      { scale: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1.2, 0.6] }) },
    ],
    opacity: v.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }),
  });
  return (
    <>
      <Animated.Text style={mk(p1, -distance, -distance)}>🔥</Animated.Text>
      <Animated.Text style={mk(p2, distance, -distance)}>🔥</Animated.Text>
      <Animated.Text style={mk(p3, 0, -distance * 1.4)}>✨</Animated.Text>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
  },
  badgeDead: { backgroundColor: '#f3f4f6', borderColor: '#d1d5db' },
  flame: { fontSize: 14 },
  num: { fontWeight: '800', fontSize: 14 },
});
