// Pet = Lottie animation derived từ petx1.json bằng color swap.
// Stage 1: egg. Stage 2: vàng. Stage 3: cam. Stage 4: tím. Stage 5: đỏ rực.
// v3.87 — Bỏ ring/glow (xấu). Chỉ giữ pet + ground oval dưới chân.
import { useEffect, useRef, memo } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import LottieView from 'lottie-react-native';

type Props = {
  size?: number;
  /** Color tint cho ground (theo stage). */
  ringColor?: string;
  /** Stage level 1-5 — chọn Lottie source phù hợp. */
  level?: 1 | 2 | 3 | 4 | 5;
};

const PET_LOTTIE: Record<number, any> = {
  1: require('../assets/lottie/pet/eggpet.json'),
  2: require('../assets/lottie/pet/petx1.json'),
  3: require('../assets/lottie/pet/petx2.json'),
  4: require('../assets/lottie/pet/petx3.json'),
  5: require('../assets/lottie/pet/petx4.json'),
};

function FlamePetInner({ size = 200, ringColor, level = 1 }: Props) {
  const groundScale = useRef(new Animated.Value(1)).current;
  const lottieSource = PET_LOTTIE[level] ?? PET_LOTTIE[1];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(groundScale, { toValue: 1.08, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(groundScale, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [groundScale]);

  // v3.89 — Wrap cao hơn pet 32px để ground luôn có khoảng cách CỐ ĐỊNH với chân pet
  //   (fix: stage 1 lửa egg ground sát pet vì Lottie composition khác stage 2).
  const wrapHeight = size + 32;

  return (
    <View style={[styles.wrap, { width: size, height: wrapHeight }]}>
      {/* Lottie pet animation — neo TOP của wrap, ground có 32px space dưới */}
      <LottieView
        source={lottieSource}
        autoPlay
        loop
        style={{ width: size, height: size }}
      />

      {/* Ground oval dưới chân pet — luôn ở đáy wrap, fixed margin 10px */}
      {ringColor ? (
        <View style={[StyleSheet.absoluteFill, styles.groundLayer]} pointerEvents="none">
          <Animated.View
            style={{
              width: size * 0.55,
              height: 10,
              borderRadius: 5,
              backgroundColor: ringColor + '40',
              marginBottom: 10,
              transform: [{ scaleX: groundScale }],
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

// Memo: tránh Lottie remount + reload animation khi parent re-render với props không đổi
// (vd: đặt tên pet xong → state pet_name update → Streak screen re-render).
export const FlamePet = memo(FlamePetInner);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  groundLayer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
