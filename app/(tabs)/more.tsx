import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { useTheme } from '../../src/store/useTheme';
import { useStore } from '../../src/store/useStore';
import { getWalletBalance, getBills, getSavingsGoals, getRecurringRules } from '../../src/db';
import { formatNumber } from '../../src/utils/format';
import { useT } from '../../src/i18n/useT';
import { ProBadge } from '../../src/components/ProBadge';
import { usePremiumState } from '../../src/store/usePremium';

type MenuItem = {
  icon: string;
  name: string;
  sub: string;
  onPress: () => void;
  arrow?: boolean;
};

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export default function More() {
  const t = useT();
  const router = useRouter();
  const palette = useTheme();
  const wallets = useStore((s) => s.wallets);
  const transactions = useStore((s) => s.transactions);
  const currentMonth = useStore((s) => s.currentMonth);
  const currentBookId = useStore((s) => s.currentBookId);
  const premium = usePremiumState();

  const [stats, setStats] = useState<{
    totalBalance: number;
    billsUrgent: number;
    billsActive: number;
    goalsActive: number;
    recurringActive: number;
  }>({ totalBalance: 0, billsUrgent: 0, billsActive: 0, goalsActive: 0, recurringActive: 0 });

  // v3.24 — reload mỗi khi tab Khác focus (fix bug bills counter không update sau khi tạo bill ở screen khác)
  useFocusEffect(
    useCallback(() => {
      refreshStats();
    }, [wallets, transactions, currentBookId])
  );

  async function refreshStats() {
    try {
      let totalBal = 0;
      for (const w of wallets) {
        totalBal += await getWalletBalance(w.id);
      }
      const bills = await getBills(currentBookId);
      // v3.26 — chia 2 trạng thái: urgent (≤7 ngày) gấp / active (≤30 ngày) đang theo dõi
      const billsUrgent = bills.filter(
        (b) => !b.paid_at && daysUntil(b.due_date) >= 0 && daysUntil(b.due_date) <= 7
      ).length;
      const billsActive = bills.filter(
        (b) => !b.paid_at && daysUntil(b.due_date) >= 0 && daysUntil(b.due_date) <= 30
      ).length;
      const goals = await getSavingsGoals(currentBookId);
      const goalsActive = goals.filter((g) => !g.completed_at).length;
      const rules = await getRecurringRules(currentBookId);
      const recurringActive = rules.filter((r) => r.active === 1).length;
      setStats({
        totalBalance: totalBal,
        billsUrgent,
        billsActive,
        goalsActive,
        recurringActive,
      });
    } catch {
      /* noop */
    }
  }

  // v3.116 — Restructure: gộp tất cả tài chính vào 1 section, Sổ kế toán có entry (trước bị nửa vời)
  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: t('more.section.finance'),
      items: [
        // v3.133 — "Tự động tiết kiệm" gộp vào trong "Mục tiêu tiết kiệm", không show riêng
        { icon: 'Scale', name: t('more.summaryToday'), sub: t('more.summaryTodayDesc'), onPress: () => router.push('/summary/today'), arrow: true },
        { icon: 'Wallet', name: t('more.wallets'), sub: t('more.walletsDesc'), onPress: () => router.push('/settings/wallets'), arrow: true },
        { icon: 'Bell', name: t('more.bills'), sub: t('more.billsDesc'), onPress: () => router.push('/bills'), arrow: true },
        { icon: 'Repeat', name: t('more.recurring'), sub: t('more.recurringDesc'), onPress: () => router.push('/settings/recurring'), arrow: true },
        { icon: 'Crown', name: t('more.goals'), sub: t('more.goalsDesc'), onPress: () => router.push('/goals'), arrow: true },
        { icon: 'CalendarDays', name: t('more.salary'), sub: t('more.salaryDesc'), onPress: () => router.push('/settings/salary'), arrow: true },
        { icon: 'BookOpen', name: t('more.books'), sub: t('more.booksDesc'), onPress: () => router.push('/settings/books'), arrow: true },
      ],
    },
    {
      title: t('more.section.settings'),
      items: [
        { icon: 'Settings', name: t('more.settings'), sub: t('more.settingsDesc'), onPress: () => router.push('/settings'), arrow: true },
      ],
    },
    {
      title: t('more.section.about'),
      items: [
        {
          icon: 'Heart', name: t('more.rate'), sub: t('more.rateDesc'),
          onPress: () => { Linking.openURL('https://play.google.com/store/apps/details?id=com.haitruong1804.bopai').catch(() => {}); },
          arrow: false,
        },
        {
          icon: 'Bell', name: t('more.contact'), sub: t('more.contactDesc'),
          onPress: () => { Linking.openURL('mailto:tranhaitruong.cntt@gmail.com?subject=Phản hồi Bux2').catch(() => {}); },
          arrow: false,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('more.title')}</Text>
          {!premium.earlyAccess && premium.tier === 'pro' ? (
            <TouchableOpacity onPress={() => router.push('/premium')} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <ProBadge size="md" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* v3.133 — Pro entry centralised at Settings → Gói sử dụng. Tab Khác only shows badge in title. */}

        {/* Dashboard overview card */}
        <View style={[styles.dashCard, { backgroundColor: palette.primary }]}>
          <View style={styles.dashHead}>
            <Icon name="Scale" size={16} color="#fff" />
            <Text style={styles.dashLabel}>{t('more.balance')}</Text>
          </View>
          <Text style={styles.dashValue}>{formatNumber(stats.totalBalance)}đ</Text>
          <View style={styles.dashStatsRow}>
            <TouchableOpacity style={styles.dashStat} onPress={() => router.push('/bills')}>
              <Icon name="Bell" size={14} color="#fff" />
              <Text style={styles.dashStatText}>
                {stats.billsUrgent > 0
                  ? stats.billsUrgent === 1
                    ? t('more.bills.urgentOne')
                    : t('more.bills.urgent', { count: stats.billsUrgent })
                  : stats.billsActive > 0
                  ? stats.billsActive === 1
                    ? t('more.bills.activeOne')
                    : t('more.bills.active', { count: stats.billsActive })
                  : t('more.bills.empty')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dashStat} onPress={() => router.push('/goals')}>
              <Icon name="Crown" size={14} color="#fff" />
              <Text style={styles.dashStatText}>
                {stats.goalsActive === 0
                  ? t('more.goals.empty')
                  : stats.goalsActive === 1
                    ? t('more.goals.activeOne')
                    : t('more.goals.active', { count: stats.goalsActive })}
              </Text>
            </TouchableOpacity>
          </View>
          {/* v3.39 — Bỏ CTA "Xem phân tích chi tiêu" vì đã có ở Tab Báo cáo. Tránh trùng. */}
        </View>

        {sections.map((section, si) => (
          <View key={si} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((f, i) => (
              <TouchableOpacity
                key={i}
                style={styles.item}
                onPress={f.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: palette.primaryLight }]}>
                  <Icon name={f.icon} size={22} color={palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{f.name}</Text>
                  <Text style={styles.sub}>{f.sub}</Text>
                </View>
                {f.arrow ? <Icon name="ChevronRight" size={20} color="#d1d5db" /> : null}
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <Text style={styles.version}>Bux2 v0.3.0</Text>
        <Text style={styles.copyright}>{t('more.tagline')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: 8 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  name: { fontSize: 14, fontWeight: '600', color: '#111827' },
  sub: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  version: { textAlign: 'center', color: '#9ca3af', fontSize: 11, marginTop: 20 },
  copyright: { textAlign: 'center', color: '#d1d5db', fontSize: 10, marginTop: 2 },
  dashCard: { borderRadius: 16, padding: 18, marginBottom: 16 },
  dashHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dashLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  dashValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 6 },
  dashStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  dashStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dashStatText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dashCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
  },
  dashCtaText: { fontSize: 13, fontWeight: '700' },
  bookSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 12,
  },
  bookSwitcherIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bookSwitcherLabel: { fontSize: 10, color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  bookSwitcherName: { fontSize: 14, color: '#111827', fontWeight: '700', marginTop: 2 },
  bookSwitcherSwitch: { fontSize: 12, fontWeight: '700' },
});
