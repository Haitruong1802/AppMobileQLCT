// F27 — Bar chart trend (so sánh thu/chi 6 tháng).
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';

export type BarMonth = {
  label: string; // VD "T5"
  expense: number;
  income: number;
};

interface Props {
  data: BarMonth[];
  expenseColor?: string;
  incomeColor?: string;
  height?: number;
}

export function BarChart({
  data,
  expenseColor = '#ef4444',
  incomeColor = '#10b981',
  height = 200,
}: Props) {
  const W = 320;
  const H = height;
  const padL = 36;
  const padR = 10;
  const padT = 10;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxVal = Math.max(
    ...data.flatMap((d) => [d.expense, d.income]),
    1
  );
  const niceMax = niceCeil(maxVal);

  const groupW = innerW / Math.max(data.length, 1);
  const barW = Math.max(4, groupW * 0.32);
  const gap = 2;

  // Y axis labels (4 lines)
  const yLabels = [0, niceMax / 2, niceMax].map((v) => ({
    value: v,
    y: padT + innerH - (v / niceMax) * innerH,
  }));

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={W} height={H}>
        {/* Y grid lines */}
        {yLabels.map((l, i) => (
          <Line
            key={i}
            x1={padL}
            x2={W - padR}
            y1={l.y}
            y2={l.y}
            stroke="#e5e7eb"
            strokeWidth={1}
            strokeDasharray={i === 0 ? undefined : '3,3'}
          />
        ))}
        {yLabels.map((l, i) => (
          <SvgText
            key={`yl-${i}`}
            x={padL - 4}
            y={l.y + 4}
            fontSize={9}
            fill="#9ca3af"
            textAnchor="end"
          >
            {shortNumber(l.value)}
          </SvgText>
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const cx = padL + i * groupW + groupW / 2;
          const expH = (d.expense / niceMax) * innerH;
          const incH = (d.income / niceMax) * innerH;
          return (
            <View key={i}>
              <Rect
                x={cx - barW - gap / 2}
                y={padT + innerH - incH}
                width={barW}
                height={incH || 0}
                fill={incomeColor}
                rx={2}
              />
              <Rect
                x={cx + gap / 2}
                y={padT + innerH - expH}
                width={barW}
                height={expH || 0}
                fill={expenseColor}
                rx={2}
              />
              <SvgText
                x={cx}
                y={H - 10}
                fontSize={10}
                fill="#6b7280"
                textAnchor="middle"
                fontWeight="600"
              >
                {d.label}
              </SvgText>
            </View>
          );
        })}
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: incomeColor }]} />
          <Text style={styles.legendText}>Thu</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: expenseColor }]} />
          <Text style={styles.legendText}>Chi</Text>
        </View>
      </View>
    </View>
  );
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  let nice: number;
  if (n <= 1) nice = 1;
  else if (n <= 2) nice = 2;
  else if (n <= 5) nice = 5;
  else nice = 10;
  return nice * mag;
}

function shortNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(0)}tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}tr`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(Math.round(n));
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 12, color: '#374151', fontWeight: '600' },
});
