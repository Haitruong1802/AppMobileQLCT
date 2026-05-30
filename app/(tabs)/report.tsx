import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import { formatNumber } from '../../src/utils/format';
import { Icon } from '../../src/components/Icon';
import { PieChart } from '../../src/components/PieChart';
import { MonthSwitcher } from '../../src/components/MonthSwitcher';
import { WalletSwitcher } from '../../src/components/WalletSwitcher';
import { BarChart, BarMonth } from '../../src/components/BarChart';
import { YearHeatmap } from '../../src/components/YearHeatmap';
import { useTheme } from '../../src/store/useTheme';
import { useT } from '../../src/i18n/useT';
import { displayCategoryName } from '../../src/i18n/categoryName';

export default function Report() {
  const t = useT();
  const router = useRouter();
  const allTransactions = useStore((s) => s.transactions);
  const categories = useStore((s) => s.categories);
  const currentMonth = useStore((s) => s.currentMonth);
  const currentWalletId = useStore((s) => s.currentWalletId);
  const palette = useTheme();
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const transactions = useMemo(() => {
    let list = allTransactions.filter((t) => t.date.startsWith(currentMonth));
    if (currentWalletId !== null) {
      list = list.filter((t) => (t.wallet_id ?? 1) === currentWalletId);
    }
    return list;
  }, [allTransactions, currentMonth, currentWalletId]);

  // F27: 6 tháng trend (gồm tháng hiện tại + 5 tháng trước) — filter theo wallet
  const trend = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number);
    const months: BarMonth[] = [];
    for (let i = 5; i >= 0; i--) {
      const total = y * 12 + (m - 1) - i;
      const yy = Math.floor(total / 12);
      const mm = (total % 12) + 1;
      const key = `${yy}-${String(mm).padStart(2, '0')}`;
      let exp = 0;
      let inc = 0;
      for (const t of allTransactions) {
        if (!t.date.startsWith(key)) continue;
        if (currentWalletId !== null && (t.wallet_id ?? 1) !== currentWalletId) continue;
        if (t.type === 'expense') exp += t.amount;
        else inc += t.amount;
      }
      months.push({ label: `T${mm}`, expense: exp, income: inc });
    }
    return months;
  }, [allTransactions, currentMonth, currentWalletId]);

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [view, setView] = useState<'pie' | 'trend' | 'year'>('pie');
  const [drillCategoryId, setDrillCategoryId] = useState<number | null>(null);

  // Drill-down: list transactions của category được chọn
  const drillTransactions = useMemo(() => {
    if (drillCategoryId === null) return [];
    return transactions
      .filter((t) => t.category_id === drillCategoryId && t.type === type)
      .sort((a, b) => (a.date > b.date ? -1 : 1));
  }, [transactions, drillCategoryId, type]);

  // F57 — Heatmap năm data
  const heatmapData = useMemo(() => {
    const year = parseInt(currentMonth.split('-')[0], 10);
    const map: Record<string, number> = {};
    for (const t of allTransactions) {
      if (t.type !== 'expense') continue;
      if (currentWalletId !== null && (t.wallet_id ?? 1) !== currentWalletId) continue;
      if (!t.date.startsWith(`${year}-`)) continue;
      map[t.date] = (map[t.date] || 0) + t.amount;
    }
    return { year, map };
  }, [allTransactions, currentMonth, currentWalletId]);

  const { sorted, total } = useMemo(() => {
    const byCat: Record<number, number> = {};
    let tot = 0;
    for (const t of transactions) {
      if (t.type !== type) continue;
      byCat[t.category_id] = (byCat[t.category_id] || 0) + t.amount;
      tot += t.amount;
    }
    const sorted = Object.entries(byCat)
      .map(([cid, amt]) => ({ cid: Number(cid), amt }))
      .sort((a, b) => b.amt - a.amt);
    return { sorted, total: tot };
  }, [transactions, type]);

  // F51 — So sánh tuần này vs tuần trước
  const weekCompare = useMemo(() => {
    const now = new Date();
    // Monday as start of week
    const day = now.getDay(); // 0=Sun..6=Sat
    const diffToMon = day === 0 ? 6 : day - 1;
    const startThisWeek = new Date(now);
    startThisWeek.setHours(0, 0, 0, 0);
    startThisWeek.setDate(now.getDate() - diffToMon);
    const startLastWeek = new Date(startThisWeek);
    startLastWeek.setDate(startThisWeek.getDate() - 7);
    const endLastWeek = new Date(startThisWeek);
    endLastWeek.setDate(startThisWeek.getDate() - 1);

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const thisStart = fmt(startThisWeek);
    const lastStart = fmt(startLastWeek);
    const lastEnd = fmt(endLastWeek);

    let thisExp = 0,
      thisInc = 0,
      lastExp = 0,
      lastInc = 0;
    for (const t of allTransactions) {
      if (currentWalletId !== null && (t.wallet_id ?? 1) !== currentWalletId) continue;
      if (t.date >= thisStart) {
        if (t.type === 'expense') thisExp += t.amount;
        else thisInc += t.amount;
      } else if (t.date >= lastStart && t.date <= lastEnd) {
        if (t.type === 'expense') lastExp += t.amount;
        else lastInc += t.amount;
      }
    }
    return { thisExp, thisInc, lastExp, lastInc };
  }, [allTransactions, currentWalletId]);

  // Summary stats: avg/day, % vs tháng trước, biggest tx
  const summary = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number);
    const now = new Date();
    const isCurMonth =
      now.getFullYear() === y && now.getMonth() + 1 === m;
    const daysInMonth = new Date(y, m, 0).getDate();
    // v3.65 — L8: tháng tương lai → daysElapsed = 0 (chưa có ngày nào), tránh dilute TB/ngày
    const isFutureMonth =
      y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1);
    const daysElapsed = isFutureMonth ? 0 : isCurMonth ? now.getDate() : daysInMonth;
    const avgPerDay = daysElapsed > 0 ? total / daysElapsed : 0;

    // Previous month total same type
    const prevTotal_obj = (() => {
      const prevTotalMonths = y * 12 + (m - 1) - 1;
      const py = Math.floor(prevTotalMonths / 12);
      const pm = (prevTotalMonths % 12) + 1;
      const prevKey = `${py}-${String(pm).padStart(2, '0')}`;
      let prev = 0;
      for (const t of allTransactions) {
        if (!t.date.startsWith(prevKey)) continue;
        if (t.type !== type) continue;
        prev += t.amount;
      }
      return prev;
    })();
    const diff = total - prevTotal_obj;
    const diffPct = prevTotal_obj > 0 ? ((diff / prevTotal_obj) * 100) : 0;

    const biggest = transactions
      .filter((t) => t.type === type)
      .sort((a, b) => b.amount - a.amount)[0];

    return {
      avgPerDay,
      prevTotal: prevTotal_obj,
      diff,
      diffPct,
      biggest,
      txCount: transactions.filter((t) => t.type === type).length,
    };
  }, [transactions, allTransactions, type, currentMonth, total]);

  const slices = sorted.map(({ cid, amt }) => {
    const c = catMap[cid];
    return {
      value: amt,
      color: c?.color || '#6b7280',
      label: c ? displayCategoryName(c) : t('cat.default.other'),
    };
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('report.title')}</Text>

        {/* CTA phân tích — chỉ hiện khi có giao dịch trong tháng */}
        {transactions.length > 0 ? (
          <>
            {/* v3.47 — Persona CTA dời sang tab Khác để Báo cáo gọn hơn */}
            <TouchableOpacity
              style={[styles.aiCta, { backgroundColor: palette.primary }]}
              onPress={() => router.push('/insights')}
              activeOpacity={0.85}
            >
              <View style={styles.aiCtaIcon}>
                <Icon name="Sparkles" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.aiCtaTitle}>{t('report.aiCta')}</Text>
                <Text style={styles.aiCtaSub}>{t('report.aiCtaSub')}</Text>
              </View>
              <Icon name="ChevronRight" size={20} color="#fff" />
            </TouchableOpacity>

          </>
        ) : null}

        <MonthSwitcher />
        <WalletSwitcher />

        {/* View switcher: Pie tháng / Trend 6 tháng / Heatmap năm */}
        <View style={styles.typeTabs}>
          <TouchableOpacity
            style={[styles.typeTab, view === 'pie' && styles.typeTabActive]}
            onPress={() => setView('pie')}
          >
            <Text style={[styles.typeText, view === 'pie' && styles.typeTextActive]}>
              {t('report.viewMonth')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeTab, view === 'trend' && styles.typeTabActive]}
            onPress={() => setView('trend')}
          >
            <Text style={[styles.typeText, view === 'trend' && styles.typeTextActive]}>
              {t('report.view6Month')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeTab, view === 'year' && styles.typeTabActive]}
            onPress={() => setView('year')}
          >
            <Text style={[styles.typeText, view === 'year' && styles.typeTextActive]}>
              {t('report.viewYear')}
            </Text>
          </TouchableOpacity>
        </View>

        {view === 'year' ? (
          <View style={styles.chartWrap}>
            <YearHeatmap year={heatmapData.year} data={heatmapData.map} />
          </View>
        ) : view === 'trend' ? (
          <View style={styles.chartWrap}>
            <BarChart data={trend} expenseColor={palette.expense} incomeColor={palette.income} />
          </View>
        ) : (
        <>
        <View style={styles.typeTabs}>
          <TouchableOpacity
            style={[styles.typeTab, type === 'expense' && styles.typeTabActive]}
            onPress={() => setType('expense')}
          >
            <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>{t('report.expense')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeTab, type === 'income' && styles.typeTabActive]}
            onPress={() => setType('income')}
          >
            <Text style={[styles.typeText, type === 'income' && styles.typeTextActive]}>{t('report.income')}</Text>
          </TouchableOpacity>
        </View>

        {/* Summary stats cards */}
        {total > 0 ? (
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Icon name="BarChart3" size={14} color="#6b7280" />
              <Text style={styles.summaryLabel}>{t('report.avgPerDay')}</Text>
              <Text style={styles.summaryValue}>{formatNumber(Math.round(summary.avgPerDay))}đ</Text>
            </View>
            <View style={styles.summaryCard}>
              <Icon
                name={summary.diff >= 0 ? 'TrendingUp' : 'TrendingDown'}
                size={14}
                color={summary.diff >= 0 ? (type === 'expense' ? palette.expense : palette.income) : (type === 'expense' ? palette.income : palette.expense)}
              />
              <Text style={styles.summaryLabel}>{t('report.prevMonth')}</Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color:
                      summary.prevTotal === 0
                        ? '#6b7280'
                        : summary.diff >= 0
                        ? (type === 'expense' ? palette.expense : palette.income)
                        : (type === 'expense' ? palette.income : palette.expense),
                  },
                ]}
              >
                {summary.prevTotal === 0
                  ? '-'
                  : `${summary.diff >= 0 ? '+' : ''}${summary.diffPct.toFixed(0)}%`}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Icon name="Receipt" size={14} color="#6b7280" />
              <Text style={styles.summaryLabel}>{t('report.txCount')}</Text>
              <Text style={styles.summaryValue}>{summary.txCount}</Text>
            </View>
          </View>
        ) : null}

        {/* Pie chart */}
        <View style={styles.chartWrap}>
          <PieChart
            slices={slices}
            size={220}
            thickness={40}
            centerLabel={type === 'expense' ? t('report.expense') : t('report.income')}
            centerValue={total > 0 ? `${formatNumber(total)}đ` : '-'}
          />
        </View>

        {/* F51 Week comparison */}
        {(weekCompare.thisExp > 0 || weekCompare.lastExp > 0) ? (() => {
          const diff = weekCompare.thisExp - weekCompare.lastExp;
          const diffPct = weekCompare.lastExp > 0 ? (diff / weekCompare.lastExp) * 100 : 0;
          const isUp = diff > 0;
          const color = isUp ? palette.expense : palette.income;
          return (
            <View style={styles.weekCompareBox}>
              <View style={styles.weekHead}>
                <Icon name="BarChart3" size={14} color="#6b7280" />
                <Text style={styles.weekTitle}>{t('report.weekCompare')}</Text>
              </View>
              <View style={styles.weekRow}>
                <View style={styles.weekCell}>
                  <Text style={styles.weekLabel}>{t('report.thisWeek')}</Text>
                  <Text style={[styles.weekValue, { color: palette.expense }]}>
                    {formatNumber(weekCompare.thisExp)}đ
                  </Text>
                </View>
                <View style={styles.weekArrow}>
                  <Icon name={isUp ? 'TrendingUp' : 'TrendingDown'} size={22} color={color} />
                  {weekCompare.lastExp > 0 ? (
                    <Text style={[styles.weekDiff, { color }]}>
                      {isUp ? '+' : ''}{diffPct.toFixed(0)}%
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.weekCell, { alignItems: 'flex-end' }]}>
                  <Text style={styles.weekLabel}>{t('report.lastWeek')}</Text>
                  <Text style={[styles.weekValue, { color: '#6b7280' }]}>
                    {formatNumber(weekCompare.lastExp)}đ
                  </Text>
                </View>
              </View>
            </View>
          );
        })() : null}

        {/* Biggest transaction highlight */}
        {summary.biggest ? (
          <View style={styles.biggestBox}>
            <View style={styles.biggestHead}>
              <Icon name="Crown" size={16} color="#f59e0b" />
              <Text style={styles.biggestTitle}>{t('report.biggestTx')}</Text>
            </View>
            <View style={styles.biggestRow}>
              <View
                style={[
                  styles.biggestIcon,
                  { backgroundColor: (catMap[summary.biggest.category_id]?.color || '#6b7280') + '20' },
                ]}
              >
                <Icon
                  name={catMap[summary.biggest.category_id]?.icon || 'MoreHorizontal'}
                  size={18}
                  color={catMap[summary.biggest.category_id]?.color || '#6b7280'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.biggestName}>
                  {(() => {
                    const c = catMap[summary.biggest.category_id];
                    return c ? displayCategoryName(c) : t('cat.default.other');
                  })()}
                </Text>
                {summary.biggest.note ? (
                  <Text style={styles.biggestNote}>{summary.biggest.note}</Text>
                ) : null}
              </View>
              <Text
                style={[
                  styles.biggestAmt,
                  { color: type === 'expense' ? palette.expense : palette.income },
                ]}
              >
                {type === 'expense' ? '-' : '+'}{formatNumber(summary.biggest.amount)}đ
              </Text>
            </View>
          </View>
        ) : null}

        {sorted.length === 0 && (
          <View style={styles.emptyBox}>
            <View style={[styles.emptyIconBox, { backgroundColor: palette.primaryLight }]}>
              <Icon name="PieChart" size={42} color={palette.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('report.noData')}</Text>
            <Text style={styles.emptyDesc}>{t('report.noDataDesc')}</Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: palette.primary }]}
              onPress={() => router.push('/(tabs)/')}
            >
              <Icon name="Pencil" size={16} color="#fff" />
              <Text style={styles.emptyBtnText}>{t('report.recordTx')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Legend + breakdown — tap row để drill-down */}
        {sorted.map(({ cid, amt }) => {
          const c = catMap[cid];
          const pct = total > 0 ? (amt / total) * 100 : 0;
          return (
            <TouchableOpacity key={cid} style={styles.row} onPress={() => setDrillCategoryId(cid)} activeOpacity={0.7}>
              <View style={styles.rowHead}>
                <View style={[styles.dot, { backgroundColor: c?.color || '#6b7280' }]} />
                <View style={[styles.rowIconBox, { backgroundColor: (c?.color || '#6b7280') + '20' }]}>
                  <Icon name={c?.icon || 'MoreHorizontal'} size={16} color={c?.color || '#6b7280'} />
                </View>
                <Text style={styles.rowName}>{c ? displayCategoryName(c) : t('cat.default.other')}</Text>
                <Text style={styles.rowAmt}>{formatNumber(amt)}đ</Text>
                <Icon name="ChevronRight" size={14} color="#d1d5db" />
              </View>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${pct}%`, backgroundColor: c?.color || '#6b7280' },
                  ]}
                />
              </View>
              <Text style={styles.rowPct}>{pct.toFixed(1)}%</Text>
            </TouchableOpacity>
          );
        })}
        </>
        )}
      </ScrollView>

      {/* Drill-down modal: list transactions của category chọn */}
      <Modal
        visible={drillCategoryId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDrillCategoryId(null)}
      >
        {drillCategoryId !== null ? (() => {
          const c = catMap[drillCategoryId];
          const sumAmt = drillTransactions.reduce((s, tx) => s + tx.amount, 0);
          return (
            <Pressable style={styles.drillBg} onPress={() => setDrillCategoryId(null)}>
              <Pressable style={styles.drillCard} onPress={() => {}}>
                <View style={styles.drillHead}>
                  <View style={[styles.drillIcon, { backgroundColor: (c?.color || '#6b7280') + '20' }]}>
                    <Icon name={c?.icon || 'MoreHorizontal'} size={22} color={c?.color || '#6b7280'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.drillTitle}>{c ? displayCategoryName(c) : t('cat.default.other')}</Text>
                    <Text style={styles.drillSub}>
                      {drillTransactions.length} giao dịch · {formatNumber(sumAmt)}đ
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setDrillCategoryId(null)} style={styles.drillClose}>
                    <Icon name="X" size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ maxHeight: 500 }}>
                  {drillTransactions.map((tx) => (
                    <View key={tx.id} style={styles.drillItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.drillItemDate}>{tx.date}</Text>
                        {tx.note ? <Text style={styles.drillItemNote}>{tx.note}</Text> : null}
                      </View>
                      <Text
                        style={[
                          styles.drillItemAmt,
                          { color: tx.type === 'expense' ? palette.expense : palette.income },
                        ]}
                      >
                        {tx.type === 'expense' ? '-' : '+'}{formatNumber(tx.amount)}đ
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </Pressable>
            </Pressable>
          );
        })() : (
          <View />
        )}
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 16 },
  typeTabs: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 20 },
  typeTab: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  typeTabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 2 },
  typeText: { color: '#6b7280', fontWeight: '600', fontSize: 14 },
  typeTextActive: { color: '#111827' },
  chartWrap: { alignItems: 'center', marginBottom: 24 },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 20 },
  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyIconBox: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 8 },
  emptyDesc: { fontSize: 13, color: '#6b7280', textAlign: 'center', maxWidth: 280, lineHeight: 18 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 8,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  row: { marginBottom: 14 },
  rowHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowIconBox: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1f2937' },
  rowAmt: { fontSize: 14, fontWeight: '700', color: '#111827' },
  barBg: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  rowPct: { fontSize: 11, color: '#9ca3af', marginTop: 2, textAlign: 'right' },
  summaryGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  summaryLabel: { fontSize: 10, color: '#6b7280', fontWeight: '600', marginTop: 4 },
  summaryValue: { fontSize: 14, fontWeight: '800', color: '#111827' },
  biggestBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  biggestHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  biggestTitle: { fontSize: 11, fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.5 },
  biggestRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  biggestIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  biggestName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  biggestNote: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  biggestAmt: { fontSize: 14, fontWeight: '800' },
  weekCompareBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  weekHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  weekTitle: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekCell: { flex: 1, alignItems: 'flex-start' },
  weekLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600', marginBottom: 4 },
  weekValue: { fontSize: 16, fontWeight: '800' },
  weekArrow: { alignItems: 'center', gap: 4, paddingHorizontal: 14 },
  weekDiff: { fontSize: 11, fontWeight: '700' },
  aiCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  aiCtaIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiCtaTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  aiCtaSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 },
  drillBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  drillCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '88%',
  },
  drillHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  drillIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  drillTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  drillSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  drillClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#f3f4f6' },
  drillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  drillItemDate: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  drillItemNote: { fontSize: 13, color: '#111827', marginTop: 2, fontWeight: '500' },
  drillItemAmt: { fontSize: 14, fontWeight: '700' },
});
