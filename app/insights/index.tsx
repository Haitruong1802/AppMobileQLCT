// F56 — AI Insights tháng: phân tích nâng cao + gợi ý hành động cụ thể.
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import { useTheme } from '../../src/store/useTheme';
import { Icon } from '../../src/components/Icon';
import { Skeleton } from '../../src/components/Skeleton';
import { formatNumber } from '../../src/utils/format';
import { generateLocalReport, MonthlyReport } from '../../src/services/localInsight';
import { useT } from '../../src/i18n/useT';
import { formatMonth } from '../../src/utils/date';
import { displayCategoryName } from '../../src/i18n/categoryName';

export default function Insights() {
  const t = useT();
  const router = useRouter();
  const palette = useTheme();
  const allTransactions = useStore((s) => s.transactions);
  const categories = useStore((s) => s.categories);
  const currentMonth = useStore((s) => s.currentMonth);
  const currentWalletId = useStore((s) => s.currentWalletId);

  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compute context for AI
  const ctx = useMemo(() => {
    const filterFn = (t: any) =>
      currentWalletId === null || (t.wallet_id ?? 1) === currentWalletId;

    const thisMonthTxs = allTransactions.filter((t) => t.date.startsWith(currentMonth) && filterFn(t));
    const totalExpense = thisMonthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalIncome = thisMonthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

    const catMap = new Map(categories.map((c) => [c.id, c]));
    const byCat: Record<number, number> = {};
    for (const t of thisMonthTxs) {
      if (t.type !== 'expense') continue;
      byCat[t.category_id] = (byCat[t.category_id] || 0) + t.amount;
    }
    const topCategories = Object.entries(byCat)
      .map(([cid, amt]) => {
        const c = catMap.get(Number(cid));
        return {
          name: c ? displayCategoryName(c) : t('cat.default.other'),
          amount: amt,
          pct: totalExpense > 0 ? (amt / totalExpense) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Prev month
    const [y, m] = currentMonth.split('-').map(Number);
    const prevTotalMonths = y * 12 + (m - 1) - 1;
    const py = Math.floor(prevTotalMonths / 12);
    const pm = (prevTotalMonths % 12) + 1;
    const prevKey = `${py}-${String(pm).padStart(2, '0')}`;
    const prevTxs = allTransactions.filter((t) => t.date.startsWith(prevKey) && filterFn(t));
    const prevMonthExpense = prevTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const prevMonthIncome = prevTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

    const biggest = thisMonthTxs
      .filter((t) => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount)[0];

    return {
      month: currentMonth,
      totalExpense,
      totalIncome,
      topCategories,
      prevMonthExpense,
      prevMonthIncome,
      txCount: thisMonthTxs.length,
      daysInMonth: new Date(y, m, 0).getDate(),
      biggestTx: biggest
        ? (() => {
            const c = catMap.get(biggest.category_id);
            return {
              category: c ? displayCategoryName(c) : t('cat.default.other'),
              amount: biggest.amount,
              note: biggest.note || '',
            };
          })()
        : undefined,
    };
  }, [allTransactions, categories, currentMonth, currentWalletId]);

  useEffect(() => {
    loadReport();
  }, [currentMonth, currentWalletId, allTransactions]);

  function loadReport() {
    setLoading(true);
    setError(null);
    setReport(null);

    if (ctx.totalExpense === 0 && ctx.totalIncome === 0) {
      setError('Chưa có giao dịch tháng này. Vào tab Nhập vào ghi vài giao dịch rồi quay lại.');
      setLoading(false);
      return;
    }

    try {
      // Local engine — instant, offline, free
      const r = generateLocalReport(ctx);
      setReport(r);
    } catch (e: any) {
      setError(e?.message || 'Không tạo được báo cáo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('insights.title')}</Text>
        <TouchableOpacity onPress={() => loadReport()} style={styles.backBtn}>
          <Icon name="RotateCcw" size={20} color={palette.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Header card */}
        <View style={[styles.headerCard, { backgroundColor: palette.primary }]}>
          <View style={styles.headerRow}>
            <Icon name="Sparkles" size={20} color="#fff" />
            <Text style={styles.headerLabel}>{t('insights.headerLabel')}</Text>
          </View>
          <Text style={styles.headerTitle}>{formatMonth(currentMonth)}</Text>
          <Text style={styles.headerSub}>
            {formatNumber(ctx.totalExpense)}đ chi · {formatNumber(ctx.totalIncome)}đ thu · {ctx.txCount} giao dịch
          </Text>
        </View>

        {loading ? (
          <View>
            <View style={styles.section}>
              <Skeleton height={14} width="40%" />
              <View style={{ height: 8 }} />
              <Skeleton height={14} width="95%" />
              <View style={{ height: 4 }} />
              <Skeleton height={14} width="80%" />
            </View>
            <View style={styles.section}>
              <Skeleton height={14} width="40%" />
              <View style={{ height: 8 }} />
              <Skeleton height={14} width="90%" />
              <View style={{ height: 4 }} />
              <Skeleton height={14} width="70%" />
            </View>
            <View style={styles.section}>
              <Skeleton height={14} width="40%" />
              <View style={{ height: 8 }} />
              <Skeleton height={14} width="85%" />
              <View style={{ height: 4 }} />
              <Skeleton height={14} width="75%" />
            </View>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Icon name="AlertCircle" size={32} color="#f59e0b" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: palette.primary }]}
              onPress={() => loadReport()}
            >
              <Text style={styles.btnText}>{t('insights.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : report ? (
          <View>
            {/* Summary */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={[styles.sectionIcon, { backgroundColor: palette.primaryLight }]}>
                  <Icon name="BarChart3" size={16} color={palette.primary} />
                </View>
                <Text style={styles.sectionTitle}>{t('insights.overview')}</Text>
              </View>
              <Text style={styles.bodyText}>{report.summary}</Text>
            </View>

            {/* Anomalies */}
            {report.anomalies.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <View style={[styles.sectionIcon, { backgroundColor: '#fef3c7' }]}>
                    <Icon name="AlertCircle" size={16} color="#d97706" />
                  </View>
                  <Text style={styles.sectionTitle}>{t('insights.anomalies')}</Text>
                </View>
                {report.anomalies.map((a, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <View style={[styles.bullet, { backgroundColor: '#d97706' }]} />
                    <Text style={styles.bodyText}>{a}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Suggestions */}
            {report.suggestions.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <View style={[styles.sectionIcon, { backgroundColor: palette.primaryLight }]}>
                    <Icon name="TrendingDown" size={16} color={palette.primary} />
                  </View>
                  <Text style={styles.sectionTitle}>{t('insights.suggestions')}</Text>
                </View>
                {report.suggestions.map((s, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <View style={[styles.bullet, { backgroundColor: palette.primary }]} />
                    <Text style={styles.bodyText}>{s}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Savings target */}
            {report.savings_target ? (
              <View style={[styles.savingsCard, { backgroundColor: palette.primaryLight, borderColor: palette.primary }]}>
                <View style={styles.sectionHead}>
                  <Icon name="Crown" size={20} color={palette.primary} />
                  <Text style={[styles.savingsTitle, { color: palette.primary }]}>{t('insights.savingsTarget')}</Text>
                </View>
                <Text style={[styles.bodyText, { color: palette.primaryDark, fontWeight: '600' }]}>
                  {report.savings_target}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.footnote}>
          Báo cáo tạo từ dữ liệu giao dịch tháng này, chạy trên máy bạn, không gửi cloud.
        </Text>
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
  headerCard: { borderRadius: 16, padding: 18, marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerLabel: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 6 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  section: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  bodyText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 22 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  savingsCard: { borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1.5 },
  savingsTitle: { fontSize: 14, fontWeight: '800' },
  errorBox: { padding: 24, alignItems: 'center', gap: 10 },
  errorText: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
  btn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  footnote: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 16, fontStyle: 'italic', lineHeight: 16 },
  cacheBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  cacheText: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
});
