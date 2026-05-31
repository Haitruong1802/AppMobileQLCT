// F26 — Savings goals: tạo mục tiêu tiết kiệm + tracking + completion.
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import { notify } from '../../src/utils/notify';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { useTheme } from '../../src/store/useTheme';
import { useT } from '../../src/i18n/useT';
import { t } from '../../src/i18n';
import { displayGoalName } from '../../src/i18n/goalName';
import { formatNumber } from '../../src/utils/format';
import { formatDate, todayISO } from '../../src/utils/date';
import {
  getSavingsGoals,
  addSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  addToSavingsGoal,
  SavingsGoal,
} from '../../src/db';
import { DatePickerField } from '../../src/components/DatePickerField';
import { useStore } from '../../src/store/useStore';
import { useSubmitGuard } from '../../src/hooks/useSubmitGuard';
import { canCreate } from '../../src/services/premium';
import { usePremiumTier } from '../../src/store/usePremium';
import { ProUpgradeModal } from '../../src/components/ProUpgradeModal';
import { AutoSavingsSection } from '../../src/components/AutoSavingsSection';

const ICON_CHOICES = ['Gift', 'Wallet', 'Heart', 'Sparkles', 'Bus', 'Home', 'Smartphone', 'Crown', 'BookOpen', 'Shirt'];
const COLOR_CHOICES = ['#10b981', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#dc2626', '#f59e0b', '#0ea5e9'];

interface Draft {
  id?: number;
  name: string;
  target: string;
  deadline: string;
  icon: string;
  color: string;
}

export default function Goals() {
  const router = useRouter();
  useT();
  const palette = useTheme();
  const currentBookId = useStore((s) => s.currentBookId);
  const saveGuard = useSubmitGuard();
  const addGuard = useSubmitGuard();
  const tier = usePremiumTier();
  const [proModalOpen, setProModalOpen] = useState(false);

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [addingTo, setAddingTo] = useState<{ goal: SavingsGoal; amount: string } | null>(null);

  useEffect(() => {
    refresh();
  }, [currentBookId]);

  async function refresh() {
    setGoals(await getSavingsGoals(currentBookId));
  }

  function openCreate() {
    // v3.124 — Free tier 3 mục tiêu, Pro unlimited
    const check = canCreate('goals', goals.length, tier);
    if (!check.allowed) {
      setProModalOpen(true);
      return;
    }
    setEditing({
      name: '',
      target: '',
      deadline: '',
      icon: 'Gift',
      color: palette.primary,
    });
  }

  function openEdit(g: SavingsGoal) {
    setEditing({
      id: g.id,
      name: g.name,
      target: String(g.target),
      deadline: g.deadline || '',
      icon: g.icon,
      color: g.color,
    });
  }

  async function save() {
    if (!editing) return;
    const name = editing.name.trim();
    const target = parseInt(editing.target.replace(/\D/g, ''), 10);
    // v3.134 — Validation chặt hơn
    if (!name) return notify(t('err.goalNameRequired'), 'error');
    if (name.length > 50) return notify(t('err.goalNameTooLong'), 'error');
    if (!target || target <= 0) return notify(t('err.targetRequired'), 'error');
    if (target > 9_999_999_999) return notify(t('err.amountTooLarge'), 'error');
    if (editing.deadline) {
      // v3.146 — Dùng todayISO() local thay vì toISOString() UTC để tránh lệch ngày
      //   khi user ở UTC+7 lúc 6h sáng (UTC còn hôm qua).
      if (editing.deadline < todayISO()) return notify(t('err.deadlinePast'), 'error');
    }
    await saveGuard.run(async () => {
      try {
        if (editing.id) {
          await updateSavingsGoal(editing.id, {
            name,
            target,
            deadline: editing.deadline || null,
            icon: editing.icon,
            color: editing.color,
          });
        } else {
          await addSavingsGoal({
            name,
            target,
            deadline: editing.deadline || undefined,
            icon: editing.icon,
            color: editing.color,
            book_id: currentBookId,
          });
        }
        await refresh();
        setEditing(null);
        notify(editing.id ? t('goals.toastUpdated') : t('goals.toastCreated'), 'success');
      } catch (e: any) {
        notify(t('common.errorPrefix', { msg: e?.message || 'unknown' }), 'error');
      }
    });
  }

  async function doAdd() {
    if (!addingTo) return;
    const amt = parseInt(addingTo.amount.replace(/\D/g, ''), 10);
    if (!amt || amt <= 0) return notify(t('input.err.noAmount'), 'error');
    if (amt > 9_999_999_999) return notify(t('err.amountTooLarge'), 'error');
    await addGuard.run(async () => {
      try {
        const updated = await addToSavingsGoal(addingTo.goal.id, amt);
        await refresh();
        setAddingTo(null);
        if (updated?.completed_at) {
          notify(t('goals.toastReached', { name: displayGoalName(addingTo.goal) }), 'success');
        } else {
          notify(t('goals.toastAdded', { amount: formatNumber(amt), name: displayGoalName(addingTo.goal) }), 'success');
        }
      } catch (e: any) {
        notify(`Lỗi: ${e?.message || 'unknown'}`, 'error');
      }
    });
  }

  async function doDelete(g: SavingsGoal) {
    const goalName = displayGoalName(g);
    const confirmed =
      Platform.OS === 'web'
        ? confirm(t('goals.confirmDelete', { name: goalName }))
        : await new Promise<boolean>((resolve) => {
            Alert.alert(t('common.delete'), t('goals.confirmDelete', { name: goalName }), [
              { text: t('common.cancel'), onPress: () => resolve(false) },
              { text: t('common.delete'), style: 'destructive', onPress: () => resolve(true) },
            ]);
          });
    if (!confirmed) return;
    await deleteSavingsGoal(g.id);
    await refresh();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('goals.title')}</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addTopBtn}>
          <Icon name="Sparkles" size={20} color={palette.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {goals.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="Crown" size={56} color="#d1d5db" />
            <Text style={styles.emptyTitle}>{t('goals.emptyTitle')}</Text>
            <Text style={styles.emptyDesc}>
              Đặt mục tiêu tiết kiệm: iPhone, du lịch, đám cưới... Bux2 giúp bạn theo dõi.
            </Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: palette.primary }]}
              onPress={openCreate}
            >
              <Icon name="Sparkles" size={18} color="#fff" />
              <Text style={styles.addBtnText}>{t('goals.createFirst')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          goals.map((g) => {
            const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
            const completed = !!g.completed_at;
            return (
              <View key={g.id} style={[styles.goalCard, completed && styles.goalDone]}>
                <View style={styles.goalHead}>
                  <View style={[styles.goalIconBox, { backgroundColor: g.color + '20' }]}>
                    <Icon name={g.icon} size={24} color={g.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.goalName} numberOfLines={1}>{displayGoalName(g)}</Text>
                    {g.deadline ? (
                      <Text style={styles.goalDeadline}>
                        {t('goals.deadlineDisplay', { date: formatDate(g.deadline, 'dd/MM/yyyy') })}
                      </Text>
                    ) : null}
                  </View>
                  {completed ? (
                    <View style={[styles.doneBadge, { backgroundColor: g.color }]}>
                      <Icon name="Check" size={14} color="#fff" />
                    </View>
                  ) : null}
                </View>

                <View style={styles.goalAmounts}>
                  <Text style={[styles.goalCurrent, { color: g.color }]}>
                    {formatNumber(g.current)}đ
                  </Text>
                  <Text style={styles.goalTarget}>/ {formatNumber(g.target)}đ</Text>
                </View>

                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${pct}%`, backgroundColor: g.color },
                    ]}
                  />
                </View>
                <Text style={styles.progressLabel}>
                  {t('goals.progressLabel', { pct: pct.toFixed(0), remain: formatNumber(Math.max(0, g.target - g.current)) })}
                </Text>

                {!completed ? (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: g.color }]}
                      onPress={() => setAddingTo({ goal: g, amount: '' })}
                    >
                      <Icon name="TrendingUp" size={16} color="#fff" />
                      <Text style={styles.actionText}>{t('goals.addMoney')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(g)}>
                      <Icon name="Pencil" size={16} color="#6b7280" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editBtn} onPress={() => doDelete(g)}>
                      <Icon name="Trash2" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.delDoneBtn} onPress={() => doDelete(g)}>
                    <Text style={styles.delDoneText}>{t('goals.removeFromList')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        {/* v3.133 — Section "Tự động tiết kiệm" gộp vào màn Mục tiêu tiết kiệm */}
        <AutoSavingsSection
          activeGoalsCount={goals.filter((g) => !g.completed_at).length}
          onLockedTap={() => setProModalOpen(true)}
        />
      </ScrollView>

      {/* Edit / Create modal — v3.82 native iOS pageSheet (pull-down gesture mượt) */}
      <Modal visible={!!editing} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
            <View style={styles.modalCard}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>
                  {editing.id ? t('goals.editTitle') : t('goals.createTitle')}
                </Text>

                <Text style={styles.label}>{t('goals.nameLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={editing.name}
                  onChangeText={(v) => setEditing({ ...editing, name: v })}
                  placeholder={t('goals.namePlaceholder')}
                  placeholderTextColor="#9ca3af"
                  maxLength={50}
                />

                <Text style={styles.label}>{t('goals.targetLabel')}</Text>
                <View style={styles.amountRow}>
                  <TextInput
                    style={styles.amountInput}
                    value={
                      editing.target
                        ? formatNumber(parseInt(editing.target.replace(/\D/g, ''), 10) || 0)
                        : ''
                    }
                    onChangeText={(v) => setEditing({ ...editing, target: v.replace(/\D/g, '') })}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                  />
                  <Text style={styles.currency}>đ</Text>
                </View>

                <Text style={styles.label}>{t('goals.deadlineLabel')}</Text>
                <DatePickerField
                  value={editing.deadline || todayISO()}
                  onChange={(d) => setEditing({ ...editing, deadline: d })}
                  label={t('goals.deadlineShort')}
                />

                <Text style={styles.label}>{t('goals.iconLabel')}</Text>
                <View style={styles.iconRow}>
                  {ICON_CHOICES.map((n) => {
                    const selected = editing.icon === n;
                    return (
                      <TouchableOpacity
                        key={n}
                        style={[
                          styles.iconChoice,
                          selected && { borderColor: editing.color, borderWidth: 2, backgroundColor: editing.color + '15' },
                        ]}
                        onPress={() => setEditing({ ...editing, icon: n })}
                      >
                        <Icon name={n} size={20} color={selected ? editing.color : '#6b7280'} />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>{t('goals.colorLabel')}</Text>
                <View style={styles.colorRow}>
                  {COLOR_CHOICES.map((col) => {
                    const selected = editing.color === col;
                    return (
                      <TouchableOpacity
                        key={col}
                        style={[styles.colorChoice, { backgroundColor: col }, selected && styles.colorSelected]}
                        onPress={() => setEditing({ ...editing, color: col })}
                      >
                        {selected ? <Icon name="Check" size={14} color="#fff" /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)}>
                    <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: palette.primary }]}
                    onPress={save}
                  >
                    <Text style={styles.saveText}>{t('common.save')}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </SafeAreaView>
        ) : (
          <View />
        )}
      </Modal>

      {/* Add amount modal */}
      <Modal visible={!!addingTo} transparent animationType="fade" onRequestClose={() => setAddingTo(null)}>
        {addingTo ? (
          <Pressable style={styles.modalBgCenter} onPress={() => setAddingTo(null)}>
            <Pressable style={styles.modalCardSmall} onPress={() => {}}>
              <Text style={styles.modalTitle}>{t('goals.addToTitle', { name: displayGoalName(addingTo.goal) })}</Text>
              <Text style={styles.label}>{t('goals.amountLabel')}</Text>
              <View style={styles.amountRow}>
                <TextInput
                  style={styles.amountInput}
                  value={
                    addingTo.amount
                      ? formatNumber(parseInt(addingTo.amount.replace(/\D/g, ''), 10) || 0)
                      : ''
                  }
                  onChangeText={(v) => setAddingTo({ ...addingTo, amount: v.replace(/\D/g, '') })}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                  autoFocus
                />
                <Text style={styles.currency}>đ</Text>
              </View>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddingTo(null)}>
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: addingTo.goal.color }]}
                  onPress={doAdd}
                >
                  <Text style={styles.saveText}>{t('goals.addAction')}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        ) : (
          <View />
        )}
      </Modal>
    <ProUpgradeModal visible={proModalOpen} feature="unlimited" onClose={() => setProModalOpen(false)} />
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
  addTopBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  container: { padding: 16, paddingBottom: 32 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  emptyDesc: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 12,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  goalCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  goalDone: { opacity: 0.7 },
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  goalIconBox: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  goalName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  goalDeadline: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  doneBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  goalAmounts: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 6 },
  goalCurrent: { fontSize: 18, fontWeight: '800' },
  goalTarget: { fontSize: 13, color: '#6b7280' },
  progressBg: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { fontSize: 11, color: '#6b7280', marginTop: 6, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 10,
  },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  delDoneBtn: { padding: 8, alignItems: 'center' },
  delDoneText: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBgCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  // v3.101 — pageSheet đã có rounded native iOS, bỏ borderTopRadius + maxHeight legacy
  modalCard: { flex: 1, backgroundColor: '#fff', padding: 20 },
  modalCardSmall: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12, textAlign: 'center' },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 12,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  amountInput: { flex: 1, padding: 12, fontSize: 20, fontWeight: '700', color: '#111827' },
  currency: { fontSize: 16, fontWeight: '700', color: '#6b7280' },
  // v3.101 — Grid căn đều 2 mép (5 cột icons, 8 cột colors)
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  iconChoice: {
    // v3.114 — aspectRatio không work với width % flex-wrap → dùng fixed height 60 (gần vuông với width 18%~63px)
    width: '18%',
    height: 60,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // v3.112 — Fix bug aspectRatio không work với width % trong vài flex-wrap → quay lại fixed 36px tròn
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  colorChoice: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSelected: { borderWidth: 2, borderColor: '#111827' },
  modalBtns: { flexDirection: 'row', gap: 8, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#f3f4f6' },
  cancelText: { color: '#374151', fontWeight: '700', fontSize: 14 },
  saveBtn: { flex: 2, padding: 14, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
