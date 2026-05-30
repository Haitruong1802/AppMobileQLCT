import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';

export type PieSlice = {
  value: number;
  color: string;
  label: string;
};

type Props = {
  slices: PieSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
};

/**
 * Vẽ pie chart dạng donut bằng SVG. Không phụ thuộc thư viện chart heavy.
 */
export function PieChart({ slices, size = 200, thickness = 36, centerLabel, centerValue }: Props) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const radius = size / 2;
  const innerRadius = radius - thickness;
  const cx = radius;
  const cy = radius;

  if (total === 0) {
    return (
      <View style={[styles.wrap, { width: size, height: size }]}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Chưa có dữ liệu</Text>
        </View>
      </View>
    );
  }

  // 1 slice = 100%: SVG arc A không vẽ được full circle (start=end degenerate), dùng Circle thay.
  if (slices.length === 1) {
    return (
      <View style={[styles.wrap, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cy} r={radius} fill={slices[0].color} />
          <Circle cx={cx} cy={cy} r={innerRadius - 2} fill="#fff" />
        </Svg>
        {(centerLabel || centerValue) && (
          <View style={styles.center} pointerEvents="none">
            {centerLabel && <Text style={styles.centerLabel}>{centerLabel}</Text>}
            {centerValue && <Text style={styles.centerValue}>{centerValue}</Text>}
          </View>
        )}
      </View>
    );
  }

  let currentAngle = -Math.PI / 2; // start from top
  const paths = slices.map((s, i) => {
    const angle = (s.value / total) * 2 * Math.PI;
    const x1 = cx + radius * Math.cos(currentAngle);
    const y1 = cy + radius * Math.sin(currentAngle);
    const x2 = cx + radius * Math.cos(currentAngle + angle);
    const y2 = cy + radius * Math.sin(currentAngle + angle);
    const xi1 = cx + innerRadius * Math.cos(currentAngle + angle);
    const yi1 = cy + innerRadius * Math.sin(currentAngle + angle);
    const xi2 = cx + innerRadius * Math.cos(currentAngle);
    const yi2 = cy + innerRadius * Math.sin(currentAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const d = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${xi1} ${yi1}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${xi2} ${yi2}`,
      'Z',
    ].join(' ');

    currentAngle += angle;
    return <Path key={i} d={d} fill={s.color} />;
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G>{paths}</G>
        <Circle cx={cx} cy={cy} r={innerRadius - 2} fill="#fff" />
      </Svg>
      {(centerLabel || centerValue) && (
        <View style={styles.center} pointerEvents="none">
          {centerLabel && <Text style={styles.centerLabel}>{centerLabel}</Text>}
          {centerValue && <Text style={styles.centerValue}>{centerValue}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  center: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as any,
  centerLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  centerValue: { fontSize: 16, color: '#111827', fontWeight: '800', marginTop: 2 },
  empty: { width: '100%', height: '100%', borderRadius: 9999, borderWidth: 4, borderColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 12 },
});
