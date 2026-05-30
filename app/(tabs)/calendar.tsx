import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  TextInput,
  Animated,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import { addTransaction, Transaction } from '../../src/db';
import { formatNumber } from '../../src/utils/format';
import { formatDate } from '../../src/utils/date';
import { Icon } from '../../src/components/Icon';
import { SEARCH_DEBOUNCE_MS } from '../../src/utils/constants';
import { MonthSwitcher } from '../../src/components/MonthSwitcher';
import { WalletSwitcher } from '../../src/components/WalletSwitcher';
import { CalendarGrid } from '../../src/components/CalendarGrid';
import { generateLocalCoach } from '../../src/services/localInsight';
import { useTheme } from '../../src/store/useTheme';
import { useT } from '../../src/i18n/useT';
import { displayCategoryName } from '../../src/i18n/categoryName';

type DayBucket = {
  date: string;
  txs: any[];
  totalExpense: number;
  totalIncome: number;
};

export default function Calendar() {
  const t = useT();
  const router = useRouter();
  const allTransactions = useStore((s) => s.transactions);
  const categories = useStore((s) => s.categories);
  const currentMonth = useStore((s) => s.currentMonth);
  const currentWalletId = useStore((s) => s.currentWalletId);
  const deleteTx = useStore((s) => s.deleteTransaction);
  const palette = useTheme();
  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories]
  );

  // v3.121 — Debounce search 300ms để gõ nhanh không re-filter mỗi keystroke (chậm khi 1000+ TX)
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Filter by currentMonth (F22) + search (F28) + wallet (F32)
  const transactions = useMemo(() => {
    let list = allTransactions.filter((t) => t.date.startsWith(currentMonth));
    if (currentWalletId !== null) {
      list = list.filter((t) => (t.wallet_id ?? 1) === currentWalletId);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    const qNum = parseInt(q.replace(/\D/g, ''), 10);
    return list.filter((t) => {
      const cat = catMap[t.category_id];
      const noteMatch = (t.note || '').toLowerCase().includes(q);
      const catMatch = (cat?.name || '').toLowerCase().includes(q);
      // v3.65 — M1: threshold qNum >= 1000 để tránh search "1" match cả 10.000đ, 1.000.000đ...
      const amtMatch = qNum >= 1000 && String(t.amount).includes(String(qNum));
      return noteMatch || catMatch || amtMatch;
    });
  }, [allTransactions, currentMonth, search, catMap, currentWalletId]);

  const [coachText, setCoachText] = useState<string>('');
  // v3.65 — L1: removed coachLoading dead code (loadCoach chạy sync, skeleton never displays)
  const [refreshing, setRefreshing] = useState(false);
  const [undoState, setUndoState] = useState<{ tx: Transaction; visible: boolean } | null>(null);
  const undoAnim = useState(new Animated.Value(0))[0];
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  // Aggregate per day cho grid view
  const gridData = useMemo(() => {
    const map: Record<string, { expense: number; income: number }> = {};
    for (const t of transactions) {
      if (!map[t.date]) map[t.date] = { expense: 0, income: 0 };
      if (t.type === 'expense') map[t.date].expense += t.amount;
      else map[t.date].income += t.amount;
    }
    return map;
  }, [transactions]);

  // Aggregate
  const { totalExpense, totalIncome, balance, dayBuckets } = useMemo(() => {
    let totalExp = 0;
    let totalInc = 0;
    const buckets: Record<string, DayBucket> = {};
    for (const t of transactions) {
      if (t.type === 'expense') totalExp += t.amount;
      else totalInc += t.amount;
      if (!buckets[t.date]) buckets[t.date] = { date: t.date, txs: [], totalExpense: 0, totalIncome: 0 };
      buckets[t.date].txs.push(t);
      if (t.type === 'expense') buckets[t.date].totalExpense += t.amount;
      else buckets[t.date].totalIncome += t.amount;
    }
    return {
      totalExpense: totalExp,
      totalIncome: totalInc,
      balance: totalInc - totalExp,
      dayBuckets: Object.values(buckets).sort((a, b) => (a.date > b.date ? -1 : 1)),
    };
  }, [transactions]);

  // Filter buckets theo selectedDate khi grid view
  const visibleBuckets = useMemo(() => {
    if (viewMode === 'grid' && selectedDate) {
      return dayBuckets.filter((b) => b.date === selectedDate);
    }
    return dayBuckets;
  }, [viewMode, selectedDate, dayBuckets]);

  function loadCoach() {
    // Local generator — instant, không tốn API
    const now = new Date();
    const [y, m] = currentMonth.split('-').map(Number);
    const isCurMonth = now.getFullYear() === y && now.getMonth() + 1 === m;
    const daysInMonth = new Date(y, m, 0).getDate();
    const daysIntoMonth = isCurMonth ? now.getDate() : daysInMonth;

    const byCat: Record<number, number> = {};
    for (const tx of transactions) {
      if (tx.type === 'expense') byCat[tx.category_id] = (byCat[tx.category_id] || 0) + tx.amount;
    }
    const top = Object.entries(byCat)
      .map(([cid, amt]) => {
        const c = catMap[Number(cid)];
        return { name: c ? displayCategoryName(c) : t('cat.default.other'), amount: amt as number };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    const text = generateLocalCoach({
      totalExpenseMonth: totalExpense,
      totalIncomeMonth: totalIncome,
      topCategories: top,
      daysIntoMonth,
      totalDaysInMonth: daysInMonth,
    });
    setCoachText(text);
  }

  // Reset coach khi đổi tháng (KHÔNG auto-load để tránh hit quota khi user chỉ scroll)
  useEffect(() => {
    setCoachText('');
  }, [currentMonth]);

  async function deleteWithUndo(t: Transaction) {
    await deleteTx(t.id);
    setUndoState({ tx: t, visible: true });
    Animated.spring(undoAnim, { toValue: 1, useNativeDriver: true }).start();
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      Animated.timing(undoAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setUndoState(null));
    }, 5000);
  }

  async function performUndo() {
    if (!undoState) return;
    const t = undoState.tx;
    try {
      // v3.59 — Khôi phục đầy đủ wallet_id + photo_uri + source (trước chỉ pass 5 field → mất data)
      // v3.60 — Thêm source_id để link bill/recurring gốc không bị orphan
      await addTransaction({
        amount: t.amount,
        category_id: t.category_id,
        note: t.note,
        type: t.type,
        date: t.date,
        wallet_id: t.wallet_id,
        photo_uri: t.photo_uri ?? null,
        source: t.source,
        source_id: t.source_id,
      });
      await useStore.getState().loadTransactions();
    } catch (e) {
      console.warn('[calendar] undo fail:', e);
    }
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    Animated.timing(undoAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setUndoState(null));
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await useStore.getState().loadTransactions();
      await useStore.getState().loadCategories();
    } catch {
      /* noop */
    }
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />
        }
      >
        <MonthSwitcher />
        <WalletSwitcher />

        {/* View toggle: List / Grid */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[
              styles.viewToggleBtn,
              viewMode === 'list' && { backgroundColor: '#fff', borderColor: palette.primary, borderWidth: 1 },
            ]}
            onPress={() => {
              setViewMode('list');
              setSelectedDate(undefined);
            }}
          >
            <Icon name="MoreHorizontal" size={14} color={viewMode === 'list' ? palette.primary : '#6b7280'} />
            <Text style={[styles.viewToggleText, viewMode === 'list' && { color: palette.primary, fontWeight: '700' }]}>
              {t('calendar.viewList')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewToggleBtn,
              viewMode === 'grid' && { backgroundColor: '#fff', borderColor: palette.primary, borderWidth: 1 },
            ]}
            onPress={() => setViewMode('grid')}
          >
            <Icon name="CalendarDays" size={14} color={viewMode === 'grid' ? palette.primary : '#6b7280'} />
            <Text style={[styles.viewToggleText, viewMode === 'grid' && { color: palette.primary, fontWeight: '700' }]}>
              {t('calendar.viewGrid')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Calendar grid */}
        {viewMode === 'grid' ? (
          <CalendarGrid
            month={currentMonth}
            data={gridData}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(selectedDate === d ? undefined : d)}
          />
        ) : null}

        {/* Search bar */}
        <View style={styles.searchWrap}>
          <Icon name="Sparkles" size={14} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder={t('calendar.searchPlaceholder')}
            placeholderTextColor="#9ca3af"
            returnKeyType="search"
          />
          {searchInput.length > 0 ? (
            <TouchableOpacity onPress={() => { setSearchInput(''); setSearch(''); }}>
              <Icon name="X" size={16} color="#6b7280" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Insight card */}
        <TouchableOpacity
          style={[styles.coach, { backgroundColor: palette.primaryLight, borderColor: palette.primary + '40' }]}
          onPress={loadCoach}
          activeOpacity={0.7}
        >
          <View style={styles.coachHead}>
            <View style={[styles.coachIcon, { backgroundColor: palette.primary }]}>
              <Icon name="Sparkles" size={18} color="#fff" />
            </View>
            <Text style={[styles.coachTitle, { color: palette.primary }]}>{t('calendar.coachTitle')}</Text>
          </View>
          <Text style={[styles.coachText, { color: palette.primaryDark }]}>
            {coachText || t('calendar.coachTap')}
          </Text>
        </TouchableOpacity>

        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.sumBox}>
            <View style={styles.sumHead}>
              <Icon name="TrendingUp" size={14} color={palette.income} />
              <Text style={styles.sumLabel}>{t('report.income')}</Text>
            </View>
            <Text style={[styles.sumValue, { color: palette.income }]}>+{formatNumber(totalIncome)}đ</Text>
          </View>
          <View style={styles.sumBox}>
            <View style={styles.sumHead}>
              <Icon name="TrendingDown" size={14} color={palette.expense} />
              <Text style={styles.sumLabel}>{t('report.expense')}</Text>
            </View>
            <Text style={[styles.sumValue, { color: palette.expense }]}>-{formatNumber(totalExpense)}đ</Text>
          </View>
          <View style={styles.sumBox}>
            <View style={styles.sumHead}>
              <Icon name="Scale" size={14} color="#1f2937" />
              <Text style={styles.sumLabel}>{t('calendar.balance')}</Text>
            </View>
            <Text style={[styles.sumValue, { color: balance >= 0 ? '#1f2937' : palette.expense }]}>
              {balance >= 0 ? '+' : ''}{formatNumber(balance)}đ
            </Text>
          </View>
        </View>

        {/* Transactions grouped by day */}
        <Text style={styles.sectionTitle}>
          {viewMode === 'grid' && selectedDate
            ? t('calendar.txOnDate', { date: `${selectedDate.slice(8)}/${selectedDate.slice(5, 7)}` })
            : t('calendar.historyTitle')}
        </Text>
        {visibleBuckets.length === 0 && (
          <View style={styles.emptyBox}>
            <View style={[styles.emptyIconBox, { backgroundColor: palette.primaryLight }]}>
              <Icon name="CalendarDays" size={42} color={palette.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {viewMode === 'grid' && selectedDate
                ? t('calendar.emptyDay')
                : t('calendar.emptyMonth')}
            </Text>
            <Text style={styles.emptyDesc}>
              {viewMode === 'grid' && selectedDate
                ? t('calendar.emptyDayDesc')
                : t('calendar.emptyMonthDesc')}
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: palette.primary }]}
              onPress={() => router.push('/(tabs)/')}
            >
              <Icon name="Pencil" size={16} color="#fff" />
              <Text style={styles.emptyBtnText}>{t('calendar.recordTx')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {visibleBuckets.map((bucket) => (
          <View key={bucket.date} style={styles.dayGroup}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayDate}>{formatDate(bucket.date, 'EEEE, dd/MM')}</Text>
              <Text style={styles.daySum}>
                {bucket.totalIncome > 0 && (
                  <Text style={{ color: palette.income }}>+{formatNumber(bucket.totalIncome)}đ  </Text>
                )}
                {bucket.totalExpense > 0 && (
                  <Text style={{ color: palette.expense }}>-{formatNumber(bucket.totalExpense)}đ</Text>
                )}
              </Text>
            </View>
            {bucket.txs.map((tx) => {
              const c = catMap[tx.category_id];
              return (
                <Swipeable
                  key={tx.id}
                  renderRightActions={(progress) => {
                    const translateX = progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [54, 0],
                      extrapolate: 'clamp',
                    });
                    const opacity = progress.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, 0.7, 1],
                      extrapolate: 'clamp',
                    });
                    return (
                      <Animated.View
                        style={{
                          width: 54,
                          height: '100%',
                          transform: [{ translateX }],
                          opacity,
                        }}
                      >
                        <TouchableOpacity
                          style={[styles.swipeDelete, { backgroundColor: palette.expense }]}
                          onPress={() => deleteWithUndo(tx)}
                        >
                          <Icon name="Trash2" size={18} color="#fff" />
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  }}
                  rightThreshold={44}
                  overshootRight={false}
                  friction={1.2}
                  containerStyle={{ backgroundColor: '#fff' }}
                >
                  <RectButton
                    style={styles.item}
                    onPress={() => router.push(`/edit/${tx.id}`)}
                  >
                    <View style={[styles.itemIconBox, { backgroundColor: (c?.color || '#6b7280') + '20' }]}>
                      <Icon name={c?.icon || 'MoreHorizontal'} size={18} color={c?.color || '#6b7280'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>
                        {c ? displayCategoryName(c) : t('cat.default.other')}
                        {tx.note ? <Text style={styles.itemNote}>  ·  {tx.note}</Text> : null}
                      </Text>
                    </View>
                    {/* Source badge — bill / recurring / transfer / scan */}
                    {tx.source === 'bill' ? (
                      <View style={[styles.sourceBadge, { backgroundColor: '#fef3c7' }]}>
                        <Icon name="Receipt" size={11} color="#d97706" />
                      </View>
                    ) : tx.source === 'recurring' ? (
                      <View style={[styles.sourceBadge, { backgroundColor: palette.primaryLight }]}>
                        <Icon name="RotateCcw" size={11} color={palette.primary} />
                      </View>
                    ) : tx.source === 'transfer' ? (
                      <View style={[styles.sourceBadge, { backgroundColor: '#e0f2fe' }]}>
                        <Icon name="Bus" size={11} color="#0284c7" />
                      </View>
                    ) : null}
                    {tx.photo_uri ? (
                      <View style={styles.photoBadge}>
                        <Icon name="Camera" size={12} color="#6b7280" />
                      </View>
                    ) : null}
                    <Text style={[styles.itemAmount, { color: tx.type === 'expense' ? palette.expense : palette.income }]}>
                      {tx.type === 'expense' ? '-' : '+'}{formatNumber(tx.amount)}đ
                    </Text>
                  </RectButton>
                </Swipeable>
              );
            })}
          </View>
        ))}

        {visibleBuckets.length > 0 && (
          <Text style={styles.hint}>{t('calendar.itemHint')}</Text>
        )}
      </ScrollView>

      {/* Undo snackbar */}
      {undoState ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.snackbar,
            {
              opacity: undoAnim,
              transform: [
                {
                  translateY: undoAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }),
                },
              ],
            },
          ]}
        >
          <Icon name="Check" size={18} color="#fff" />
          <Text style={styles.snackbarText}>{t('calendar.deleted')}</Text>
          <TouchableOpacity onPress={performUndo} style={styles.undoBtn}>
            <Text style={[styles.undoBtnText, { color: palette.primary }]}>
              {t('calendar.snackbarUndo').toUpperCase()}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 16, paddingBottom: 32 },
  coach: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  coachHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  coachIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  coachTitle: { flex: 1, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  coachText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 40, fontSize: 14 },
  summary: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  sumBox: { flex: 1, backgroundColor: '#f9fafb', padding: 12, borderRadius: 10 },
  sumHead: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  sumLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  sumValue: { fontSize: 13, fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyIconBox: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 8 },
  emptyDesc: { fontSize: 13, color: '#6b7280', textAlign: 'center', maxWidth: 260, lineHeight: 18 },
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
  dayGroup: { marginBottom: 12 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', padding: 10, borderRadius: 8, marginBottom: 4 },
  dayDate: { fontSize: 12, color: '#6b7280', fontWeight: '600', textTransform: 'capitalize' },
  daySum: { fontSize: 12, fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12, backgroundColor: '#fff' },
  itemIconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14, color: '#111827', fontWeight: '600' },
  itemNote: { color: '#6b7280', fontWeight: '400' },
  itemAmount: { fontSize: 14, fontWeight: '700' },
  hint: { textAlign: 'center', color: '#9ca3af', fontSize: 11, marginTop: 20 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    // v3.51 — Fix font giãn rộng kỳ lạ sau reset DB (giống bug voiceInput v3.45)
    letterSpacing: 0,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  swipeDelete: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 0,
  },
  snackbar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  snackbarText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  undoBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  undoBtnText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  viewToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewToggleText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  photoBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  sourceBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
});
