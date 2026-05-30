// F22 — Header chuyển tháng cho Lịch/Báo cáo/Ngân sách.
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Platform } from 'react-native';
import { Icon } from './Icon';
import { useStore } from '../store/useStore';
import { useTheme } from '../store/useTheme';
import { formatMonth } from '../utils/date';

function parseMonth(m: string): { year: number; month: number } {
  const [y, mo] = m.split('-');
  return { year: parseInt(y, 10), month: parseInt(mo, 10) };
}

function fmtMonthYear(m: string): string {
  return formatMonth(m);
}

function shiftMonth(m: string, delta: number): string {
  const { year, month } = parseMonth(m);
  const total = year * 12 + (month - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

function thisMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function MonthSwitcher() {
  const palette = useTheme();
  const currentMonth = useStore((s) => s.currentMonth);
  const setCurrentMonth = useStore((s) => s.setCurrentMonth);
  const loadBudgets = useStore((s) => s.loadBudgets);
  const [pickerOpen, setPickerOpen] = useState(false);

  const isThisMonth = currentMonth === thisMonthStr();

  function goPrev() {
    const next = shiftMonth(currentMonth, -1);
    setCurrentMonth(next);
    loadBudgets(next);
  }
  function goNext() {
    const next = shiftMonth(currentMonth, 1);
    setCurrentMonth(next);
    loadBudgets(next);
  }
  function goToday() {
    const m = thisMonthStr();
    setCurrentMonth(m);
    loadBudgets(m);
  }
  function pick(m: string) {
    setCurrentMonth(m);
    loadBudgets(m);
    setPickerOpen(false);
  }

  // Generate 24 months back from this month for picker
  const months: string[] = [];
  const today = thisMonthStr();
  for (let i = 0; i < 24; i++) {
    months.push(shiftMonth(today, -i));
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={goPrev} style={styles.arrow} accessibilityLabel="Tháng trước">
        <Icon name="ChevronLeft" size={22} color="#374151" />
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setPickerOpen(true)} style={styles.center} activeOpacity={0.7}>
        <Text style={styles.label}>{fmtMonthYear(currentMonth)}</Text>
        {!isThisMonth ? (
          <Text style={[styles.todayLink, { color: palette.primary }]} onPress={goToday}>
            Về tháng này
          </Text>
        ) : null}
      </TouchableOpacity>

      <TouchableOpacity onPress={goNext} style={styles.arrow} accessibilityLabel="Tháng sau">
        <Icon name="ChevronRight" size={22} color="#374151" />
      </TouchableOpacity>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity
          style={styles.modalBg}
          activeOpacity={1}
          onPress={() => setPickerOpen(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Chọn tháng</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {months.map((m) => {
                const selected = m === currentMonth;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.monthItem,
                      selected && { backgroundColor: palette.primaryLight },
                    ]}
                    onPress={() => pick(m)}
                  >
                    <Text
                      style={[
                        styles.monthItemText,
                        selected && { color: palette.primary, fontWeight: '700' },
                      ]}
                    >
                      {fmtMonthYear(m)}
                    </Text>
                    {selected ? <Icon name="Check" size={16} color={palette.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setPickerOpen(false)}>
              <Text style={styles.closeText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    marginBottom: 8,
  },
  arrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '700', color: '#111827' },
  todayLink: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: '90%',
    maxWidth: 360,
    ...(Platform.OS === 'ios' ? { shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12 } : { elevation: 8 }),
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12, textAlign: 'center' },
  monthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
  },
  monthItemText: { fontSize: 14, color: '#374151' },
  closeBtn: {
    marginTop: 12,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
  },
  closeText: { color: '#6b7280', fontWeight: '600', fontSize: 14 },
});
