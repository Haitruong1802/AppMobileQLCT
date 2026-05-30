// v3.125 — Card hiển thị trạng thái Pro/Free đầy đủ.
// Dùng ở tab Khác đầu màn + Settings → Tài khoản section.
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from './Icon';
import { usePremiumState } from '../store/usePremium';
import { packageLabel } from '../services/premium';
import { formatDate } from '../utils/date';
import { ProBadge } from './ProBadge';
import { t } from '../i18n';

interface Props {
  /** Compact = chiều cao thấp, không show benefits list. */
  compact?: boolean;
}

export function ProStatusCard({ compact = false }: Props) {
  const router = useRouter();
  const state = usePremiumState();

  // v1.0 phát hành sớm: mọi tính năng đang mở miễn phí, không hiển thị gói trả phí.
  if (state.earlyAccess) {
    return (
      <TouchableOpacity
        style={styles.freeAccessCard}
        onPress={() => router.push('/premium')}
        activeOpacity={0.9}
      >
        <View style={styles.freeAccessRow}>
          <View style={styles.freeAccessIcon}>
            <Icon name="Crown" size={20} color="#fbbf24" strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.freeAccessTitle}>{t('premium.allFree')}</Text>
            <Text style={styles.freeAccessSub}>
              Bản phát hành sớm, cảm ơn bạn đã đồng hành cùng Bux2.
            </Text>
          </View>
          <Icon name="ChevronRight" size={18} color="#fbbf24" />
        </View>
      </TouchableOpacity>
    );
  }

  if (state.tier === 'free') {
    return (
      <TouchableOpacity
        style={styles.upgradeCard}
        onPress={() => router.push('/premium')}
        activeOpacity={0.9}
      >
        <View style={styles.upgradeRow}>
          <View style={styles.upgradeIcon}>
            <Icon name="Crown" size={22} color="#1f2937" strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.upgradeTitleRow}>
              <Text style={styles.upgradeTitle}>Nâng cấp Bux2 Pro</Text>
              <View style={styles.gradeBadge}>
                <Text style={styles.gradeBadgeText}>−38%</Text>
              </View>
            </View>
            <Text style={styles.upgradeSub}>
              Sổ + ví + mục tiêu không giới hạn, 6 theme, tự động tiết kiệm
            </Text>
          </View>
          <Icon name="ChevronRight" size={20} color="#fff" />
        </View>
        {!compact ? (
          <View style={styles.upgradeBenefits}>
            <Text style={styles.upgradeBenefitItem}>✓ Sổ kế toán không giới hạn</Text>
            <Text style={styles.upgradeBenefitItem}>✓ Tự động tiết kiệm hằng ngày</Text>
            <Text style={styles.upgradeBenefitItem}>✓ Theme cao cấp + Insights đầy đủ</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }

  // Pro state — COMPACT: pill 1 dòng. FULL: card chi tiết.
  if (compact) {
    const tail = state.isLifetime
      ? 'Trọn đời'
      : state.daysLeft !== null && state.daysLeft >= 0
      ? `Còn ${state.daysLeft} ngày`
      : 'Hết hạn';
    return (
      <TouchableOpacity
        style={styles.proPill}
        onPress={() => router.push('/premium')}
        activeOpacity={0.85}
      >
        <View style={styles.proPillCrown}>
          <Icon name="Crown" size={14} color="#fbbf24" strokeWidth={2.5} />
        </View>
        <Text style={styles.proPillText}>
          <Text style={styles.proPillStrong}>{t('premium.proLabel')}</Text>
          <Text style={styles.proPillSep}>  ·  </Text>
          {packageLabel(state.package)}
          <Text style={styles.proPillSep}>  ·  </Text>
          {tail}
        </Text>
        <Icon name="ChevronRight" size={16} color="#9ca3af" />
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      style={styles.proCard}
      onPress={() => router.push('/premium')}
      activeOpacity={0.9}
    >
      <View style={styles.proGlow} />
      <View style={styles.proHead}>
        <View style={styles.proCrown}>
          <Icon name="Crown" size={20} color="#fbbf24" strokeWidth={2.5} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.proTitleRow}>
            <Text style={styles.proTitle}>Bux2 Pro đang hoạt động</Text>
            <ProBadge size="sm" />
          </View>
          <Text style={styles.proSub}>
            Tất cả tính năng cao cấp đã mở khoá
          </Text>
        </View>
      </View>
      <View style={styles.proMeta}>
        <View style={styles.proMetaRow}>
          <Text style={styles.proMetaLabel}>{t('premium.currentPlan')}</Text>
          <Text style={styles.proMetaValue}>{packageLabel(state.package)}</Text>
        </View>
        {state.isLifetime ? (
          <View style={styles.proMetaRow}>
            <Text style={styles.proMetaLabel}>{t('premium.duration')}</Text>
            <Text style={styles.proMetaValue}>{t('premium.lifetime')}</Text>
          </View>
        ) : state.expiresAt ? (
          <View style={styles.proMetaRow}>
            <Text style={styles.proMetaLabel}>{t('premium.expires')}</Text>
            <Text style={styles.proMetaValue}>
              {formatDate(state.expiresAt, 'dd/MM/yyyy')}
              {state.daysLeft !== null && state.daysLeft >= 0 ? ` · còn ${state.daysLeft} ngày` : ''}
            </Text>
          </View>
        ) : null}
        <View style={styles.proManageRow}>
          <Text style={styles.proManageLabel}>Xem quyền lợi & quản lý</Text>
          <Icon name="ChevronRight" size={16} color="#fbbf24" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ── EARLY ACCESS (v1.0 free-only) ──
  freeAccessCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  freeAccessRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  freeAccessIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeAccessTitle: { color: '#92400e', fontSize: 14, fontWeight: '800' },
  freeAccessSub: { color: '#b45309', fontSize: 11, marginTop: 3, lineHeight: 15 },

  // ── FREE / UPGRADE STATE ──
  upgradeCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upgradeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  upgradeTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  gradeBadge: { backgroundColor: '#10b981', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  gradeBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  upgradeSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 3, lineHeight: 15 },
  upgradeBenefits: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 4,
  },
  upgradeBenefitItem: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },

  // ── PRO ACTIVE STATE ──
  proCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
    overflow: 'hidden',
  },
  proGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fbbf24',
    opacity: 0.08,
  },
  proHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  proCrown: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  proTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  proSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 3 },
  proMeta: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  proMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  proMetaLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600' },
  proMetaValue: { color: '#fff', fontSize: 13, fontWeight: '700' },
  proManageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  proManageLabel: { color: '#fbbf24', fontSize: 12, fontWeight: '700' },

  // ── PRO COMPACT PILL ──
  proPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 16,
  },
  proPillCrown: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proPillText: { flex: 1, fontSize: 12, color: '#78350f', fontWeight: '600' },
  proPillStrong: { fontWeight: '800', color: '#92400e' },
  proPillSep: { color: '#d1d5db' },
});
