import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import { notify } from '../../src/utils/notify';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../src/store/useStore';
import { formatNumber } from '../../src/utils/format';
import { Icon } from '../../src/components/Icon';
import { MonthSwitcher } from '../../src/components/MonthSwitcher';
import { WalletSwitcher } from '../../src/components/WalletSwitcher';
import { useTheme } from '../../src/store/useTheme';
import { useT } from '../../src/i18n/useT';
import { useRouter } from 'expo-router';
import { displayCategoryName } from '../../src/i18n/categoryName';
import { getSetting, setSetting, clearBudgetsForMonth, getSavingsGoals, updateSavingsGoal, deleteSavingsGoal, savingsKey, wizardAppliedKey } from '../../src/db';
import { t as tRaw } from '../../src/i18n';
import { usePremiumTier } from '../../src/store/usePremium';
import { forecastMonthSpend } from '../../src/services/notifications';


export default function Budget() {
  const t = useT();
  const router = useRouter();
  const transactions = useStore((s) => s.transactions);
  const categories = useStore((s) => s.categories);
  const budgets = useStore((s) => s.budgets);
  const loadBudgets = useStore((s) => s.loadBudgets);
  const setBudget = useStore((s) => s.setBudget);
  const removeBudget = useStore((s) => s.removeBudget);
  const month = useStore((s) => s.currentMonth);
  const currentWalletId = useStore((s) => s.currentWalletId);
  const currentBookId = useStore((s) => s.currentBookId);
  const palette = useTheme();
  const tier = usePremiumTier();
  const todayYM = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // v3.90 — Đặt lại ngân sách: xoá toàn bộ budgets + savings target + wizard goal flag tháng hiện tại
  // v3.100 — Cũng cleanup Saving Goal đã tạo bởi Wizard (Issue #2): giảm target / xoá nếu chỉ có target từ wizard
  async function resetBudgets() {
    const proceed = async () => {
      try {
        // Đọc savings target cũ trước khi xoá để biết phải giảm goal bao nhiêu
        // v3.108 — Key namespaced theo book (HIGH A fix)
        const oldSavingsStr = await getSetting(savingsKey(currentBookId, month));
        const oldSavings = parseInt(oldSavingsStr || '0', 10) || 0;

        await clearBudgetsForMonth(month, currentBookId);
        await setSetting(savingsKey(currentBookId, month), '0');
        await setSetting(wizardAppliedKey(currentBookId, month), '0');

        // Cleanup Wizard-created Saving Goal: tìm goal name='Quỹ tiết kiệm chung' (i18n) và giảm target
        // v3.103 — Fix MEDIUM #4: nếu target=0 nhưng current>0 → mark completed (đánh dấu hoàn thành),
        //   không để goal "Quỹ tiết kiệm chung" target=0 lơ lửng confusing trong active list.
        if (oldSavings > 0) {
          try {
            const wizardGoalIdKey = `wizard_goal_id_${currentBookId}`;
            const savedIdStr = await getSetting(wizardGoalIdKey);
            const savedId = savedIdStr ? parseInt(savedIdStr, 10) : null;
            const goalName = tRaw('wizard.goalName');
            const allGoals = await getSavingsGoals(currentBookId);
            // v3.108 — Tóm chính xác qua saved ID, fallback name + icon discriminator
            let wizardGoal = savedId ? allGoals.find((g) => g.id === savedId && !g.completed_at) : undefined;
            if (!wizardGoal) {
              wizardGoal = allGoals.find((g) => g.name === goalName && g.icon === 'Wallet' && !g.completed_at);
            }
            if (wizardGoal) {
              const newTarget = Math.max(0, wizardGoal.target - oldSavings);
              const currentAmount = wizardGoal.current || 0;
              if (newTarget === 0 && currentAmount === 0) {
                await deleteSavingsGoal(wizardGoal.id);
                await setSetting(wizardGoalIdKey, '');
              } else if (newTarget === 0 && currentAmount > 0) {
                await updateSavingsGoal(wizardGoal.id, {
                  target: currentAmount,
                  completed_at: new Date().toISOString(),
                });
                await setSetting(wizardGoalIdKey, '');
              } else {
                await updateSavingsGoal(wizardGoal.id, { target: newTarget });
              }
            }
          } catch (gErr) {
            console.warn('[budget] reset goal cleanup fail:', gErr);
          }
        }

        await loadBudgets(month);
        setSavingsTarget(0);
        if (Platform.OS === 'web') alert('Đã xoá toàn bộ ngân sách tháng này');
      } catch (e: any) {
        Alert.alert('', `Lỗi: ${e?.message || 'unknown'}`);
      }
    };
    if (Platform.OS === 'web') {
      if (confirm('Xoá hết ngân sách tháng này?')) proceed();
    } else {
      Alert.alert(
        'Đặt lại ngân sách',
        'Sẽ xoá toàn bộ ngân sách tháng này. Tiếp tục?',
        [
          { text: 'Huỷ', style: 'cancel' },
          { text: 'Xoá', style: 'destructive', onPress: proceed },
        ]
      );
    }
  }

  const [editing, setEditing] = useState<{ catId: number; amount: string } | null>(null);
  const [savingsTarget, setSavingsTarget] = useState<number>(0);

  useEffect(() => {
    loadBudgets(month);
  }, [month]);

  // v3.62 — Reload savings target khi đổi tháng HOẶC khi budgets thay đổi (vd user xoá hết → setting reset)
  useEffect(() => {
    (async () => {
      try {
        const v = await getSetting(savingsKey(currentBookId, month));
        setSavingsTarget(v ? parseInt(v, 10) || 0 : 0);
      } catch {
        setSavingsTarget(0);
      }
    })();
  }, [month, budgets.length, currentBookId]);

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const budgetMap = useMemo(
    () => Object.fromEntries(budgets.map((b) => [b.category_id, b.amount])),
    [budgets]
  );

  // Calc spent per category this month (filter wallet)
  const spentMap = useMemo(() => {
    const map: Record<number, number> = {};
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      if (!t.date.startsWith(month)) continue;
      if (currentWalletId !== null && (t.wallet_id ?? 1) !== currentWalletId) continue;
      map[t.category_id] = (map[t.category_id] || 0) + t.amount;
    }
    return map;
  }, [transactions, month, currentWalletId]);

  const totalBudget = Object.values(budgetMap).reduce((s, x) => s + x, 0);
  // Tổng chi tháng = tất cả expense, không chỉ category có budget. Nếu chưa set budget mà vẫn chi
  // thì user cần thấy con số thật để biết mình đang vượt kế hoạch (totalBudget=0 vs spent>0).
  const totalSpent = Object.values(spentMap).reduce((s, x) => s + x, 0);

  async function saveBudget() {
    if (!editing) return;
    const n = parseInt(editing.amount.replace(/\D/g, ''), 10);
    if (!n || n <= 0) return notify('Nhập số tiền hợp lệ');
    await setBudget(editing.catId, n, month);
    setEditing(null);
  }

  async function clearBudget(catId: number) {
    const doDel = async () => {
      await removeBudget(catId, month);
      setEditing(null);
    };
    if (Platform.OS === 'web') {
      if (confirm('Xoá ngân sách danh mục này?')) doDel();
    } else {
      Alert.alert('Xoá ngân sách', 'Bạn muốn xoá ngân sách của danh mục này?', [
        { text: 'Huỷ' },
        { text: 'Xoá', style: 'destructive', onPress: doDel },
      ]);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('budget.title')}</Text>

        {/* v3.40 — Budget Wizard CTA */}
        <TouchableOpacity
          style={[styles.wizardCta, { backgroundColor: palette.primary }]}
          onPress={() => router.push('/budget-wizard')}
          activeOpacity={0.85}
        >
          <View style={styles.wizardIcon}>
            <Icon name="Sparkles" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.wizardTitle}>{t('budget.wizardCta')}</Text>
            <Text style={styles.wizardSub}>{t('budget.wizardSub')}</Text>
          </View>
          <Icon name="ChevronRight" size={20} color="#fff" />
        </TouchableOpacity>

        <MonthSwitcher />
        <WalletSwitcher />

        {/* Overview */}
        <View style={styles.overview}>
          <View style={styles.ovBox}>
            <Text style={styles.ovLabel}>{t('budget.totalLabel')}</Text>
            <Text style={styles.ovValue}>{formatNumber(totalBudget)}đ</Text>
          </View>
          <View style={styles.ovBox}>
            <Text style={styles.ovLabel}>{t('budget.spent')}</Text>
            <Text style={[styles.ovValue, { color: palette.expense }]}>{formatNumber(totalSpent)}đ</Text>
          </View>
          <View style={styles.ovBox}>
            <Text style={styles.ovLabel}>{t('budget.remaining')}</Text>
            <Text style={[styles.ovValue, { color: totalBudget - totalSpent >= 0 ? palette.income : palette.expense }]}>
              {formatNumber(totalBudget - totalSpent)}đ
            </Text>
          </View>
        </View>

        {/* v3.50 — Hiển thị savings target từ Wizard.
            v3.62 — Chỉ hiện khi có ít nhất 1 budget item (totalBudget > 0).
                    Xoá hết budgets → savings row ẩn (không còn ngân sách thì savings vô nghĩa). */}
        {savingsTarget > 0 && totalBudget > 0 ? (
          <View style={[styles.savingsRow, { backgroundColor: palette.primaryLight, borderColor: palette.primary + '40' }]}>
            <Icon name="Crown" size={18} color={palette.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.savingsLabel, { color: palette.primary }]}>{t('budget.savingsThisMonth')}</Text>
              <Text style={styles.savingsHint}>{t('budget.savingsHint')}</Text>
            </View>
            <Text style={[styles.savingsValue, { color: palette.primary }]}>{formatNumber(savingsTarget)}đ</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{t('budget.byCategory')}</Text>
        <Text style={styles.sectionSub}>{t('budget.byCategoryDesc')}</Text>

        {expenseCategories.map((c) => {
          const budget = budgetMap[c.id];
          const spent = spentMap[c.id] || 0;
          const pct = budget && budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
          const isOver = budget && spent > budget;
          return (
            <TouchableOpacity
              key={c.id}
              style={styles.item}
              onPress={() => setEditing({ catId: c.id, amount: budget ? String(budget) : '' })}
              onLongPress={() => budget && clearBudget(c.id)}
            >
              <View style={[styles.iconBox, { backgroundColor: c.color + '20' }]}>
                <Icon name={c.icon} size={22} color={c.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.itemHead}>
                  <Text style={styles.itemName}>{displayCategoryName(c)}</Text>
                  {budget ? (
                    <Text style={styles.itemBudget}>
                      <Text style={{ color: isOver ? palette.expense : '#1f2937' }}>{formatNumber(spent)}đ</Text>
                      <Text style={{ color: '#9ca3af' }}> / {formatNumber(budget)}đ</Text>
                    </Text>
                  ) : (
                    <Text style={[styles.itemSet, { color: palette.primary }]}>{t('budget.setCta')}</Text>
                  )}
                </View>
                {budget ? (
                  <View style={styles.barBg}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${pct}%`, backgroundColor: isOver ? palette.expense : c.color },
                      ]}
                    />
                  </View>
                ) : null}
                {budget ? (
                  <Text style={[styles.pct, { color: isOver ? palette.expense : '#9ca3af' }]}>
                    {pct.toFixed(0)}% {isOver ? `· ${t('budget.over')}` : ''}
                  </Text>
                ) : null}
                {budget && tier === 'pro' && month === todayYM ? (
                  (() => {
                    const projected = forecastMonthSpend(spent);
                    const projectedOver = projected > budget;
                    return (
                      <Text
                        style={[
                          styles.forecast,
                          { color: projectedOver ? palette.expense : '#6b7280' },
                        ]}
                      >
                        Dự kiến cuối tháng: {formatNumber(projected)}đ
                        {projectedOver ? ' · sẽ vượt' : ''}
                      </Text>
                    );
                  })()
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.hint}>{t('budget.tapToSet')}</Text>

        {/* v3.90 — Nút Đặt lại ngân sách (chỉ hiện khi đã có ngân sách) */}
        {totalBudget > 0 ? (
          <TouchableOpacity style={styles.resetBtn} onPress={resetBudgets}>
            <Icon name="Trash2" size={14} color="#dc2626" />
            <Text style={styles.resetText}>Đặt lại ngân sách (xoá hết)</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.modalBg} onPress={() => setEditing(null)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {(() => {
                const c = categories.find((c) => c.id === editing?.catId);
                return t('budget.modalTitle', { name: c ? displayCategoryName(c) : '' });
              })()}
            </Text>
            <Text style={styles.modalSub}>{t('budget.modalSub', { month })}</Text>
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                value={editing ? formatNumber(parseInt(editing.amount.replace(/\D/g, ''), 10) || 0) : ''}
                onChangeText={(v) =>
                  setEditing((e) => (e ? { ...e, amount: v.replace(/\D/g, '') } : e))
                }
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#9ca3af"
              />
              <Text style={styles.currency}>đ</Text>
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setEditing(null)}>
                <Text style={styles.btnGhostText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              {editing && budgetMap[editing.catId] ? (
                <TouchableOpacity
                  style={[styles.btn, styles.btnDanger, { backgroundColor: palette.expense }]}
                  onPress={() => clearBudget(editing.catId)}
                >
                  <Text style={styles.btnDangerText}>{t('common.delete')}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: palette.primary }]} onPress={saveBudget}>
                <Text style={styles.btnPrimaryText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 16 },
  wizardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  wizardIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  wizardTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  wizardSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 },
  overview: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  savingsLabel: { fontSize: 13, fontWeight: '800' },
  savingsHint: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  savingsValue: { fontSize: 16, fontWeight: '800' },
  ovBox: { flex: 1, backgroundColor: '#f9fafb', padding: 12, borderRadius: 10 },
  ovLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600', marginBottom: 4 },
  ovValue: { fontSize: 14, fontWeight: '800', color: '#111827' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionSub: { fontSize: 11, color: '#9ca3af', marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  itemBudget: { fontSize: 12, fontWeight: '600' },
  itemSet: { fontSize: 12, fontWeight: '600' },
  barBg: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  pct: { fontSize: 10, marginTop: 2 },
  forecast: { fontSize: 10, marginTop: 2, fontWeight: '600' },
  hint: { textAlign: 'center', color: '#9ca3af', fontSize: 11, marginTop: 20 },
  resetBtn: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  resetText: { color: '#dc2626', fontSize: 13, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  modalSub: { fontSize: 12, color: '#6b7280', marginBottom: 16 },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, marginBottom: 16 },
  amountInput: { flex: 1, padding: 12, fontSize: 22, fontWeight: '700', color: '#111827' },
  currency: { fontSize: 18, fontWeight: '700', color: '#6b7280' },
  modalBtns: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  btnGhost: { backgroundColor: '#f3f4f6' },
  btnGhostText: { color: '#6b7280', fontWeight: '700' },
  btnPrimary: {},
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnDanger: {},
  btnDangerText: { color: '#fff', fontWeight: '700' },
});
