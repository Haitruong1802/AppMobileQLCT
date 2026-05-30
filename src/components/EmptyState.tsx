// Empty state chuẩn — dùng cho mọi screen "Chưa có dữ liệu".
import { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../store/useTheme';
import { FONT_SIZE, FONT_WEIGHT, GRAY, RADIUS, SPACING } from '../theme/tokens';

type Props = {
  icon: string;
  title: string;
  desc?: string;
  cta?: { label: string; onPress: () => void; icon?: string };
  /** Background color của icon box. Default = palette.primaryLight. */
  iconBg?: string;
  iconColor?: string;
  /** Children render dưới desc (custom action). */
  children?: ReactNode;
};

export function EmptyState({ icon, title, desc, cta, iconBg, iconColor, children }: Props) {
  const palette = useTheme();
  return (
    <View style={styles.container}>
      <View
        style={[styles.iconBox, { backgroundColor: iconBg || palette.primaryLight }]}
      >
        <Icon name={icon} size={42} color={iconColor || palette.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {desc ? <Text style={styles.desc}>{desc}</Text> : null}
      {cta ? (
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: palette.primary }]}
          onPress={cta.onPress}
        >
          {cta.icon ? <Icon name={cta.icon} size={16} color="#fff" /> : null}
          <Text style={styles.ctaText}>{cta.label}</Text>
        </TouchableOpacity>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.sm },
  iconBox: {
    width: 84,
    height: 84,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.bodyLg,
    fontWeight: FONT_WEIGHT.bold,
    color: GRAY[900],
    textAlign: 'center',
  },
  desc: {
    fontSize: FONT_SIZE.small,
    color: GRAY[500],
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: SPACING.xl,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  ctaText: { color: '#fff', fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.body },
});
