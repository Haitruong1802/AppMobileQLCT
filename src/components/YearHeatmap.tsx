// F57 — Heatmap chi tiêu năm. 365 ô vê đậm/nhạt theo amount.
import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../store/useTheme';

interface Props {
  year: number;
  data: Record<string, number>; // YYYY-MM-DD → expense amount
  onCellPress?: (date: string) => void;
}

export function YearHeatmap({ year, data, onCellPress }: Props) {
  const palette = useTheme();

  const { months, maxAmount } = useMemo(() => {
    let max = 0;
    const months: { month: number; days: { date: string; amount: number }[] }[] = [];
    for (let m = 1; m <= 12; m++) {
      const daysInMonth = new Date(year, m, 0).getDate();
      const days: { date: string; amount: number }[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const key = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const amt = data[key] || 0;
        if (amt > max) max = amt;
        days.push({ date: key, amount: amt });
      }
      months.push({ month: m, days });
    }
    return { months, maxAmount: max };
  }, [year, data]);

  function intensity(amount: number): string {
    if (amount === 0) return '#f3f4f6';
    if (maxAmount === 0) return '#f3f4f6';
    const ratio = amount / maxAmount;
    // 4 levels: 1-25%, 26-50%, 51-75%, 76-100%
    if (ratio <= 0.25) return palette.primary + '40';
    if (ratio <= 0.5) return palette.primary + '80';
    if (ratio <= 0.75) return palette.primary + 'c0';
    return palette.primary;
  }

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  return (
    <View>
      <Text style={styles.title}>Mức chi tiêu năm {year}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.gridWrap}>
          {months.map((mo) => (
            <View key={mo.month} style={styles.monthCol}>
              <Text style={styles.monthLabel}>T{mo.month}</Text>
              <View style={styles.daysGrid}>
                {mo.days.map((d) => {
                  const isToday = d.date === todayStr;
                  return (
                    <TouchableOpacity
                      key={d.date}
                      style={[
                        styles.cell,
                        { backgroundColor: intensity(d.amount) },
                        isToday && { borderWidth: 1.5, borderColor: '#111827' },
                      ]}
                      onPress={() => onCellPress?.(d.date)}
                      activeOpacity={0.6}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendText}>Ít</Text>
        {[0, 0.25, 0.5, 0.75, 1].map((r) => (
          <View
            key={r}
            style={[
              styles.legendCell,
              {
                backgroundColor: r === 0 ? '#f3f4f6' : palette.primary + (r === 0.25 ? '40' : r === 0.5 ? '80' : r === 0.75 ? 'c0' : ''),
              },
            ]}
          />
        ))}
        <Text style={styles.legendText}>Nhiều</Text>
      </View>
    </View>
  );
}

const CELL_SIZE = 14;
const CELL_GAP = 2;

const styles = StyleSheet.create({
  title: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 8 },
  gridWrap: { flexDirection: 'row', gap: 6 },
  monthCol: { alignItems: 'center' },
  monthLabel: { fontSize: 10, color: '#6b7280', fontWeight: '600', marginBottom: 4 },
  daysGrid: { width: CELL_SIZE * 4 + CELL_GAP * 3, flexDirection: 'row', flexWrap: 'wrap', gap: CELL_GAP },
  cell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, justifyContent: 'flex-end' },
  legendText: { fontSize: 10, color: '#9ca3af' },
  legendCell: { width: 12, height: 12, borderRadius: 2 },
});
