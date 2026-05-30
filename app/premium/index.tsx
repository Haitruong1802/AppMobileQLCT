// v3.125 — Paywall + Pro management screen. Phase 1 mock, Phase 2 RevenueCat.
import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { useTheme } from '../../src/store/useTheme';
import { useT } from '../../src/i18n/useT';
import { t } from '../../src/i18n';
import { PREMIUM_PRICING, FREE_LIMITS, packageLabel, PremiumPackage } from '../../src/services/premium';
import { activatePremium, deactivatePremium, restorePremium, usePremiumState } from '../../src/store/usePremium';
import { notify } from '../../src/utils/notify';
import { formatNumber } from '../../src/utils/format';
import { formatDate } from '../../src/utils/date';
import { ProBadge } from '../../src/components/ProBadge';

type Benefit = {
  icon: string;
  label: string;
  sub: string;
  comingSoon?: boolean;
};

// v3.144 — Benefits chia nhóm: mở giới hạn → tính năng đã có → sắp ra mắt → cam kết.
const BENEFITS: Benefit[] = [
  { icon: 'BookOpen', label: 'Sổ kế toán không giới hạn', sub: `Free tối đa ${FREE_LIMITS.books} sổ` },
  { icon: 'Wallet', label: 'Ví không giới hạn', sub: `Free tối đa ${FREE_LIMITS.wallets} ví` },
  { icon: 'Target', label: 'Mục tiêu tiết kiệm không giới hạn', sub: `Free tối đa ${FREE_LIMITS.goals} mục tiêu` },
  { icon: 'Repeat', label: 'Giao dịch định kỳ không giới hạn', sub: `Free tối đa ${FREE_LIMITS.recurring} giao dịch lặp` },
  { icon: 'Sparkles', label: 'Tự động tiết kiệm hằng ngày', sub: 'Trích một khoản nhỏ vào mục tiêu mỗi ngày.' },
  { icon: 'Cloud', label: 'Sao lưu và khôi phục đầy đủ', sub: 'File mã hoá AES-256, khôi phục trên mọi thiết bị.' },
  { icon: 'Palette', label: 'Bộ theme màu cao cấp', sub: 'Bao gồm các tông màu thiết kế riêng.' },
  { icon: 'BarChart3', label: 'Báo cáo phân tích đầy đủ', sub: 'Insights theo danh mục, mục tiêu và ngân sách.' },
  { icon: 'Filter', label: 'Bộ lọc giao dịch nâng cao', sub: 'Tìm theo danh mục, ví, ngày, số tiền và ghi chú.', comingSoon: true },
  { icon: 'TrendingUp', label: 'Thống kê so sánh theo tháng', sub: 'So sánh tháng này với tháng trước, theo dõi biến động.', comingSoon: true },
  { icon: 'ShieldCheck', label: 'Bảo mật nâng cao', sub: 'Ẩn số dư, tự khoá sau thời gian rảnh, lịch sử truy cập.', comingSoon: true },
  { icon: 'Heart', label: 'Cập nhật tính năng mới liên tục', sub: 'Truy cập sớm các tính năng phát triển trong tương lai.' },
];

