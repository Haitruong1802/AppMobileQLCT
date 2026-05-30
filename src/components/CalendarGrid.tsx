// F46 — Lịch tháng dạng grid 7 cột giống Google Calendar / Sổ thu chi.
import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../store/useTheme';

type DayData = {
  date: string; // YYYY-MM-DD
  expense: number;
  income: number;
};

interface Props {
  month: string; // YYYY-MM
  data: Record<string, { expense: number; income: number }>;
  selectedDate?: string;
  onSelectDate: (date: string) => void;
}

// v3.63 — Monday-first để consistent với StreakBadge week strip (services/streak.ts:weekDays)
const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function shortAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}tr`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export function CalendarGrid({ month, data, selectedDate, onSelectDate }: Props) {
  const palette = useTheme();
  const { width } = Dimensions.get('window');
  const cellW = (width - 32) / 7;

  const grid = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0);
    const daysInMonth = lastDay.getDate();
    // v3.63 — Monday-first: convert getDay() (0=Sun..6=Sat) → 0=Mon..6=Sun
    const startWeekday = (firstDay.getDay() + 6) % 7;

    const cells: (DayData | null)[] = [];
    // Padding bắt đầu (Monday-first)
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    // Ngày trong tháng
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const info = data[dateStr] || { expense: 0, income: 0 };
      cells.push({ date: dateStr, expense: info.expense, income: info.income });
    }
    // Padding cuối để chia hết 7
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month, data]);

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  return (
    <View style={styles.wrap}>
      {/* Header weekdays */}
      <View style={styles.headerRow}>
        {DAY_LABELS.map((d, i) => (
          <View key={d} style={[styles.headerCell, { width: cellW }]}>
            <Text style={[styles.headerText, i === 0 && { color: palette.expense }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Grid rows */}
      <View style={styles.grid}>
        {grid.map((cell, idx) => {
          if (!cell) {
            return <View key={`empty-${idx}`} style={[styles.cell, { width: cellW }]} />;
          }
          const day = parseInt(cell.date.split('-')[2], 10);
          const dayOfWeek = idx % 7;
          const isToday = cell.date === todayStr;
          const isSelected = cell.date === selectedDate;
          const hasData = cell.expense > 0 || cell.income > 0;
          return (
            <TouchableOpacity
              key={cell.date}
              style={[
                styles.cell,
                { width: cellW },
                isSelected && { backgroundColor: palette.primaryLight, borderColor: palette.primary, borderWidth: 1.5 },
              ]}
              onPress={() => onSelectDate(cell.date)}
              activeOpacity={0.6}
            >
              <Text
                style={[
                  styles.dayNum,
                  dayOfWeek === 0 && { color: palette.expense },
                  isToday && { color: palette.primary, fontWeight: '800' },
                  isSelected && { color: palette.primary, fontWeight: '800' },
                ]}
              >
                {day}
              </Text>
              {hasData ? (
                <View style={styles.amountWrap}>
                  {cell.income > 0 ? (
                    <Text style={[styles.amountText, { color: palette.income }]} numberOfLines={1}>
                      +{shortAmount(cell.income)}
                    </Text>
                  ) : null}
                  {cell.expense > 0 ? (
                    <Text style={[styles.amountText, { color: palette.expense }]} numberOfLines={1}>
                      -{shortAmount(cell.expense)}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  headerRow: { flexDirection: 'row', marginBottom: 4 },
  headerCell: { alignItems: 'center', paddingVertical: 6 },
  headerText: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    minHeight: 56,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 8,
  },
  dayNum: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  amountWrap: { alignItems: 'center', marginTop: 2 },
  amountText: { fontSize: 9, fontWeight: '700', lineHeight: 11 },
});
