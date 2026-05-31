// F10 — Card "Bạn iu xài tối đa". Hiển thị trên dashboard tab Nhập.
// Label đổi theo time-of-day: Sáng / Trưa / Chiều / Tối / Khuya.
import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../store/useTheme';
import { formatNumber } from '../utils/format';
import { SafeToSpendResult, formatSafeAmount } from '../services/safeToSpend';
import { t } from '../i18n';
import { useLocale } from '../i18n/useLocale';
import { FONT_SIZE, FONT_WEIGHT, GRAY, RADIUS, SEMANTIC, SPACING } from '../theme/tokens';

/** Header theo giờ — dịch qua i18n. */
function timeOfDayLabel(hour: number): string {
  if (hour >= 5 && hour < 11) return t('safe.morning');
  if (hour >= 11 && hour < 14) return t('safe.noon');
  if (hour >= 14 && hour < 18) return t('safe.afternoon');
  if (hour >= 18 && hour < 22) return t('safe.evening');
  return t('safe.night');
}

type Props = {
  data: SafeToSpendResult;
  onTapDetail?: () => void;
  /** Có hiển thị chi tiết bên dưới không (income/expense/bill). */
  expanded?: boolean;
  /** v3.23 Active Savings: số tiền tự chích vào goals hôm nay (nếu có). */
  allocatedToday?: number;
  /** v3.23: số goal được chích hôm nay (1 → tên goal, 2+ → "N mục tiêu"). */
  allocatedGoalLabel?: string;
  /** v3.27: số dư hôm qua đã tự cộng vào goals sau 24h (nếu có). */
  unusedAutoYesterday?: number;
};