export default function Premium() {
  const router = useRouter();
  useT();
  const palette = useTheme();
  const state = usePremiumState();
  const [picked, setPicked] = useState<PremiumPackage>('yearly');
  const [processing, setProcessing] = useState(false);
  const [showBenefits, setShowBenefits] = useState(false);
  const [restoring, setRestoring] = useState(false);

  /** v3.150 — Khôi phục giao dịch mua. Hiện tại MOCK do app chưa wire IAP. */
  async function doRestore() {
    if (restoring) return;
    setRestoring(true);
    try {
      const result = await restorePremium();
      if (result.ok) {
        notify(t('msg.proRestored'), 'success');
      } else {
        const title = result.reason === 'iap-not-configured' ? 'Thông báo' : 'Không thể khôi phục';
        if (Platform.OS === 'web') {
          alert(`${title}\n\n${result.message}`);
        } else {
          Alert.alert(title, result.message, [{ text: 'Đã hiểu' }]);
        }
      }
    } catch (e: any) {
      notify(`Lỗi: ${e?.message || 'không khôi phục được.'}`, 'error');
    } finally {
      setRestoring(false);
    }
  }

  async function doUpgrade() {
    if (processing) return;
    setProcessing(true);
    try {
      const proceed =
        Platform.OS === 'web'
          ? confirm(`Mua gói ${PREMIUM_PRICING[picked].label}? (Bản phát triển, chưa charge thật)`)
          : await new Promise<boolean>((resolve) => {
              Alert.alert(
                'Mua gói Pro',
                `Bản phát triển: nâng cấp giả lập, chưa charge tiền thật.\n\nGói: ${PREMIUM_PRICING[picked].label}\nGiá: ${PREMIUM_PRICING[picked].sub}`,
                [
                  { text: 'Huỷ', onPress: () => resolve(false) },
                  { text: 'Nâng cấp', onPress: () => resolve(true) },
                ]
              );
            });
      if (!proceed) return;
      await activatePremium(picked);
      notify(t('msg.proActivated'), 'success');
      // Không router.back() — để UI tự re-render qua usePremiumState subscription,
      // user sẽ thấy Pro active state ngay trên cùng màn này.
    } catch (e: any) {
      notify(`Lỗi: ${e?.message || 'unknown'}`, 'error');
    } finally {
      setProcessing(false);
    }
  }

  async function doDeactivate() {
    const proceed =
      Platform.OS === 'web'
        ? confirm('DEV: Reset về Free?')
        : await new Promise<boolean>((resolve) => {
            Alert.alert('Reset về Free', 'Chỉ dùng để test paywall (DEV).', [
              { text: 'Huỷ', onPress: () => resolve(false) },
              { text: 'Reset', style: 'destructive', onPress: () => resolve(true) },
            ]);
          });
    if (!proceed) return;
    await deactivatePremium();
    notify(t('msg.proReset'));
  }

  // ───────── EARLY ACCESS STATE (v1.0 free-only) ─────────
  if (state.earlyAccess) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('premium.screenTitle')}</Text>
          <View style={{ width: 32 }} />
        </View>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={[styles.hero, { backgroundColor: palette.primary }]}>
            <Icon name="Crown" size={36} color="#fff" />
            <Text style={styles.heroTitle}>{t('premium.unlockingAll')}</Text>
            <Text style={styles.heroSub}>{t('premium.heroSub')}</Text>
          </View>

          <View style={styles.benefitsList}>
            {BENEFITS.map((b, i) => (
              <View key={i} style={[styles.benefitRow, b.comingSoon && styles.benefitRowMuted]}>
                <View style={[styles.benefitIcon, { backgroundColor: palette.primaryLight }]}>
                  <Icon name={b.icon} size={18} color={palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.benefitLabel}>{b.label}</Text>
                  <Text style={styles.benefitSub}>{b.sub}</Text>
                </View>
                {b.comingSoon ? (
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonText}>{t('premium.comingSoon')}</Text>
                  </View>
                ) : (
                  <Icon name="Check" size={18} color={palette.primary} />
                )}
              </View>
            ))}
          </View>

          <Text style={styles.legal}>
            Tất cả tính năng đang miễn phí trong giai đoạn phát hành sớm. Bux2 hoạt động hoàn toàn ngoại tuyến, dữ liệu của bạn được lưu ngay trên thiết bị.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ───────── PRO ACTIVE STATE (compact, sau khi mua) ─────────
  if (state.tier === 'pro') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Bux2 Pro</Text>
            <ProBadge size="sm" />
          </View>
          <View style={{ width: 32 }} />
        </View>
        <ScrollView contentContainerStyle={styles.container}>
          {/* Compact Hero + status pill cùng card */}
          <View style={styles.proHeroCompact}>
            <View style={styles.proHeroGlow} />
            <View style={styles.proHeroRow}>
              <View style={styles.proHeroCrownSm}>
                <Icon name="Crown" size={24} color="#fbbf24" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.proHeroTitleSm}>{t('premium.proActive')}</Text>
                <View style={styles.proHeroStatusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.proHeroStatusText}>{packageLabel(state.package)}</Text>
                </View>
              </View>
            </View>
            {/* Meta inline */}
            <View style={styles.proMetaGrid}>
              {state.activatedAt ? (
                <View style={styles.proMetaCell}>
                  <Text style={styles.proMetaLabel}>{t('premium.activated')}</Text>
                  <Text style={styles.proMetaValue}>{formatDate(state.activatedAt, 'dd/MM/yyyy')}</Text>
                </View>
              ) : null}
              {state.isLifetime ? (
                <View style={styles.proMetaCell}>
                  <Text style={styles.proMetaLabel}>{t('premium.duration')}</Text>
                  <Text style={[styles.proMetaValue, { color: '#fbbf24' }]}>{t('premium.lifetime')}</Text>
                </View>
              ) : state.expiresAt ? (
                <View style={styles.proMetaCell}>
                  <Text style={styles.proMetaLabel}>{t('premium.expires')}</Text>
                  <Text style={styles.proMetaValue}>
                    {state.daysLeft !== null && state.daysLeft >= 0 ? `Còn ${state.daysLeft} ngày` : 'Hết hạn'}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Toggle quyền lợi (collapse mặc định) */}
          <TouchableOpacity
            style={styles.collapseRow}
            onPress={() => setShowBenefits((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.collapseLabel}>{t('premium.benefitsCurrent')}</Text>
            <Icon name={showBenefits ? 'ChevronLeft' : 'ChevronRight'} size={18} color="#9ca3af" />
          </TouchableOpacity>
          {showBenefits ? (
            <View style={styles.benefitsList}>
              {BENEFITS.map((b, i) => (
                <View key={i} style={[styles.benefitRow, b.comingSoon && styles.benefitRowMuted]}>
                  <View style={[styles.benefitIcon, { backgroundColor: palette.primaryLight }]}>
                    <Icon name={b.icon} size={18} color={palette.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.benefitLabel}>{b.label}</Text>
                  </View>
                  {b.comingSoon ? (
                    <View style={styles.comingSoonBadge}>
                      <Text style={styles.comingSoonText}>{t('premium.comingSoon')}</Text>
                    </View>
                  ) : (
                    <Icon name="Check" size={18} color={palette.primary} />
                  )}
                </View>
              ))}
            </View>
          ) : null}

          {/* v3.150 — Khôi phục: nhẹ, chỉ hiển thị để user biết tính năng tồn tại */}
          <TouchableOpacity
            style={[styles.restoreBtnGhost, restoring && { opacity: 0.6 }]}
            onPress={doRestore}
            disabled={restoring}
            activeOpacity={0.7}
          >
            <Icon name="RotateCcw" size={14} color="#6b7280" strokeWidth={2.2} />
            <Text style={styles.restoreBtnGhostText}>
              {restoring ? 'Đang kiểm tra...' : 'Đồng bộ giao dịch mua'}
            </Text>
          </TouchableOpacity>

          {/* DEV link */}
          <TouchableOpacity style={styles.devResetLink} onPress={doDeactivate}>
            <Text style={styles.devResetText}>DEV: Reset về Free</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ───────── FREE / UPGRADE STATE ─────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>Nâng cấp Pro</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.hero, { backgroundColor: palette.primary }]}>
          <Icon name="Crown" size={36} color="#fff" />
          <Text style={styles.heroTitle}>Bux2 Pro</Text>
          <Text style={styles.heroSub}>Mở khoá toàn bộ tính năng cao cấp.</Text>
        </View>

        <View style={styles.benefitsList}>
          {BENEFITS.map((b, i) => (
            <View key={i} style={[styles.benefitRow, b.comingSoon && styles.benefitRowMuted]}>
              <View style={[styles.benefitIcon, { backgroundColor: palette.primaryLight }]}>
                <Icon name={b.icon} size={18} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.benefitLabel}>{b.label}</Text>
                <Text style={styles.benefitSub}>{b.sub}</Text>
              </View>
              {b.comingSoon ? (
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>{t('premium.comingSoon')}</Text>
                </View>
              ) : (
                <Icon name="Check" size={18} color={palette.primary} />
              )}
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t('premium.choosePlan')}</Text>
        <View style={styles.pricingList}>
          {(Object.keys(PREMIUM_PRICING) as PremiumPackage[]).map((key) => {
            const p = PREMIUM_PRICING[key];
            const selected = picked === key;
            const isBest = key === 'yearly';
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.pricingCard,
                  selected && { borderColor: palette.primary, borderWidth: 2, backgroundColor: palette.primaryLight },
                ]}
                onPress={() => setPicked(key)}
                activeOpacity={0.85}
              >
                {isBest ? (
                  <View style={[styles.bestBadge, { backgroundColor: palette.primary }]}>
                    <Text style={styles.bestBadgeText}>TIẾT KIỆM 38%</Text>
                  </View>
                ) : null}
                <View style={styles.pricingHead}>
                  <Text style={styles.pricingLabel}>{p.label}</Text>
                  <View style={[styles.radio, selected && { borderColor: palette.primary, backgroundColor: palette.primary }]}>
                    {selected ? <Icon name="Check" size={12} color="#fff" /> : null}
                  </View>
                </View>
                <Text style={styles.pricingValue}>{formatNumber(p.price)}đ</Text>
                <Text style={styles.pricingSub}>{p.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.upgradeBtn, { backgroundColor: palette.primary }, processing && { opacity: 0.6 }]}
          onPress={doUpgrade}
          disabled={processing}
        >
          <Icon name="Crown" size={20} color="#fff" />
          <Text style={styles.upgradeBtnText}>
            {processing ? 'Đang xử lý...' : `Nâng cấp ${PREMIUM_PRICING[picked].label}`}
          </Text>
        </TouchableOpacity>

        {/* v3.150 — Khôi phục giao dịch mua (cho user đổi máy / cài lại app) */}
        <View style={styles.restoreBox}>
          <Text style={styles.restoreTitle}>{t('premium.restoreTitle')}</Text>
          <Text style={styles.restoreDesc}>
            Dùng khi bạn đổi máy, cài lại app hoặc đã mua Pro nhưng app chưa nhận diện gói.
          </Text>
          <TouchableOpacity
            style={[styles.restoreBtn, restoring && { opacity: 0.6 }]}
            onPress={doRestore}
            disabled={restoring}
            activeOpacity={0.85}
          >
            <Icon name="RotateCcw" size={16} color="#374151" strokeWidth={2.2} />
            <Text style={styles.restoreBtnText}>
              {restoring ? 'Đang kiểm tra...' : 'Khôi phục giao dịch'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.legal}>
          Bản phát triển: nâng cấp giả lập, chưa charge tiền thật. Khi app phát hành Play Store / App Store, anh sẽ thanh toán qua tài khoản Google/Apple.
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  container: { padding: 16, paddingBottom: 32 },

  // ── HERO (free state) ──
  hero: { borderRadius: 16, padding: 22, alignItems: 'center', marginBottom: 20, gap: 6 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 8 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 18, marginTop: 4 },

  // ── PRO HERO (compact) ──
  proHeroCompact: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
    overflow: 'hidden',
  },
  proHeroGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#fbbf24',
    opacity: 0.1,
  },
  proHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  proHeroCrownSm: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proHeroTitleSm: { fontSize: 15, fontWeight: '800', color: '#fff' },
  proHeroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  proHeroStatusText: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  proMetaGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  proMetaCell: { flex: 1 },
  proMetaLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  proMetaValue: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 4 },

  // ── Collapse row ──
  collapseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 12,
  },
  collapseLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },

  // ── DEV reset link (compact) ──
  devResetLink: { paddingVertical: 10, alignItems: 'center', marginTop: 8 },

  // v3.150 — Restore purchase UI
  restoreBox: {
    backgroundColor: '#fafbfd',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#eef0f4',
  },
  restoreTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  restoreDesc: { fontSize: 12, color: '#6b7280', lineHeight: 18, marginBottom: 12 },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  restoreBtnText: { color: '#374151', fontSize: 13, fontWeight: '700' },
  restoreBtnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 16,
  },
  restoreBtnGhostText: { color: '#6b7280', fontSize: 13, fontWeight: '600' },

  // ── PLAN INFO CARD ──
  planCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planLabel: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  planValue: { fontSize: 14, color: '#111827', fontWeight: '700' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  statusText: { color: '#10b981', fontSize: 12, fontWeight: '700' },

  // ── BENEFITS LIST ──
  benefitsList: { gap: 8, marginBottom: 20 },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    gap: 12,
  },
  benefitIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  benefitLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  benefitSub: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  benefitRowMuted: { opacity: 0.75 },
  comingSoonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.3,
  },

  // ── SECTION LABEL ──
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  // ── PRICING LIST ──
  pricingList: { gap: 10, marginBottom: 20 },
  pricingCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  bestBadge: { position: 'absolute', top: -8, right: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  bestBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  pricingHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pricingLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  pricingValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  pricingSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── UPGRADE CTA ──
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 14,
  },
  upgradeBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // ── DEV RESET ──
  devResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    marginTop: 4,
  },
  devResetText: { color: '#6b7280', fontSize: 12, fontWeight: '600' },

  legal: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 14, lineHeight: 16, paddingHorizontal: 8 },
});
