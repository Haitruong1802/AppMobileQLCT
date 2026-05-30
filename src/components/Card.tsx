// Card chuẩn — variant flat (nền xám) hoặc elevated (nền trắng + shadow).
import { View, ViewProps, StyleSheet } from 'react-native';
import { GRAY, RADIUS, SHADOW, SPACING } from '../theme/tokens';

type Variant = 'flat' | 'elevated' | 'tinted';

type Props = ViewProps & {
  variant?: Variant;
  /** Padding bên trong card. Default: SPACING.lg (16) */
  padding?: keyof typeof SPACING | number;
  /** Tint background — chỉ áp dụng khi variant='tinted'. */
  tintColor?: string;
  borderColor?: string;
};

export function Card({
  variant = 'flat',
  padding = 'lg',
  tintColor,
  borderColor,
  style,
  children,
  ...rest
}: Props) {
  const pad =
    typeof padding === 'number' ? padding : SPACING[padding as keyof typeof SPACING];
  return (
    <View
      {...rest}
      style={[
        styles.base,
        variant === 'flat' && styles.flat,
        variant === 'elevated' && [styles.elevated, SHADOW.sm],
        variant === 'tinted' && {
          backgroundColor: tintColor || GRAY[50],
          borderWidth: 1,
          borderColor: borderColor || GRAY[200],
        },
        { padding: pad },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: RADIUS.lg },
  flat: { backgroundColor: GRAY[50] },
  elevated: { backgroundColor: '#fff' },
});
