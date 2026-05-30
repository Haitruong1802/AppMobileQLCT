// Section header uppercase chuẩn (giống iOS group label).
import { Text, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { FONT_SIZE, FONT_WEIGHT, GRAY, SPACING } from '../theme/tokens';

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
};

export function SectionHeader({ children, style }: Props) {
  return <Text style={[styles.text, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
    color: GRAY[400],
    letterSpacing: 0.5,
    marginBottom: SPACING.xs + 2,
    marginLeft: SPACING.xs + 2,
    textTransform: 'uppercase',
  },
});
