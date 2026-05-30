// F5 — Màn "Tóm tắt hôm nay". User mở từ notification 20:00 hoặc tab Khác.
// v3.136 — Rewrite chuyên nghiệp: KPI grid + dòng tiền text + danh sách giao dịch hôm nay + phân bổ chi tiêu + quick actions.
//          Không emoji, không màu mè, layout đồng nhất với phong cách app.
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { useTheme } from '../../src/store/useTheme';
import { useStore } from '../../src/store/useStore';
import { formatNumber } from '../../src/utils/format';
import { todayISO, formatDate } from '../../src/utils/date';
import { useT } from '../../src/i18n/useT';
import { t } from '../../src/i18n';
import { displayCategoryName } from '../../src/i18n/categoryName';

const MAX_TX_LIST = 5;

export default function SummaryToday() {
  useT();
  const router = useRouter();
  const palette = useTheme();
  const transactions = useStore((s) => s.transactions);
  const categories = useStore((s) => s.categories);
  const currentWalletId = useStore((s) => s.currentWalletId);

  const today = todayISO();

  // v3.136 — Filter theo wallet hiện tại, đảm bảo timezone local (todayISO dùng new Date local).
  const todayTx = useMemo(() => {
    let list = transactions.filter((t) => t.date === today);
    if (currentWalletId !== null) {
      list = list.filter((t) => (t.wallet_id ?? 1) === currentWalletId);
    }
    return list;
  }, [transactions, today, currentWalletId]);

  const todayIncome = useMemo(
    () => todayTx.filter((t) => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0),
    [todayTx]
  );
  const todayExpense = useMemo(
    () => todayTx.filter((t) => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0),
    [todayTx]
  );
  const netToday = todayIncome - todayExpense;

  // Phân bổ chi tiêu theo danh mục (sorted desc)
  const expenseByCat = useMemo(() => {
    const map: Record<number, number> = {};
    for (const t of todayTx) {
      if (t.type !== 'expense') continue;
      map[t.category_id] = (map[t.category_id] || 0) + (Number(t.amount) || 0);
    }
    return Object.entries(map)
      .map(([cid, amount]) => {
        const c = categories.find((x) => x.id === parseInt(cid, 10));
        return {
          id: parseInt(cid, 10),
          category: c,
          name: c ? displayCategoryName(c) : 'Khác',
          color: c?.color || '#6b7280',
          icon: c?.icon || 'MoreHorizontal',
          amount,
          pct: todayExpense > 0 ? amount / todayExpense : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [todayTx, categories, todayExpense]);

  // Danh sách giao dịch gần nhất (sort theo created_at DESC nếu có, fallback theo id)
  const recentTx = useMemo(() => {
    const sorted = [...todayTx].sort((a, b) => {
      const ca = a.created_at || '';
      const cb = b.created_at || '';
      if (ca !== cb) return ca > cb ? -1 : 1;
      return (b.id ?? 0) - (a.id ?? 0);
    });
    return sorted.slice(0, MAX_TX_LIST);
  }, [todayTx]);

  // Trạng thái dòng tiền — chuyên nghiệp, không phán xét
  const cashFlowText = useMemo(() => {
    if (todayTx.length === 0) return t('summary.today.empty');
    if (todayIncome === 0 && todayExpense > 0) {
      return t('summary.today.onlyExpense');
    }
    if (todayExpense === 0 && todayIncome > 0) {
      return t('summary.today.onlyIncome');
    }
    if (netToday > 0) return t('summary.today.flowPositive');
    if (netToday < 0) return t('summary.today.flowNegative');
    return t('summary.today.flowBalance');
  }, [todayTx, todayIncome, todayExpense, netToday]);

  // Format thời gian giao dịch (từ created_at)
  function timeOf(createdAt: string | undefined): string {
    if (!createdAt) return '';
    try {
      // SQLite trả 'YYYY-MM-DD HH:MM:SS' UTC. Chuyển sang local.
      const isoLike = createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T') + 'Z';
      const d = new Date(isoLike);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  const todayLabel = useMemo(() => {
    try {
      return new Date().toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return formatDate(today, 'dd/MM/yyyy');
    }
  }, [today]);

  // Subscribe để re-render khi transactions thay đổi (sau khi user thêm/sửa từ tab khác)
  useEffect(() => {
    /* noop — useStore subscription tự lo */
  }, [transactions]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('summary.today.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* ── HEADER ── */}
        <View style={styles.headerBlock}>
          <Text style={styles.dateLabel}>{todayLabel}</Text>
          <Text style={styles.headerSub}>{t('summary.today.sub')}</Text>
        </View>

        {/* ── KPI GRID ── */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>{t('summary.today.income')}</Text>
            <Text style={[styles.kpiValue, { color: '#10b981' }]} numberOfLines={1}>
              {formatNumber(todayIncome)}đ
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>{t('summary.today.expense')}</Text>
            <Text style={[styles.kpiValue, { color: '#dc2626' }]} numberOfLines={1}>
              {formatNumber(todayExpense)}đ
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>{t('summary.today.net')}</Text>
            <Text
              style={[styles.kpiValue, { color: netToday > 0 ? '#10b981' : netToday < 0 ? '#dc2626' : '#374151' }]}
              numberOfLines={1}
            >
              {netToday > 0 ? '+' : netToday < 0 ? '-' : ''}
              {formatNumber(Math.abs(netToday))}đ
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>{t('summary.today.txCount')}</Text>
            <Text style={[styles.kpiValue, { color: '#111827' }]}>{todayTx.length}</Text>
          </View>
        </View>

        {/* ── CASH FLOW STATUS ── */}
        <View style={styles.flowCard}>
          <View style={[styles.flowDot, { backgroundColor: netToday > 0 ? '#10b981' : netToday < 0 ? '#dc2626' : '#9ca3af' }]} />
          <Text style={styles.flowText}>{cashFlowText}</Text>
        </View>

        {/* ── GIAO DỊCH HÔM NAY ── */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t('summary.today.txList')}</Text>
            {todayTx.length > MAX_TX_LIST ? (
              <TouchableOpacity onPress={() => router.replace('/(tabs)/calendar')}>
                <Text style={[styles.linkText, { color: palette.primary }]}>{t('summary.today.seeMore')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {recentTx.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Icon name="Receipt" size={32} color="#d1d5db" />
              <Text style={styles.emptyTitle}>{t('summary.today.empty')}</Text>
              <Text style={styles.emptyDesc}>
                {t('summary.today.emptyDesc')}
              </Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {recentTx.map((t) => {
                const cat = categories.find((c) => c.id === t.category_id);
                const isIncome = t.type === 'income';
                const time = timeOf(t.created_at);
                return (
                  <View key={t.id} style={styles.txRow}>
                    <View style={[styles.txIcon, { backgroundColor: (cat?.color || '#9ca3af') + '20' }]}>
                      <Icon name={cat?.icon || 'MoreHorizontal'} size={18} color={cat?.color || '#6b7280'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txName} numberOfLines={1}>
                        {t.note?.trim() || (cat ? displayCategoryName(cat) : 'Giao dịch')}
                      </Text>
                      <Text style={styles.txMeta} numberOfLines={1}>
                        {cat ? displayCategoryName(cat) : 'Khác'}
                        {time ? ` · ${time}` : ''}
                      </Text>
                    </View>
                    <Text
                      style={[styles.txAmount, { color: isIncome ? '#10b981' : '#111827' }]}
                      numberOfLines={1}
                    >
                      {isIncome ? '+' : '-'}
                      {formatNumber(Number(t.amount) || 0)}đ
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── PHÂN BỔ CHI TIÊU ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('summary.today.allocTitle')}</Text>
          {expenseByCat.length === 0 ? (
            <View style={styles.emptyBlockSm}>
              <Text style={styles.emptyText}>Chưa có khoản chi nào trong hôm nay.</Text>
            </View>
          ) : (
            <View style={styles.catList}>
              {expenseByCat.map((c) => (
                <View key={c.id} style={styles.catRow}>
                  <View style={styles.catHeadRow}>
                    <View style={[styles.catDot, { backgroundColor: c.color }]} />
                    <Text style={styles.catName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={styles.catAmount}>{formatNumber(c.amount)}đ</Text>
                  </View>
                  <View style={styles.catBar}>
                    <View style={[styles.catBarFill, { width: `${c.pct * 100}%`, backgroundColor: c.color }]} />
                  </View>
                  <Text style={styles.catPct}>{t('summary.today.totalPct', { pct: Math.round(c.pct * 100) })}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── QUICK ACTIONS ── */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[styles.actionPrimary, { backgroundColor: palette.primary }]}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.85}
          >
            <Icon name="Plus" size={18} color="#fff" strokeWidth={2.5} />
            <Text style={styles.actionPrimaryText}>{t('summary.today.addTx')}</Text>
          </TouchableOpacity>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionSecondary}
              onPress={() => router.replace('/(tabs)/calendar')}
              activeOpacity={0.85}
            >
              <Icon name="CalendarDays" size={16} color="#374151" />
              <Text style={styles.actionSecondaryText}>{t('summary.today.viewCal')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSecondary}
              onPress={() => router.push('/goals')}
              activeOpacity={0.85}
            >
              <Icon name="Crown" size={16} color="#374151" />
              <Text style={styles.actionSecondaryText}>{t('summary.today.viewGoals')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  container: { padding: 16, paddingBottom: 32 },

  // ── HEADER ──
  headerBlock: { marginBottom: 16 },
  dateLabel: { fontSize: 14, fontWeight: '700', color: '#111827', textTransform: 'capitalize' },
  headerSub: { fontSize: 12, color: '#6b7280', marginTop: 4 },

  // ── KPI GRID ──
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  kpiCard: {
    width: '48%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
  },
  kpiLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiValue: { fontSize: 18, fontWeight: '800', marginTop: 4 },

  // ── CASH FLOW ──
  flowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  flowDot: { width: 8, height: 8, borderRadius: 4 },
  flowText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },

  // ── SECTION ──
  section: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  linkText: { fontSize: 12, fontWeight: '700' },

  // ── EMPTY ──
  emptyBlock: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 6 },
  emptyDesc: { fontSize: 12, color: '#6b7280', textAlign: 'center', maxWidth: 260, lineHeight: 17 },
  emptyBlockSm: { paddingVertical: 12, alignItems: 'center' },
  emptyText: { fontSize: 12, color: '#6b7280', fontStyle: 'italic' },

  // ── TX LIST ──
  txList: { gap: 4 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  txIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  txName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  txMeta: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  txAmount: { fontSize: 13, fontWeight: '700' },

  // ── CAT LIST ──
  catList: { gap: 10 },
  catRow: {},
  catHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catName: { fontSize: 13, fontWeight: '600', color: '#111827', flex: 1 },
  catAmount: { fontSize: 13, fontWeight: '700', color: '#111827' },
  catBar: { height: 5, backgroundColor: '#e5e7eb', borderRadius: 2.5, overflow: 'hidden' },
  catBarFill: { height: '100%' },
  catPct: { fontSize: 11, color: '#6b7280', marginTop: 4 },

  // ── ACTIONS ──
  actionsGrid: { gap: 8, marginTop: 4 },
  actionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 11,
    backgroundColor: '#f3f4f6',
  },
  actionSecondaryText: { color: '#374151', fontSize: 13, fontWeight: '700' },
});
