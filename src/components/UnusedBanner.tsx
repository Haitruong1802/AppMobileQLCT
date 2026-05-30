// v3.23 — Banner gợi ý cộng dư hôm qua vào saving goal.
// Hiện trong tab Nhập + screen Summary. 1 tap accept → split tỷ lệ target vào tất cả goals active.
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Icon } from './Icon';
import { useTheme } from '../store/useTheme';
import { useT } from '../i18n/useT';
import { t } from '../i18n';
import { formatNumber } from '../utils/format';
import {
  acceptUnusedSuggestion,
  dismissUnusedSuggestion,
} from '../services/activeSavings';
import { SavingsGoal } from '../db';

type Props = {
  date: string; // YYYY-MM-DD (ngày hôm qua)
  unused: number;
  primaryGoal: SavingsGoal | null;
  onHandled: (accepted: boolean) => void;
};

export function UnusedBanner({ date, unused, primaryGoal, onHandled }: Props) {
  useT();
  const palette = useTheme();
  const [busy, setBusy] = useState(false);

  async function accept() {
    if (busy) return;
    setBusy(true);
    try {
      await acceptUnusedSuggestion(date, unused);
      onHandled(true);
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    if (busy) return;
    setBusy(true);
    try {
      await dismissUnusedSuggestion(date);
      onHandled(false);
    } finally {
      setBusy(false);
    }
  }

  const goalLabel = primaryGoal?.name || 'mục tiêu tiết kiệm';

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.emoji}>💛</Text>
        <Text style={styles.title}>Hôm qua bạn tiết kiệm tốt!</Text>
      </View>
      <Text style={styles.desc}>
        Dư {formatNumber(unused)}đ chưa xài tới, cho vào{' '}
        <Text style={{ fontWeight: '800' }}>{goalLabel}</Text> không?
      </Text>
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.btnDismiss]}
          onPress={dismiss}
          disabled={busy}
        >
          <Text style={styles.btnDismissText}>{t('unused.dismiss')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnAccept, { backgroundColor: palette.primary }]}
          onPress={accept}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Icon name="Check" size={16} color="#fff" />
              <Text style={styles.btnAcceptText}>{t('unused.accept')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fef3c7',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 14,
    marginBottom: 14,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  emoji: { fontSize: 18 },
  title: { fontSize: 14, fontWeight: '800', color: '#92400e' },
  desc: { fontSize: 13, color: '#78350f', lineHeight: 19, marginBottom: 10 },
  btnRow: { flexDirection: 'row', gap: 8 },
  btnDismiss: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fde68a',
    alignItems: 'center',
  },
  btnDismissText: { color: '#92400e', fontWeight: '700', fontSize: 13 },
  btnAccept: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  btnAcceptText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