export function SafeToSpendCard({
  data,
  onTapDetail,
  expanded = false,
  allocatedToday,
  allocatedGoalLabel,
  unusedAutoYesterday,
}: Props) {
  const palette = useTheme();
  const locale = useLocale(); // Re-render khi đổi ngôn ngữ
  const headerLabel = useMemo(() => timeOfDayLabel(new Date().getHours()), [locale]);

  // Chưa có thu nhập trong kỳ → ẨN HẲN card để dashboard gọn (theo yêu cầu anh Bux2 14:31)
  // User ghi income → card tự hiện
  if (data.safeAmount === null) {
    return null;
  }

  // Overspending: chi đã vượt thu — tone mềm, không trách móc
  if (data.isOverspending) {
    return (
      <TouchableOpacity
        activeOpacity={onTapDetail ? 0.85 : 1}
        onPress={onTapDetail}
        style={[styles.card, { backgroundColor: SEMANTIC.danger.bg, borderColor: SEMANTIC.danger.tint }]}
      >
        <View style={styles.headRow}>
          <Icon name="AlertTriangle" size={16} color={SEMANTIC.danger.fg} />
          <Text style={[styles.headLabel, { color: SEMANTIC.danger.fg }]}>
            {t('safe.overspend')}
          </Text>
        </View>
        <Text style={[styles.bigAmount, { color: SEMANTIC.danger.text }]}>
          {formatNumber(data.monthExpense - data.monthIncome)}đ
        </Text>
        <Text style={[styles.subText, { color: SEMANTIC.danger.text }]}>
          {t(data.daysRemaining === 1 ? 'safe.overspendSubOne' : 'safe.overspendSub', { days: data.daysRemaining })}
        </Text>
      </TouchableOpacity>
    );
  }

  // v3.93 — Hiển thị số CÒN xài thêm hôm nay (đã trừ chi hôm nay)
  const displayAmount = data.safeRemainingToday ?? data.safeAmount;
  // v3.95 — Detect overspent hôm nay (xài quá quota ngày)
  const todayOver = data.safeAmount !== null && data.todayExpense > data.safeAmount;
  const todayOverAmount = todayOver ? data.todayExpense - data.safeAmount! : 0;
  // Cảnh báo: safe-to-spend < 30k (gần hết)
  const isLow = !todayOver && displayAmount < 30_000;

  // v3.95 — Hôm nay đã xài quá quota (nhưng tháng chưa âm) — tone warning + mặt buồn, wording mềm
  if (todayOver) {
    return (
      <TouchableOpacity
        activeOpacity={onTapDetail ? 0.85 : 1}
        onPress={onTapDetail}
        style={[styles.card, { backgroundColor: SEMANTIC.warning.bg, borderColor: SEMANTIC.warning.tint }]}
      >
        <View style={styles.headRow}>
          <Text style={{ fontSize: 16 }}>😢</Text>
          <Text style={[styles.headLabel, { color: SEMANTIC.warning.fg }]}>
            Hôm nay hơi quá tay rồi
          </Text>
        </View>
        <Text style={[styles.bigAmount, { color: SEMANTIC.warning.text }]}>
          −{formatNumber(todayOverAmount)}đ
        </Text>
        <Text style={[styles.subText, { color: SEMANTIC.warning.text }]}>
          Đã xài {formatNumber(data.todayExpense)}đ / {formatNumber(data.safeAmount!)}đ quota hôm nay
        </Text>
        <Text style={[styles.subText, { color: SEMANTIC.warning.text, marginTop: 4, fontStyle: 'italic' }]}>
          Không sao, ngày mai chi tiêu nhẹ tay là cân bằng được
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={onTapDetail ? 0.85 : 1}
      onPress={onTapDetail}
      style={[
        styles.card,
        isLow
          ? { backgroundColor: SEMANTIC.warning.bg, borderColor: SEMANTIC.warning.tint }
          : { backgroundColor: palette.primaryLight, borderColor: palette.primary + '40' },
      ]}
    >
      <View style={styles.headRow}>
        <Icon
          name={isLow ? 'AlertTriangle' : 'Scale'}
          size={16}
          color={isLow ? SEMANTIC.warning.fg : palette.primary}
        />
        <Text
          style={[
            styles.headLabel,
            { color: isLow ? SEMANTIC.warning.fg : palette.primary },
          ]}
        >
          {headerLabel}
        </Text>
      </View>
      <Text
        style={[
          styles.bigAmount,
          { color: isLow ? SEMANTIC.warning.text : palette.primaryDark },
        ]}
      >
        {formatNumber(displayAmount)}đ
      </Text>
      {/* v3.93 — Nếu đã xài hôm nay, hiển thị breakdown "X đã xài / Y tổng" */}
      {data.todayExpense > 0 && data.safeAmount !== null ? (
        <Text style={[styles.subText, { color: isLow ? SEMANTIC.warning.text : GRAY[700] }]}>
          Đã xài {formatNumber(data.todayExpense)}đ / {formatNumber(data.safeAmount)}đ hôm nay
        </Text>
      ) : (
        <Text style={[styles.subText, { color: isLow ? SEMANTIC.warning.text : GRAY[700] }]}>
          {data.isCycleMode
            ? t('safe.subCycle', { days: data.daysRemaining })
            : t('safe.subDefault', { days: data.daysRemaining })}
        </Text>
      )}
      {data.isCycleMode ? (
        <Text style={[styles.rangeText, { color: palette.primary }]}>
          📅 Kỳ {data.rangeLabel}
        </Text>
      ) : null}

      {allocatedToday && allocatedToday > 0 ? (
        <Text style={[styles.allocText, { color: palette.income }]}>
          💰 Đã chích {formatNumber(allocatedToday)}đ vào {allocatedGoalLabel || 'mục tiêu tiết kiệm'}
        </Text>
      ) : null}

      {unusedAutoYesterday && unusedAutoYesterday > 0 ? (
        <Text style={[styles.allocText, { color: palette.income }]}>
          ✨ Hôm qua dư {formatNumber(unusedAutoYesterday)}đ đã tự cộng vào mục tiêu
        </Text>
      ) : null}

      {expanded ? (
        <View style={styles.detailBox}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('common.monthIncome')}</Text>
            <Text style={[styles.detailValue, { color: palette.income }]}>
              {formatNumber(data.monthIncome)}đ
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('common.spent')}</Text>
            <Text style={[styles.detailValue, { color: palette.expense }]}>
              −{formatNumber(data.monthExpense)}đ
            </Text>
          </View>
          {data.pendingBills > 0 ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('common.unpaidBills')}</Text>
              <Text style={[styles.detailValue, { color: '#9a3412' }]}>
                −{formatNumber(data.pendingBills)}đ
              </Text>
            </View>
          ) : null}
          <View style={[styles.detailRow, styles.totalRow]}>
            <Text style={styles.detailTotalLabel}>{t('common.remaining')}</Text>
            <Text style={styles.detailTotalValue}>
              {formatNumber(data.remainingBudget)}đ
            </Text>
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.md + 2,
    marginBottom: SPACING.sm,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2 },
  headLabel: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 0.1,
  },
  bigAmount: {
    fontSize: FONT_SIZE.hero,
    fontWeight: FONT_WEIGHT.extrabold,
    marginTop: SPACING.xs,
  },
  subText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.medium, marginTop: 2 },
  rangeText: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, marginTop: SPACING.xs + 2 },
  allocText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, marginTop: SPACING.xs + 2 },
  tip: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium, marginTop: SPACING.xs + 2, lineHeight: 18 },
  detailBox: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    gap: SPACING.xs + 2,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: FONT_SIZE.small, color: GRAY[500], fontWeight: FONT_WEIGHT.medium },
  detailValue: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  totalRow: {
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  detailTotalLabel: { fontSize: FONT_SIZE.body, color: GRAY[900], fontWeight: FONT_WEIGHT.bold },
  detailTotalValue: { fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.extrabold, color: GRAY[900] },
});

export { formatSafeAmount };
