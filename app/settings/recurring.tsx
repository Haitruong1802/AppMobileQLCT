// F24 — Quản lý giao dịch lặp (recurring rules).
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
  Switch,
} from 'react-native';
import { notify } from '../../src/utils/notify';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { useStore } from '../../src/store/useStore';
import { useTheme } from '../../src/store/useTheme';
import {
  getRecurringRules,
  addRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
  RecurringRule,
  Frequency,
} from '../../src/db';
import { frequencyLabel } from '../../src/services/recurring';
import { formatNumber } from '../../src/utils/format';
import { useT } from '../../src/i18n/useT';
import { t } from '../../src/i18n';
import { displayCategoryName } from '../../src/i18n/categoryName';
import { canCreate } from '../../src/services/premium';
import { usePremiumTier } from '../../src/store/usePremium';
import { ProUpgradeModal } from '../../src/components/ProUpgradeModal';
import { todayISO, formatDate } from '../../src/utils/date';
import { DatePickerField } from '../../src/components/DatePickerField';

const FREQ_OPTIONS: Frequency[] = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

interface Draft {
  id?: number;
  amount: string;
  category_id: number | null;
  type: 'expense' | 'income';
  note: string;
  frequency: Frequency;
  next_run: string;
  active: boolean;
}

export default function RecurringManage() {
  useT();
  const router = useRouter();
  const palette = useTheme();
  const categories = useStore((s) => s.categories);
  const currentBookId = useStore((s) => s.currentBookId);
  const tier = usePremiumTier();
  const [proModalOpen, setProModalOpen] = useState(false);

  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refresh();
  }, [currentBookId]);

  async function refresh() {
    setRules(await getRecurringRules(currentBookId));
  }

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  function openCreate() {
    // v3.124 — Free tier 3 rule, Pro unlimited
    const check = canCreate('recurring', rules.length, tier);
    if (!check.allowed) {
      setProModalOpen(true);
      return;
    }
    setEditing({
      amount: '',
      category_id: categories.find((c) => c.type === 'expense')?.id ?? null,
      type: 'expense',
      note: '',
      frequency: 'monthly',
      next_run: todayISO(),
      active: true,
    });
  }

  function openEdit(r: RecurringRule) {
    setEditing({
      id: r.id,
      amount: String(r.amount),
      category_id: r.category_id,
      type: r.type,
      note: r.note ?? '',
      frequency: r.frequency,
      next_run: r.next_run,
      active: r.active === 1,
    });
  }

  async function save() {
    if (!editing) return;
    const amt = parseInt(editing.amount.replace(/\D/g, ''), 10);
    if (!amt || amt <= 0) return notify('Nhập số tiền');
    if (!editing.category_id) return notify('Chọn danh mục');
    setSaving(true);
    try {
      if (editing.id) {
        await updateRecurringRule(editing.id, {
          amount: amt,
          category_id: editing.category_id,
          type: editing.type,
          note: editing.note.slice(0, 200),
          frequency: editing.frequency,
          next_run: editing.next_run,
          active: editing.active ? 1 : 0,
        });
      } else {
        await addRecurringRule({
          amount: amt,
          category_id: editing.category_id,
          type: editing.type,
          note: editing.note.slice(0, 200),
          frequency: editing.frequency,
          next_run: editing.next_run,
          book_id: currentBookId,
        });
      }
      await refresh();
      setEditing(null);
    } catch (e: any) {
      notify(`Lỗi: ${e?.message || 'unknown'}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(r: RecurringRule) {
    await updateRecurringRule(r.id, { active: r.active ? 0 : 1 });
    await refresh();
  }

  async function doDelete(r: RecurringRule) {
    const confirmed =
      Platform.OS === 'web'
        ? confirm('Xoá quy tắc lặp này?')
        : await new Promise<boolean>((resolve) => {
            Alert.alert('Xoá', 'Xoá quy tắc lặp? Các giao dịch đã tạo vẫn giữ lại.', [
              { text: 'Huỷ', onPress: () => resolve(false) },
              { text: 'Xoá', style: 'destructive', onPress: () => resolve(true) },
            ]);
          });
    if (!confirmed) return;
    await deleteRecurringRule(r.id);
    await refresh();
  }

  const filteredCats = editing
    ? categories.filter((c) => c.type === editing.type)
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('more.recurring')}</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addTopBtn}>
          <Icon name="Sparkles" size={20} color={palette.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {rules.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="CalendarDays" size={56} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Chưa có giao dịch lặp</Text>
            <Text style={styles.emptyDesc}>
              Tạo quy tắc tự động ghi: lương hàng tháng, tiền nhà, gói data...
            </Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: palette.primary }]}
              onPress={openCreate}
            >
              <Icon name="Sparkles" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Tạo quy tắc đầu tiên</Text>
            </TouchableOpacity>
          </View>
        ) : (
          rules.map((r) => {
            const c = catMap[r.category_id];
            const inactive = r.active === 0;
            return (
              <View key={r.id} style={[styles.ruleItem, inactive && { opacity: 0.5 }]}>
                <View style={[styles.iconBox, { backgroundColor: (c?.color || '#6b7280') + '20' }]}>
                  <Icon name={c?.icon || 'MoreHorizontal'} size={20} color={c?.color || '#6b7280'} />
                </View>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => openEdit(r)}>
                  <Text style={styles.ruleName} numberOfLines={1}>
                    {r.note || (c ? displayCategoryName(c) : '-')}
                  </Text>
                  <Text style={styles.ruleDetail}>
                    {r.type === 'expense' ? '-' : '+'}
                    {formatNumber(r.amount)}đ · {frequencyLabel(r.frequency)}
                  </Text>
                  <Text style={styles.ruleNext}>Kế tiếp: {formatDate(r.next_run, 'dd/MM/yyyy')}</Text>
                </TouchableOpacity>
                <Switch
                  value={r.active === 1}
                  onValueChange={() => toggleActive(r)}
                  trackColor={{ true: palette.primary, false: '#d1d5db' }}
                />
                <TouchableOpacity onPress={() => doDelete(r)} style={styles.actionBtn}>
                  <Icon name="Trash2" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!editing} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
            <View style={styles.modalCard}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>
                  {editing.id ? 'Sửa quy tắc' : 'Tạo quy tắc lặp'}
                </Text>

                <View style={styles.typeTabs}>
                  <TouchableOpacity
                    style={[styles.typeTab, editing.type === 'expense' && styles.typeTabActive]}
                    onPress={() => {
                      const firstCat = categories.find((c) => c.type === 'expense');
                      setEditing({ ...editing, type: 'expense', category_id: firstCat?.id ?? null });
                    }}
                  >
                    <Text style={[styles.typeText, editing.type === 'expense' && styles.typeTextActive]}>
                      Chi
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeTab, editing.type === 'income' && styles.typeTabActive]}
                    onPress={() => {
                      const firstCat = categories.find((c) => c.type === 'income');
                      setEditing({ ...editing, type: 'income', category_id: firstCat?.id ?? null });
                    }}
                  >
                    <Text style={[styles.typeText, editing.type === 'income' && styles.typeTextActive]}>
                      Thu
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Số tiền</Text>
                <View style={styles.amountRow}>
                  <TextInput
                    style={styles.amountInput}
                    value={
                      editing.amount
                        ? formatNumber(parseInt(editing.amount.replace(/\D/g, ''), 10) || 0)
                        : ''
                    }
                    onChangeText={(v) => setEditing({ ...editing, amount: v.replace(/\D/g, '') })}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                  />
                  <Text style={styles.currency}>đ</Text>
                </View>

                <Text style={styles.label}>Ghi chú</Text>
                <TextInput
                  style={styles.input}
                  value={editing.note}
                  onChangeText={(v) => setEditing({ ...editing, note: v })}
                  placeholder="VD: Lương tháng, Tiền nhà..."
                  placeholderTextColor="#9ca3af"
                  maxLength={200}
                />

                <Text style={styles.label}>Danh mục</Text>
                <View style={styles.catGrid}>
                  {filteredCats.map((c) => {
                    const selected = editing.category_id === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.catItem,
                          selected && { borderColor: c.color, borderWidth: 2, backgroundColor: c.color + '15' },
                        ]}
                        onPress={() => setEditing({ ...editing, category_id: c.id })}
                      >
                        <View style={[styles.catIconBox, { backgroundColor: c.color + '20' }]}>
                          <Icon name={c.icon} size={18} color={c.color} />
                        </View>
                        <Text style={styles.catName} numberOfLines={1}>
                          {displayCategoryName(c)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Tần suất</Text>
                <View style={styles.freqWrap}>
                  {FREQ_OPTIONS.map((f) => {
                    const selected = editing.frequency === f;
                    return (
                      <TouchableOpacity
                        key={f}
                        style={[
                          styles.freqItem,
                          selected && { backgroundColor: palette.primary, borderColor: palette.primary },
                        ]}
                        onPress={() => setEditing({ ...editing, frequency: f })}
                      >
                        <Text
                          style={[
                            styles.freqText,
                            selected && { color: '#fff', fontWeight: '700' },
                          ]}
                        >
                          {frequencyLabel(f)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Ngày bắt đầu / Lần kế tiếp</Text>
                <DatePickerField
                  value={editing.next_run}
                  onChange={(d) => setEditing({ ...editing, next_run: d })}
                  label=""
                />

                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)}>
                    <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: palette.primary }, saving && { opacity: 0.6 }]}
                    onPress={save}
                    disabled={saving}
                  >
                    <Text style={styles.saveText}>{saving ? 'Đang lưu...' : 'Lưu'}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </SafeAreaView>
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
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 8,
    gap: 10,
  },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ruleName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  ruleDetail: { fontSize: 12, color: '#374151', marginTop: 2 },
  ruleNext: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  actionBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalCard: { flex: 1, backgroundColor: '#fff', padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12, textAlign: 'center' },
  typeTabs: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  typeTab: { flex: 1, padding: 8, borderRadius: 10, alignItems: 'center' },
  typeTabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  typeText: { color: '#6b7280', fontWeight: '600', fontSize: 13 },
  typeTextActive: { color: '#111827' },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 12,
    letterSpacing: 0.5,
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
  amountInput: { flex: 1, padding: 12, fontSize: 18, fontWeight: '700', color: '#111827' },
  currency: { fontSize: 16, fontWeight: '700', color: '#6b7280' },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catItem: {
    width: '31%',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 70,
    justifyContent: 'center',
  },
  catIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  catName: { fontSize: 10, color: '#374151', textAlign: 'center', fontWeight: '600' },
  freqWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  freqItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  freqText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: 8, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#f3f4f6' },
  cancelText: { color: '#374151', fontWeight: '700', fontSize: 14 },
  saveBtn: { flex: 2, padding: 14, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
