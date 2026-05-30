// v3.40 — Budget Wizard 4 bước: gợi ý phân bổ ngân sách thông minh.
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { notify } from '../../src/utils/notify';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { useStore } from '../../src/store/useStore';
import { useTheme } from '../../src/store/useTheme';
import { formatNumber } from '../../src/utils/format';
import {
  recommendBudget,
  detectIncomeFromHistory,
  RecommendItem,
  RecommendResult,
  BUDGET_RULES,
  BudgetRuleId,
  getBudgetRule,
} from '../../src/services/budgetRecommender';
import { getBills, getRecurringRules, RecurringRule, Bill, Category, setSetting, getSetting, clearBudgetsForMonth, getSavingsGoals, addSavingsGoal, updateSavingsGoal, deleteSavingsGoal, savingsKey, wizardAppliedKey } from '../../src/db';
import { t } from '../../src/i18n';
import { FONT_SIZE, FONT_WEIGHT, GRAY, RADIUS, SEMANTIC, SPACING } from '../../src/theme/tokens';

const SAVINGS_PRESETS = [10, 20, 30];

export default function BudgetWizard() {
  const router = useRouter();
  const palette = useTheme();
  const transactions = useStore((s) => s.transactions);
  const categories = useStore((s) => s.categories);
  const currentMonth = useStore((s) => s.currentMonth);
  const currentBookId = useStore((s) => s.currentBookId);
  const setBudget = useStore((s) => s.setBudget);

  const [step, setStep] = useState(1);

  // Bước 1
  const [income, setIncome] = useState('');
  const [bonus, setBonus] = useState('');

  // Bước 2
  const [fixedExpenses, setFixedExpenses] = useState<{ id: string; categoryId: number; name: string; amount: number }[]>([]);
  // Form thêm fixed thủ công
  const [addCatId, setAddCatId] = useState<number | null>(null);
  const [addAmount, setAddAmount] = useState('');

  // Bước 3
  const [savingsPct, setSavingsPct] = useState<number>(20);
  const [savingsCustom, setSavingsCustom] = useState('');
  const [savingsMode, setSavingsMode] = useState<'pct' | 'custom'>('pct');
  // v3.107 — Track giá trị user chọn ở Step 3 (KHÔNG bị useEffect ép theo rule) để feedback box hiển thị đúng
  // v3.108 — init null thay vì 20 (default chưa phải user chose) → box ẩn cho đến khi user thực tap preset
  const [userChosenSavingsPct, setUserChosenSavingsPct] = useState<number | null>(null);

  // Bước 4 - result computed live + chọn 1/3 quy tắc (v3.92)
  const [applying, setApplying] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<BudgetRuleId>('50/30/20');

  // Auto-detect income lần đầu mount
  useEffect(() => {
    if (income) return;
    const detected = detectIncomeFromHistory(transactions);
    if (detected > 0) setIncome(String(detected));
    // Auto-load fixed expenses từ recurring + bills
    (async () => {
      try {
        const [rules, bills] = await Promise.all([getRecurringRules(currentBookId), getBills(currentBookId)]);
        const fixed: typeof fixedExpenses = [];
        for (const r of rules.filter((x: RecurringRule) => x.active === 1 && x.type === 'expense')) {
          const cat = categories.find((c) => c.id === r.category_id);
          if (!cat) continue;
          fixed.push({ id: `r${r.id}`, categoryId: r.category_id, name: cat.name + (r.note ? ` (${r.note})` : ''), amount: r.amount });
        }
        for (const b of bills.filter((x: Bill) => !x.paid_at)) {
          if (!b.category_id) continue;
          const cat = categories.find((c) => c.id === b.category_id);
          if (!cat) continue;
          fixed.push({ id: `b${b.id}`, categoryId: b.category_id, name: b.name, amount: b.amount });
        }
        setFixedExpenses(fixed);
      } catch {
        /* noop */
      }
    })();
  }, [transactions, categories]);

  const incomeN = parseInt(income.replace(/\D/g, ''), 10) || 0;
  const bonusN = parseInt(bonus.replace(/\D/g, ''), 10) || 0;
  const totalIncome = incomeN + bonusN;
  const totalFixed = fixedExpenses.reduce((s, x) => s + x.amount, 0);

  const savingsTarget =
    savingsMode === 'pct'
      ? Math.floor((totalIncome * savingsPct) / 100)
      : parseInt(savingsCustom.replace(/\D/g, ''), 10) || 0;

  // v3.92 — Auto-update savingsPct theo quy tắc chọn (chỉ khi user đang ở pct mode)
  useEffect(() => {
    if (savingsMode === 'pct') {
      const r = getBudgetRule(selectedRuleId);
      setSavingsPct(r.savingsPct);
    }
  }, [selectedRuleId, savingsMode]);

  // v3.92 — Compute thay đổi savingsTarget theo rule cũng (override pct nếu rule khác)
  const ruleSavingsTarget =
    savingsMode === 'pct'
      ? Math.floor((totalIncome * getBudgetRule(selectedRuleId).savingsPct) / 100)
      : savingsTarget;

  const result: RecommendResult | null = useMemo(() => {
    if (step !== 4 || totalIncome <= 0) return null;
    return recommendBudget({
      income: totalIncome,
      fixedExpenses: fixedExpenses.map((f) => ({ categoryId: f.categoryId, amount: f.amount })),
      savingsTarget: ruleSavingsTarget,
      categories: categories as Category[],
      history: transactions,
      ruleId: selectedRuleId,
    });
  }, [step, totalIncome, fixedExpenses, ruleSavingsTarget, categories, transactions, selectedRuleId]);

  function next() {
    if (step === 1 && totalIncome <= 0) return notify('Nhập thu nhập tháng');
    if (step === 3 && savingsTarget < 0) return notify('Tiết kiệm không hợp lệ');
    if (step < 4) setStep(step + 1);
  }
  function back() {
    if (step > 1) setStep(step - 1);
    else router.back();
  }

  async function applyBudgets() {
    if (!result) return;
    setApplying(true);
    try {
      // v3.53 — Clear hết budget cũ của tháng trước khi apply mới.
      //         Tránh tích luỹ: chạy Wizard lần 1 (có Tiền nhà 3tr fixed), lần 2 (không fixed) →
      //         Tiền nhà 3tr cũ vẫn lưu DB → tổng budget bị thừa 3tr.
      // v3.63 — Pass currentBookId tránh wipe budgets book khác
      await clearBudgetsForMonth(currentMonth, currentBookId);
      for (const item of result.items) {
        if (item.recommended > 0) {
          await setBudget(item.categoryId, item.recommended, currentMonth);
        }
      }
      // v3.50 — Lưu savings target để tab Ngân sách hiển thị row "Tiết kiệm"
      // v3.103 — Đọc savings cũ TRƯỚC khi overwrite để tính delta cho goal (Fix MEDIUM #3)
      // v3.108 — Key namespaced theo book để tránh cross-book leak
      const sKey = savingsKey(currentBookId, currentMonth);
      const oldSavingsStr = await getSetting(sKey);
      const oldSavings = parseInt(oldSavingsStr || '0', 10) || 0;
      await setSetting(sKey, String(result.savingsTarget));

      // v3.55 — Auto-create/update Saving Goal để Active Savings daily allocator có chỗ rót tiền.
      // v3.103 — Re-run cùng tháng: tính delta (new - old) để update goal đúng, không bị flag block.
      //   Lần 1: oldSavings=0, savings=1tr → goal.target +=1tr → 1tr.
      //   Lần 2 cùng tháng: oldSavings=1tr (vừa đọc), savings=2tr → delta=1tr → goal.target +=1tr → 2tr.
      //   Lần 2 trừ: oldSavings=2tr, savings=500k → delta=-1.5tr → goal.target -=1.5tr (nhưng max 0).
      try {
        const goalName = t('wizard.goalName');
        const allGoals = await getSavingsGoals(currentBookId);
        // v3.108 — Discriminator: lưu wizard goal ID trong setting để tóm CHÍNH XÁC, không trùng manual goal
        const wizardGoalIdKey = `wizard_goal_id_${currentBookId}`;
        const savedIdStr = await getSetting(wizardGoalIdKey);
        const savedId = savedIdStr ? parseInt(savedIdStr, 10) : null;
        let existing = savedId ? allGoals.find((g) => g.id === savedId && !g.completed_at) : undefined;
        // Fallback (backward-compat): nếu chưa có saved ID, dùng name + icon discriminator
        if (!existing) {
          existing = allGoals.find((g) => g.name === goalName && g.icon === 'Wallet' && !g.completed_at);
          if (existing) await setSetting(wizardGoalIdKey, String(existing.id));
        }
        const delta = result.savingsTarget - oldSavings;
        if (existing) {
          if (delta !== 0) {
            const newTarget = Math.max(0, existing.target + delta);
            // v3.106 — Fix MEDIUM: nếu newTarget=0 thì cleanup goal đồng bộ với reset budget
            //   current=0 → delete hoàn toàn. current>0 → mark completed với target=current (lưu lại đã tích).
            if (newTarget === 0) {
              if ((existing.current || 0) === 0) {
                await deleteSavingsGoal(existing.id);
                await setSetting(wizardGoalIdKey, ''); // clear saved ID
              } else {
                await updateSavingsGoal(existing.id, {
                  target: existing.current,
                  completed_at: new Date().toISOString(),
                });
                await setSetting(wizardGoalIdKey, ''); // goal completed, clear ID
              }
            } else {
              await updateSavingsGoal(existing.id, { target: newTarget });
            }
          }
        } else if (result.savingsTarget > 0) {
          // Chưa có goal + savings>0 → tạo mới
          // v3.105 — Fix HIGH cross-book leak: pass currentBookId để goal nằm đúng book hiện tại
          const newGoalId = await addSavingsGoal({
            name: goalName,
            target: result.savingsTarget,
            icon: 'Wallet',
            color: palette.primary,
            book_id: currentBookId,
          });
          // v3.108 — Lưu wizard goal ID để lần re-run tóm chính xác (tránh collision name+icon)
          await setSetting(wizardGoalIdKey, String(newGoalId));
        }
        // Flag không còn cần thiết (logic mới idempotent qua delta) — vẫn set để backwards-compat
        await setSetting(wizardAppliedKey(currentBookId, currentMonth), result.savingsTarget > 0 ? '1' : '0');
      } catch (e) {
        console.warn('[wizard] auto goal update fail:', e);
      }

      notify('Đã áp dụng ngân sách + tạo Quỹ tiết kiệm cho tháng này');
      router.replace('/(tabs)/budget');
    } catch (e: any) {
      notify(`Lỗi: ${e?.message || 'unknown'}`);
    } finally {
      setApplying(false);
    }
  }

  function removeFixed(id: string) {
    setFixedExpenses((arr) => arr.filter((x) => x.id !== id));
  }

  function addCustomFixed() {
    const amt = parseInt(addAmount.replace(/\D/g, ''), 10) || 0;
    if (!addCatId || amt <= 0) {
      return notify('Chọn danh mục và nhập số tiền');
    }
    const cat = categories.find((c) => c.id === addCatId);
    if (!cat) return;
    const id = `c-${Date.now()}`;
    setFixedExpenses((arr) => [...arr, { id, categoryId: cat.id, name: cat.name, amount: amt }]);
    setAddAmount('');
    setAddCatId(null);
  }

  // Categories có thể chọn cho fixed (expense + visible)
  const expenseCats = categories.filter((c) => c.type === 'expense' && (c.is_visible ?? 1) === 1);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={back} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={24} color={GRAY[800]} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>Gợi ý ngân sách</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressOuter}>
        <View style={[styles.progressInner, { width: `${(step / 4) * 100}%`, backgroundColor: palette.primary }]} />
      </View>
      <Text style={[styles.stepLabel, { color: palette.primary }]}>Bước {step}/4</Text>

      <ScrollView contentContainerStyle={styles.container}>
        {/* ============ STEP 1: Thu nhập ============ */}
        {step === 1 ? (
          <>
            <Text style={styles.stepTitle}>Thu nhập tháng của bạn?</Text>
            <Text style={styles.stepHint}>Bux2 đã tự lấy từ giao dịch thu trước. Bạn chỉnh nếu cần.</Text>

            <Text style={styles.label}>LƯƠNG CỨNG</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                value={income ? formatNumber(parseInt(income.replace(/\D/g, ''), 10) || 0) : ''}
                onChangeText={(v) => setIncome(v.replace(/\D/g, ''))}
                placeholder="0"
                placeholderTextColor={GRAY[400]}
                keyboardType="numeric"
              />
              <Text style={styles.currency}>đ</Text>
            </View>

            <Text style={styles.label}>THƯỞNG / THU KHÁC (tuỳ chọn)</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                value={bonus ? formatNumber(parseInt(bonus.replace(/\D/g, ''), 10) || 0) : ''}
                onChangeText={(v) => setBonus(v.replace(/\D/g, ''))}
                placeholder="0"
                placeholderTextColor={GRAY[400]}
                keyboardType="numeric"
              />
              <Text style={styles.currency}>đ</Text>
            </View>

            {totalIncome > 0 ? (
              <View style={styles.sumBox}>
                <Text style={styles.sumLabel}>Tổng thu nhập tháng</Text>
                <Text style={[styles.sumValue, { color: palette.primary }]}>
                  {formatNumber(totalIncome)}đ
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        {/* ============ STEP 2: Chi cố định ============ */}
        {step === 2 ? (
          <>
            <Text style={styles.stepTitle}>Chi cố định hàng tháng</Text>
            <Text style={styles.stepHint}>
              Khoản phải trả mỗi tháng (tiền nhà, internet, gói data...). Bux2 tự lấy từ giao dịch lặp +
              hoá đơn. Bạn có thể thêm thủ công.
            </Text>

            {fixedExpenses.length === 0 ? (
              <View style={styles.emptyBox}>
                <Icon name="AlertCircle" size={20} color={SEMANTIC.warning.fg} />
                <Text style={styles.emptyText}>
                  Chưa có khoản cố định nào. Thêm Tiền nhà / Internet / Gói data bằng form bên
                  dưới nếu có.
                </Text>
              </View>
            ) : (
              fixedExpenses.map((f) => (
                <View key={f.id} style={styles.fixRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fixName}>{f.name}</Text>
                    <Text style={styles.fixAmount}>{formatNumber(f.amount)}đ / tháng</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeFixed(f.id)} style={styles.fixRemove}>
                    <Icon name="X" size={16} color={GRAY[500]} />
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* Form add custom fixed */}
            <Text style={[styles.label, { marginTop: SPACING.lg }]}>+ THÊM KHOẢN CỐ ĐỊNH</Text>

            <Text style={styles.subLabel}>Danh mục</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 4, gap: 8 }}
            >
              {expenseCats.map((c) => {
                const sel = addCatId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.catChip,
                      sel && { borderColor: c.color, borderWidth: 2, backgroundColor: c.color + '15' },
                    ]}
                    onPress={() => setAddCatId(c.id)}
                  >
                    <Icon name={c.icon} size={14} color={sel ? c.color : GRAY[500]} />
                    <Text
                      style={[
                        styles.catChipText,
                        sel && { color: c.color, fontWeight: FONT_WEIGHT.extrabold },
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.subLabel}>Số tiền/tháng</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                value={addAmount ? formatNumber(parseInt(addAmount.replace(/\D/g, ''), 10) || 0) : ''}
                onChangeText={(v) => setAddAmount(v.replace(/\D/g, ''))}
                placeholder="0"
                placeholderTextColor={GRAY[400]}
                keyboardType="numeric"
              />
              <Text style={styles.currency}>đ</Text>
            </View>

            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: palette.primary }]}
              onPress={addCustomFixed}
            >
              <Icon name="Plus" size={16} color="#fff" />
              <Text style={styles.addBtnText}>Thêm vào danh sách</Text>
            </TouchableOpacity>

            <View style={styles.sumBox}>
              <Text style={styles.sumLabel}>Tổng chi cố định</Text>
              <Text style={[styles.sumValue, { color: SEMANTIC.danger.fg }]}>
                {formatNumber(totalFixed)}đ
              </Text>
            </View>

            <View style={styles.sumBox}>
              <Text style={styles.sumLabel}>Còn lại (thu - cố định)</Text>
              <Text style={[styles.sumValue, { color: palette.primary }]}>
                {formatNumber(Math.max(0, totalIncome - totalFixed))}đ
              </Text>
            </View>
          </>
        ) : null}

        {/* ============ STEP 3: Mục tiêu tiết kiệm ============ */}
        {step === 3 ? (
          <>
            <Text style={styles.stepTitle}>Muốn để dành bao nhiêu?</Text>
            <Text style={styles.stepHint}>Quy tắc 50/30/20 của Elizabeth Warren gợi ý 20% thu nhập.</Text>

            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, savingsMode === 'pct' && { backgroundColor: palette.primary, borderColor: palette.primary }]}
                onPress={() => setSavingsMode('pct')}
              >
                <Text style={[styles.modeText, savingsMode === 'pct' && { color: '#fff', fontWeight: FONT_WEIGHT.extrabold }]}>
                  Theo %
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, savingsMode === 'custom' && { backgroundColor: palette.primary, borderColor: palette.primary }]}
                onPress={() => setSavingsMode('custom')}
              >
                <Text style={[styles.modeText, savingsMode === 'custom' && { color: '#fff', fontWeight: FONT_WEIGHT.extrabold }]}>
                  Số cụ thể
                </Text>
              </TouchableOpacity>
            </View>

            {savingsMode === 'pct' ? (
              <View style={styles.pctRow}>
                {SAVINGS_PRESETS.map((p) => {
                  const sel = savingsPct === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.pctBtn, sel && { backgroundColor: palette.primary, borderColor: palette.primary }]}
                      onPress={() => {
                        // v3.50 — defensive ép mode='pct' khi tap preset (tránh state lệch)
                        setSavingsMode('pct');
                        setSavingsPct(p);
                        setUserChosenSavingsPct(p);
                      }}
                    >
                      <Text style={[styles.pctText, sel && { color: '#fff', fontWeight: FONT_WEIGHT.extrabold }]}>
                        {p}%
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.input}
                  value={savingsCustom ? formatNumber(parseInt(savingsCustom.replace(/\D/g, ''), 10) || 0) : ''}
                  onChangeText={(v) => setSavingsCustom(v.replace(/\D/g, ''))}
                  placeholder="0"
                  placeholderTextColor={GRAY[400]}
                  keyboardType="numeric"
                />
                <Text style={styles.currency}>đ</Text>
              </View>
            )}

            <View style={styles.sumBox}>
              <Text style={styles.sumLabel}>= {formatNumber(savingsTarget)}đ/tháng</Text>
              <Text style={[styles.sumValue, { color: palette.primary, fontSize: FONT_SIZE.body }]}>
                {totalIncome > 0
                  ? `${Math.round((savingsTarget / totalIncome) * 100)}% thu nhập`
                  : ''}
              </Text>
            </View>

            {savingsTarget + totalFixed > totalIncome ? (
              <View style={styles.warnBox}>
                <Icon name="AlertTriangle" size={16} color={SEMANTIC.danger.fg} />
                <Text style={styles.warnText}>
                  Chi cố định + tiết kiệm vượt thu nhập. Cần giảm tiết kiệm hoặc thu nhập thêm.
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        {/* ============ STEP 4: Gợi ý phân bổ ============ */}
        {step === 4 && result ? (
          <>
            <Text style={styles.stepTitle}>Gợi ý phân bổ ngân sách</Text>
            <Text style={styles.stepHint}>
              Chọn 1 trong 3 quy tắc phân bổ phù hợp với bạn. Có thể chỉnh lại trong tab Ngân sách sau.
            </Text>

            {/* v3.92 — 3 quy tắc cho user chọn */}
            <View style={styles.ruleList}>
              {BUDGET_RULES.map((r) => {
                const selected = r.id === selectedRuleId;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.ruleCard,
                      selected && { borderColor: palette.primary, backgroundColor: palette.primaryLight, borderWidth: 2 },
                    ]}
                    onPress={() => setSelectedRuleId(r.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.ruleHead}>
                      <View style={[styles.ruleRadio, selected && { borderColor: palette.primary, backgroundColor: palette.primary }]}>
                        {selected ? <Icon name="Check" size={12} color="#fff" /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.ruleName, selected && { color: palette.primary }]}>
                          {r.name}
                        </Text>
                        <Text style={styles.ruleSubtitle}>{r.subtitle}</Text>
                      </View>
                      <Text style={[styles.ruleBadge, selected && { color: palette.primary }]}>
                        {r.id}
                      </Text>
                    </View>
                    <View style={styles.ruleStats}>
                      <Text style={styles.ruleStat}>
                        <Text style={{ color: '#0891b2', fontWeight: '700' }}>{r.needsPct}%</Text> thiết yếu
                      </Text>
                      <Text style={styles.ruleStat}>
                        <Text style={{ color: '#d97706', fontWeight: '700' }}>{r.wantsPct}%</Text> mong muốn
                      </Text>
                      <Text style={styles.ruleStat}>
                        <Text style={{ color: palette.primary, fontWeight: '700' }}>{r.savingsPct}%</Text> tiết kiệm
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* v3.107 — Visual feedback: báo savings đã đổi theo rule (so với Step 3 user chọn) */}
            {/* v3.108 — Chỉ hiện khi user thực sự đã chọn pct ở Step 3 (userChosenSavingsPct != null) */}
            {savingsMode === 'pct' && userChosenSavingsPct !== null && userChosenSavingsPct !== getBudgetRule(selectedRuleId).savingsPct ? (
              <View style={styles.savingsAdjustedNote}>
                <Icon name="Info" size={14} color="#0891b2" />
                <Text style={styles.savingsAdjustedText}>
                  Tiết kiệm tự cập nhật theo quy tắc: {formatNumber(ruleSavingsTarget)}đ ({getBudgetRule(selectedRuleId).savingsPct}% thu nhập)
                </Text>
              </View>
            ) : null}

            {result.isInfeasible ? (
              <View style={styles.warnBox}>
                <Icon name="AlertTriangle" size={16} color={SEMANTIC.danger.fg} />
                <Text style={styles.warnText}>{result.warning}</Text>
              </View>
            ) : null}

            {/* Cố định */}
            {result.items.filter((i) => i.isFixed).length > 0 ? (
              <>
                <Text style={[styles.groupHeader, { color: GRAY[600] }]}>CHI CỐ ĐỊNH</Text>
                {result.items.filter((i) => i.isFixed).map((i) => (
                  <BudgetItem key={`f-${i.categoryId}`} item={i} palette={palette} />
                ))}
              </>
            ) : null}

            {/* Needs */}
            {result.items.filter((i) => i.group === 'needs').length > 0 ? (
              <>
                <Text style={[styles.groupHeader, { color: '#0891b2' }]}>
                  THIẾT YẾU (~{getBudgetRule(selectedRuleId).needsPct}%)
                </Text>
                {result.items.filter((i) => i.group === 'needs').map((i) => (
                  <BudgetItem key={`n-${i.categoryId}`} item={i} palette={palette} />
                ))}
              </>
            ) : null}

            {/* Wants */}
            {result.items.filter((i) => i.group === 'wants').length > 0 ? (
              <>
                <Text style={[styles.groupHeader, { color: '#d97706' }]}>
                  MONG MUỐN (~{getBudgetRule(selectedRuleId).wantsPct}%)
                </Text>
                {result.items.filter((i) => i.group === 'wants').map((i) => (
                  <BudgetItem key={`w-${i.categoryId}`} item={i} palette={palette} />
                ))}
              </>
            ) : null}

            {/* Savings summary */}
            <View style={[styles.sumBox, { backgroundColor: palette.primaryLight, borderColor: palette.primary + '40' }]}>
              <Text style={[styles.sumLabel, { color: palette.primary, fontWeight: FONT_WEIGHT.bold }]}>
                💰 Tiết kiệm
              </Text>
              <Text style={[styles.sumValue, { color: palette.primary }]}>
                {formatNumber(result.savingsTarget)}đ
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Footer button */}
      <View style={styles.footer}>
        {step < 4 ? (
          (() => {
            // v3.65 — M6: disable Next ở Step 1 nếu income=0
            const nextDisabled = step === 1 && totalIncome <= 0;
            return (
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: palette.primary, opacity: nextDisabled ? 0.4 : 1 }]}
                onPress={next}
                disabled={nextDisabled}
              >
                <Text style={styles.nextText}>Tiếp tục →</Text>
              </TouchableOpacity>
            );
          })()
        ) : (
          <TouchableOpacity
            style={[
              styles.nextBtn,
              { backgroundColor: result?.isInfeasible ? GRAY[300] : palette.primary, opacity: applying ? 0.6 : 1 },
            ]}
            onPress={applyBudgets}
            disabled={!result || result.isInfeasible || applying}
          >
            {applying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextText}>Áp dụng vào ngân sách ✓</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function BudgetItem({ item, palette }: { item: RecommendItem; palette: any }) {
  return (
    <View style={styles.itemRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemName}>{item.categoryName}</Text>
        <Text style={styles.itemReason}>{item.reason}</Text>
      </View>
      <Text style={[styles.itemAmount, { color: item.isFixed ? GRAY[600] : palette.primary }]}>
        {formatNumber(item.recommended)}đ
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: GRAY[100],
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: GRAY[900] },
  progressOuter: { height: 4, backgroundColor: GRAY[100], marginHorizontal: SPACING.lg, marginTop: SPACING.md, borderRadius: RADIUS.full, overflow: 'hidden' },
  progressInner: { height: 4 },
  stepLabel: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 0.5,
    marginLeft: SPACING.lg,
    marginTop: SPACING.xs + 2,
    textTransform: 'uppercase',
  },
  container: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  stepTitle: { fontSize: FONT_SIZE.titleLg, fontWeight: FONT_WEIGHT.extrabold, color: GRAY[900], marginBottom: SPACING.xs },
  stepHint: { fontSize: FONT_SIZE.small, color: GRAY[500], lineHeight: 18, marginBottom: SPACING.lg },
  label: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
    color: GRAY[500],
    letterSpacing: 0.5,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs + 2,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GRAY[50],
    borderWidth: 1,
    borderColor: GRAY[200],
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  input: { flex: 1, padding: SPACING.md, fontSize: FONT_SIZE.titleLg, fontWeight: FONT_WEIGHT.bold, color: GRAY[900] },
  currency: { fontSize: FONT_SIZE.bodyLg, color: GRAY[500], fontWeight: FONT_WEIGHT.bold },
  sumBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GRAY[50],
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: GRAY[200],
  },
  sumLabel: { fontSize: FONT_SIZE.body, color: GRAY[700], fontWeight: FONT_WEIGHT.medium },
  sumValue: { fontSize: FONT_SIZE.titleLg, fontWeight: FONT_WEIGHT.extrabold },
  emptyBox: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: SEMANTIC.warning.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SEMANTIC.warning.tint,
    alignItems: 'flex-start',
  },
  emptyText: { flex: 1, fontSize: FONT_SIZE.small, color: SEMANTIC.warning.text, lineHeight: 17 },
  fixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: GRAY[200],
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  fixName: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: GRAY[900] },
  fixAmount: { fontSize: FONT_SIZE.small, color: GRAY[500], marginTop: 2 },
  fixRemove: { width: 28, height: 28, borderRadius: 14, backgroundColor: GRAY[100], alignItems: 'center', justifyContent: 'center' },
  subLabel: { fontSize: FONT_SIZE.small, color: GRAY[600], fontWeight: FONT_WEIGHT.semibold, marginTop: SPACING.sm, marginBottom: SPACING.xs },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: GRAY[200],
  },
  catChipText: { fontSize: FONT_SIZE.small, color: GRAY[700], fontWeight: FONT_WEIGHT.semibold },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs + 2,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  addBtnText: { color: '#fff', fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  modeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  modeBtn: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: GRAY[200],
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  modeText: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: GRAY[700] },
  pctRow: { flexDirection: 'row', gap: SPACING.sm },
  pctBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: GRAY[200],
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  pctText: { fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold, color: GRAY[700] },
  warnBox: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: SEMANTIC.danger.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SEMANTIC.danger.tint,
    marginTop: SPACING.md,
    alignItems: 'flex-start',
  },
  warnText: { flex: 1, fontSize: FONT_SIZE.small, color: SEMANTIC.danger.text, lineHeight: 17 },
  groupHeader: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.extrabold,
    letterSpacing: 0.5,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: GRAY[50],
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  itemName: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: GRAY[900] },
  itemReason: { fontSize: FONT_SIZE.small, color: GRAY[500], marginTop: 2, lineHeight: 16 },
  itemAmount: { fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.extrabold },
  footer: {
    padding: SPACING.md,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xxl : SPACING.md,
    borderTopWidth: 1,
    borderTopColor: GRAY[100],
    backgroundColor: '#fff',
  },
  nextBtn: { padding: SPACING.md + 2, borderRadius: RADIUS.lg, alignItems: 'center' },
  nextText: { color: '#fff', fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.extrabold },
  // v3.92 — 3 cards chọn quy tắc
  ruleList: { gap: SPACING.sm, marginBottom: SPACING.lg },
  ruleCard: {
    backgroundColor: '#f9fafb',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  ruleHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  ruleRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleName: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: '#111827' },
  ruleSubtitle: { fontSize: FONT_SIZE.caption, color: '#6b7280', marginTop: 2, lineHeight: 16 },
  ruleBadge: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.extrabold, color: '#9ca3af' },
  ruleStats: { flexDirection: 'row', gap: SPACING.sm, paddingLeft: 28, flexWrap: 'wrap' },
  ruleStat: { fontSize: FONT_SIZE.caption, color: '#6b7280' },
  savingsAdjustedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#e0f2fe',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#7dd3fc',
    marginBottom: SPACING.sm,
  },
  savingsAdjustedText: { fontSize: FONT_SIZE.caption, color: '#0c4a6e', fontWeight: FONT_WEIGHT.semibold, flex: 1, lineHeight: 16 },
});
