import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal, Pressable } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Icon } from './Icon';
import { formatDate } from '../utils/date';
import { useTheme } from '../store/useTheme';
import { useT } from '../i18n/useT';
import { t } from '../i18n';

type Props = {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  label?: string;
  /** v3.56 — Cap max date (YYYY-MM-DD). Dùng cho TX form không cho chọn date tương lai. */
  maxDate?: string;
  /** v3.93 — Nếu set, hiển thị nút "Hôm nay" khi value khác today, bấm reset về today. */
  todayISO?: string;
};

function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function DatePickerField({ value, onChange, label, maxDate, todayISO }: Props) {
  const displayLabel = label ?? t('input.date');
  const isToday = todayISO ? value === todayISO : false;
  const showTodayBtn = !!todayISO && !isToday;
  const [show, setShow] = useState(false);
  const date = new Date(value);
  const palette = useTheme();
  const maxDateObj = maxDate ? new Date(maxDate) : undefined;

  function handleChange(_e: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShow(false);
    if (selected) {
      // v3.56 — Guard: nếu chọn date > maxDate, clamp về maxDate
      if (maxDate && isoFromDate(selected) > maxDate) {
        onChange(maxDate);
      } else {
        onChange(isoFromDate(selected));
      }
    }
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.row}>
        <Icon name="CalendarDays" size={16} color="#78350f" />
        <Text style={styles.label}>{displayLabel}</Text>
        {/* @ts-ignore */}
        <input
          type="date"
          value={value}
          max={maxDate}
          onChange={(e: any) => onChange(e.target.value)}
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: 13,
            color: '#78350f',
            fontWeight: 600,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity style={styles.row} onPress={() => setShow(true)}>
        <Icon name="CalendarDays" size={16} color="#78350f" />
        <Text style={styles.label}>{displayLabel}</Text>
        <Text style={styles.value}>{formatDate(value, 'EEEE, dd/MM/yyyy')}</Text>
        {/* v3.93 — Nút Hôm nay (chỉ khi value khác today) */}
        {showTodayBtn ? (
          <TouchableOpacity
            style={styles.todayBtn}
            onPress={(e) => {
              e.stopPropagation();
              onChange(todayISO!);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.todayBtnText}>{t('common.today')}</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {Platform.OS === 'ios' ? (
        <Modal transparent visible={show} animationType="slide" onRequestClose={() => setShow(false)}>
          <Pressable style={styles.iosBg} onPress={() => setShow(false)}>
            <Pressable style={styles.iosCard} onPress={() => {}}>
              <Text style={styles.iosTitle}>{t('common.pickDate')}</Text>
              <View style={styles.iosPickerWrap}>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="spinner"
                  onChange={handleChange}
                  locale="vi-VN"
                  textColor="#111827"
                  style={styles.iosPicker}
                  maximumDate={maxDateObj}
                />
              </View>
              <TouchableOpacity style={[styles.iosDone, { backgroundColor: palette.primary }]} onPress={() => setShow(false)}>
                <Text style={styles.iosDoneText}>{t('common.done')}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      ) : (
        show && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={handleChange}
            maximumDate={maxDateObj}
          />
        )
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  label: { fontSize: 13, color: '#78350f', fontWeight: '600' },
  value: { flex: 1, textAlign: 'right', fontSize: 13, color: '#78350f', fontWeight: '600' },
  // v3.93 — Nút Hôm nay nhỏ kế bên ngày
  todayBtn: {
    backgroundColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 6,
  },
  todayBtnText: { fontSize: 11, color: '#78350f', fontWeight: '800' },
  iosBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  iosCard: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 24 },
  iosTitle: { fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 },
  iosPickerWrap: { backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', minHeight: 220 },
  iosPicker: { width: '100%', height: 220, backgroundColor: '#fff' },
  iosDone: { padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  iosDoneText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
