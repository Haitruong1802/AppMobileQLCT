// v3.66 — Month-end review modal: hiển thị tổng kết tháng + prompt phân bổ dư vào goal.
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../store/useTheme';
import { formatNumber } from '../utils/format';
import { SavingsGoal } from '../db';
import { MonthReviewData } from '../services/monthReview';
import { t } from '../i18n';

type Props = {
  visible: boolean;
  data: MonthReviewData | null;
  goals: SavingsGoal[];
  onApply: (goalId: number, amount: number) => Promise<void>;
  onSkip: () => void;
};

export function MonthReviewModal({ visible, data, goals, onApply, onSkip }: Props) {
  const palette = useTheme();
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);

  const activeGoals = goals.filter((g) => !g.completed_at);

  useEffect(() => {
    if (visible && activeGoals.length > 0 && selectedGoalId === null) {
      setSelectedGoalId(activeGoals[0].id);
    }
  }, [visible, activeGoals.length, selectedGoalId]);

  if (!data) return null;

  const hasLeftover = data.leftover > 0;
  const isOverspent = data.leftover < 0;
  const isBalanced = data.leftover === 0;

  async function handleApply() {
    if (!data || !selectedGoalId || applying) return;
    setApplying(true);
    try {
      await onApply(selectedGoalId, data.leftover);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <Pressable style={styles.bg} onPress={onSkip}>
        <Pressable style={styles.card} onPress={() => {}}>
          <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={[styles.heroBox, { backgroundColor: palette.primaryLight }]}>
              <Icon name="Sparkles" size={32} color={palette.primary} />
              <Text style={[styles.heroTitle, { color: palette.primary }]}>
                {t('monthReview.title', { month: data.monthLabel })}
              </Text>
              <Text style={styles.heroSub}>{t('monthReview.subtitle')}</Text>
            </View>

            {/* Stats grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { backgroundColor: '#ecfdf5' }]}>
                <Text style={styles.statLabel}>{t('monthReview.income')}</Text>
                <Text style={[styles.statValue, { color: palette.income }]}>
                  {formatNumber(data.totalIncome)}đ
                </Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: '#fef2f2' }]}>
                <Text style={styles.statLabel}>{t('monthReview.expense')}</Text>
                <Text style={[styles.statValue, { color: palette.expense }]}>
                  {formatNumber(data.totalExpense)}đ
                </Text>
              </View>
              {data.savingsTarget > 0 ? (
                <View style={[styles.statBox, { backgroundColor: palette.primaryLight }]}>
                  <Text style={styles.statLabel}>{t('monthReview.savings')}</Text>
                  <Text style={[styles.statValue, { color: palette.primary }]}>
                    {formatNumber(data.savingsTarget)}đ
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Leftover state */}
            {hasLeftover ? (
              <>
                <View style={[styles.leftoverBox, { borderColor: palette.primary }]}>
                  <Text style={styles.leftoverLabel}>{t('monthReview.leftoverLabel')}</Text>
                  <Text style={[styles.leftoverValue, { color: palette.primary }]}>
                    {formatNumber(data.leftover)}đ
                  </Text>
                  <Text style={styles.leftoverHint}>{t('monthReview.leftoverHint')}</Text>
                </View>

                {activeGoals.length > 0 ? (
                  <>
                    <Text style={styles.sectionTitle}>{t('monthReview.pickGoal')}</Text>
                    <View style={styles.goalGrid}>
                      {activeGoals.map((g) => {
                        const selected = selectedGoalId === g.id;
                        const remaining = Math.max(0, g.target - g.current);
                        return (
                          <TouchableOpacity
                            key={g.id}
                            style={[
                              styles.goalItem,
                              selected && { borderColor: g.color, borderWidth: 2, backgroundColor: g.color + '15' },
                            ]}
                            onPress={() => setSelectedGoalId(g.id)}
                          >
                            <View style={[styles.goalIconBox, { backgroundColor: g.color + '20' }]}>
                              <Icon name={g.icon} size={18} color={g.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.goalName} numberOfLines={1}>{g.name}</Text>
                              <Text style={styles.goalRemaining}>
                                {t('monthReview.goalRemaining', { amount: formatNumber(remaining) })}
                              </Text>
                            </View>
                            {selected ? <Icon name="Check" size={16} color={g.color} /> : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <View style={[styles.warnBox, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                    <Icon name="AlertCircle" size={18} color="#92400e" />
                    <Text style={styles.warnText}>{t('monthReview.noGoals')}</Text>
                  </View>
                )}
              </>
            ) : isOverspent ? (
              <View style={[styles.warnBox, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]}>
                <Icon name="AlertCircle" size={24} color={palette.expense} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.warnText, { fontWeight: '700' }]}>
                    {t('monthReview.overspentTitle')}
                  </Text>
                  <Text style={[styles.warnText, { marginTop: 4 }]}>
                    {t('monthReview.overspentMsg', { amount: formatNumber(Math.abs(data.leftover)) })}
                  </Text>
                </View>
              </View>
            ) : isBalanced ? (
              <View style={[styles.warnBox, { backgroundColor: palette.primaryLight, borderColor: palette.primary + '40' }]}>
                <Icon name="Check" size={24} color={palette.primary} />
                <Text style={[styles.warnText, { color: palette.primary, marginLeft: 10, flex: 1 }]}>
                  {t('monthReview.balanced')}
                </Text>
              </View>
            ) : null}

            {/* Buttons */}
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.btn, styles.btnSkip]} onPress={onSkip}>
                <Text style={styles.btnSkipText}>{t('monthReview.skip')}</Text>
              </TouchableOpacity>
              {hasLeftover && activeGoals.length > 0 ? (
                <TouchableOpacity
                  style={[styles.btn, styles.btnApply, { backgroundColor: palette.primary, opacity: applying ? 0.6 : 1 }]}
                  onPress={handleApply}
                  disabled={applying || !selectedGoalId}
                >
                  {applying ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnApplyText}>{t('monthReview.apply')}</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  heroBox: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  heroTitle: { fontSize: 20, fontWeight: '800', marginTop: 8 },
  heroSub: { fontSize: 13, color: '#6b7280', marginTop: 4, textAlign: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statBox: { flex: 1, minWidth: '30%', padding: 12, borderRadius: 12 },
  statLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  statValue: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  leftoverBox: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  leftoverLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase' },
  leftoverValue: { fontSize: 32, fontWeight: '800', marginTop: 6 },
  leftoverHint: { fontSize: 12, color: '#6b7280', marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  goalGrid: { gap: 8, marginBottom: 16 },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  goalIconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  goalName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  goalRemaining: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 16,
  },
  warnText: { fontSize: 13, color: '#374151', lineHeight: 18, flex: 1 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  btnSkip: { backgroundColor: '#f3f4f6' },
  btnSkipText: { color: '#6b7280', fontWeight: '700', fontSize: 14 },
  btnApply: {},
  btnApplyText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
