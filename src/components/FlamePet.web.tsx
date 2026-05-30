// v3.122 — Web fallback cho FlamePet: render emoji placeholder vì Lottie web cần
// `@lottiefiles/dotlottie-react` chưa cài, web bundling fail. App này test trên Expo Go mobile,
// web chỉ là dev preview nên placeholder OK.
import { View, Text, StyleSheet } from 'react-native';

type Props = {
  size?: number;
  ringColor?: string;
  level?: 1 | 2 | 3 | 4 | 5;
};

const STAGE_EMOJI: Record<number, string> = {
  1: '🥚',
  2: '🐣',
  3: '🐥',
  4: '🦅',
  5: '🔥',
};

export function FlamePet({ size = 200, level = 1 }: Props) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <Text style={{ fontSize: size * 0.6 }}>{STAGE_EMOJI[level] ?? '🥚'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
