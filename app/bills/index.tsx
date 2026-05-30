// F54 — Bill reminder: hoá đơn sắp đến hạn + auto pay.
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
import { useStore } from '../../src/store/useStore';
import { useTheme } from '../../src/store/useTheme';
import { formatNumber } from '../../src/utils/format';
import { formatDate, todayISO } from '../../src/utils/date';
import {
  getBills,
  addBill,
  updateBill,
  deleteBill,
  payBill,
  Bill,
} from '../../src/db';
import { DatePickerField } from '../../src/components/DatePickerField';
import { useT } from '../../src/i18n/useT';
import { t } from '../../src/i18n';
import { displayCategoryName } from '../../src/i18n/categoryName';
import { canCreate } from '../../src/services/premium';
import { usePremiumTier } from '../../src/store/usePremium';
import { ProUpgradeModal } from '../../src/components/ProUpgradeModal';

const REPEAT_OPTIONS: { value: Bill['repeat_period']; labelKey: string }[] = [
  { value: null, labelKey: 'bills.repeatNone' },
  { value: 'monthly', labelKey: 'bills.repeatMonthly' },
  { value: 'quarterly', labelKey: 'bills.repeatQuarterly' },
  { value: 'yearly', labelKey: 'bills.repeatYearly' },
];

interface Draft {
  id?: number;
  name: string;
  amount: string;
  due_date: string;
  category_id: number | null;
  repeat_period: Bill['repeat_period'];
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export default function BillsManage() {
  useT();
  const router = useRouter();
  const palette = useTheme();
  const categories = useStore((s) => s.categories);
  const wallets = useStore((s) => s.wallets);
  const loadTransactions = useStore((s) => s.loadTransactions);
  const currentBookId = useStore((s) => s.currentBookId);
  const tier = usePremiumTier();
  const [proModalOpen, setProModalOpen] = useState(false);

  const [bills, setBills] = useState<Bill[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [paying, setPaying] = useState<{ bill: Bill; walletId: number | null } | null>(null);
  const [filter, setFilter] = useState<'unpaid' | 'paid'>('unpaid'); // v3.64 — H5

  useEffect(() => {
    refresh();
  }, [currentBookId]);

  async function refresh() {
    setBills(await getBills(currentBookId));
  }

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  function openCreate() {
    // v3.124 — Free tier 3 hoá đơn, Pro unlimited
    const check = canCreate('bills', bills.length, tier);
    if (!check.allowed) {
      setProModalOpen(true);
      return;
    }
    setEditing({
      name: '',
      amount: '',
      due_date: todayISO(),
      category_id: null,
      repeat_period: 'monthly',
    });
  }

  function openEdit(b: Bill) {
    setEditing({
      id: b.id,
      name: b.name,
      amount: String(b.amount),
      due_date: b.due_date,
      category_id: b.category_id,
      repeat_period: b.repeat_period,
    });
  }

  async function save() {
    if (!editing) return;
    const amt = parseInt(editing.amount.replace(/\D/g, ''), 10);
    if (!editing.name.trim()) return notify('Nhập tên hoá đơn');
    if (!amt || amt <= 0) return notify('Nhập số tiền');
    try {
      if (editing.id) {
        await updateBill(editing.id, {
          name: editing.name.trim(),
          amount: amt,
          due_date: editing.due_date,
          category_id: editing.category_id,
          repeat_period: editing.repeat_period,
        });
      } else {
        await addBill({
          name: editing.name.trim(),
          amount: amt,
          due_date: editing.due_date,
          category_id: editing.category_id ?? undefined,
          repeat_period: editing.repeat_period ?? undefined,
          book_id: currentBookId,
        });
      }
      await refresh();
      setEditing(null);
    } catch (e: any) {
      notify(`Lỗi: ${e?.message || 'unknown'}`);
    }
  }

  function startPay(b: Bill) {
    const def = wallets.find((w) => w.is_default === 1) || wallets[0];
    if (!def) {
      notify('Không có ví');
      return;
    }
    setPaying({ bill: b, walletId: def.id });
  }

  async function doPay() {
    if (!paying || !paying.walletId) return;
    try {
      await payBill(paying.bill.id, paying.walletId);
      await refresh();
      await loadTransactions();
      setPaying(null);
      notify(`Đã thanh toán "${paying.bill.name}"`);
    } catch (e: any) {
      notify(`Lỗi: ${e?.message || 'unknown'}`);
    }
  }

  async function doDelete(b: Bill) {
    const confirmed =
      Platform.OS === 'web'
        ? confirm(`Xoá hoá đơn "${b.name}"?`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert('Xoá', `Xoá hoá đơn "${b.name}"?`, [
              { text: 'Huỷ', onPress: () => resolve(false) },
              { text: 'Xoá', style: 'destructive', onPress: () => resolve(true) },
            ]);
          });
    if (!confirmed) return;
    await deleteBill(b.id);
    await refresh();
  }

  const expenseCats = categories.filter((c) => c.type === 'expense');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('bills.title')}</Text>
        <TouchableOpacity onPress={openCreate} style={styles.backBtn}>
          <Icon name="Sparkles" size={20} color={palette.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {bills.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="Bell" size={56} color="#d1d5db" />
            <Text style={styles.emptyTitle}>{t('bills.emptyTitle')}</Text>
            <Text style={styles.emptyDesc}>{t('bills.emptyDesc')}</Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: palette.primary }]}
              onPress={openCreate}
            >
              <Icon name="Sparkles" size={18} color="#fff" />
              <Text style={styles.addBtnText}>{t('bills.addFirst')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* v3.64 — H5: Filter paid/unpaid */}
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterTab, filter === 'unpaid' && styles.filterTabActive]}
                onPress={() => setFilter('unpaid')}
              >
                <Text style={[styles.filterText, filter === 'unpaid' && styles.filterTextActive]}>
                  Chưa trả ({bills.filter((b) => !b.paid_at).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, filter === 'paid' && styles.filterTabActive]}
                onPress={() => setFilter('paid')}
              >
                <Text style={[styles.filterText, filter === 'paid' && styles.filterTextActive]}>
                  Đã trả ({bills.filter((b) => !!b.paid_at).length})
                </Text>
              </TouchableOpacity>
            </View>
            {bills.filter((b) => (filter === 'paid' ? !!b.paid_at : !b.paid_at)).map((b) => {
            const days = daysUntil(b.due_date);
            const isOverdue = days < 0 && !b.paid_at;
            const isToday = days === 0 && !b.paid_at;
            const isSoon = days > 0 && days <= 3 && !b.paid_at;
            const isPaid = !!b.paid_at;
            const c = b.category_id ? catMap[b.category_id] : null;

            let statusLabel = '';
            let statusColor = '#6b7280';
            if (isPaid) {
              statusLabel = 'Đã thanh toán';
              statusColor = palette.income;
            } else if (isOverdue) {
              statusLabel = `Quá hạn ${Math.abs(days)} ngày`;
              statusColor = palette.expense;
            } else if (isToday) {
              statusLabel = 'Đến hạn hôm nay';
              statusColor = '#f59e0b';
            } else if (isSoon) {
              statusLabel = `Còn ${days} ngày`;
              statusColor = '#f59e0b';
            } else {
              statusLabel = `Còn ${days} ngày`;
              statusColor = '#6b7280';
            }

            return (
              <View key={b.id} style={[styles.billCard, isPaid && { opacity: 0.6 }]}>
                <View style={styles.billHead}>
                  <View style={[styles.billIcon, { backgroundColor: (c?.color || palette.primary) + '20' }]}>
                    <Icon name={c?.icon || 'Receipt'} size={20} color={c?.color || palette.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.billName}>{b.name}</Text>
                    <Text style={styles.billDate}>
                      {formatDate(b.due_date, 'EEEE, dd/MM/yyyy')}
                      {b.repeat_period
                        ? ` · ${
                            b.repeat_period === 'monthly'
                              ? t('bills.repeatMonthly').toLowerCase()
                              : b.repeat_period === 'quarterly'
                              ? t('bills.repeatQuarterly')
                              : t('bills.repeatYearly').toLowerCase()
                          }`
                        : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => doDelete(b)} style={styles.actionBtn}>
                    <Icon name="Trash2" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                <View style={styles.billBody}>
                  <Text style={[styles.billAmount, { color: palette.expense }]}>
                    {formatNumber(b.amount)}đ
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>

                {!isPaid ? (
                  <View style={styles.billActions}>
                    <TouchableOpacity
                      style={[styles.payBtn, { backgroundColor: palette.primary }]}
                      onPress={() => startPay(b)}
                    >
                      <Icon name="Check" size={14} color="#fff" />
                      <Text style={styles.payBtnText}>{t('bills.pay')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editBtnSmall} onPress={() => openEdit(b)}>
                      <Icon name="Pencil" size={14} color="#6b7280" />
                      <Text style={styles.editBtnText}>{t('bills.editAction')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}
          </>
        )}
      </ScrollView>

      {/* Edit / Create modal — v3.82 native iOS pageSheet (pull-down gesture mượt) */}
      <Modal visible={!!editing} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
            <View style={styles.modalCard}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>
                  {editing.id ? t('bills.edit') : t('bills.add')}
                </Text>

                <Text style={styles.label}>{t('bills.nameLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={editing.name}
                  onChangeText={(v) => setEditing({ ...editing, name: v })}
                  placeholder={t('bills.namePlaceholder')}
                  placeholderTextColor="#9ca3af"
                  maxLength={50}
                />

                <Text style={styles.label}>{t('bills.amountLabel')}</Text>
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

                <Text style={styles.label}>{t('bills.dueDateLabel')}</Text>
                <DatePickerField
                  value={editing.due_date}
                  onChange={(d) => setEditing({ ...editing, due_date: d })}
                  label={t('bills.dueShort')}
                />

                <Text style={styles.label}>{t('bills.repeatLabel')}</Text>
                <View style={styles.repeatRow}>
                  {REPEAT_OPTIONS.map((opt) => {
                    const selected = editing.repeat_period === opt.value;
                    return (
                      <TouchableOpacity
                        key={String(opt.value)}
                        style={[
                          styles.repeatItem,
                          selected && { backgroundColor: palette.primary, borderColor: palette.primary },
                        ]}
                        onPress={() => setEditing({ ...editing, repeat_period: opt.value })}
                      >
                        <Text
                          style={[
                            styles.repeatText,
                            selected && { color: '#fff', fontWeight: '700' },
                          ]}
                        >
                          {t(opt.labelKey)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>{t('bills.categoryLabel')}</Text>
                <View style={styles.catGrid}>
                  <TouchableOpacity
                    style={[
                      styles.catItem,
                      editing.category_id === null && { borderColor: palette.primary, borderWidth: 2, backgroundColor: palette.primaryLight },
                    ]}
                    onPress={() => setEditing({ ...editing, category_id: null })}
                  >
                    <View style={[styles.catIconBox, { backgroundColor: '#f3f4f6' }]}>
                      <Icon name="MoreHorizontal" size={18} color="#6b7280" />
                    </View>
                    <Text style={styles.catName}>{t('bills.autoCat')}</Text>
                  </TouchableOpacity>
                  {expenseCats.slice(0, 8).map((c) => {
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

      {/* Pay modal */}
      <Modal visible={!!paying} transparent animationType="fade" onRequestClose={() => setPaying(null)}>
        {paying ? (
          <Pressable style={styles.modalBgCenter} onPress={() => setPaying(null)}>
            <Pressable style={styles.modalCardSmall} onPress={() => {}}>
              <Text style={styles.modalTitle}>Thanh toán "{paying.bill.name}"</Text>
              <Text style={styles.payHint}>
                Sẽ tạo giao dịch chi {formatNumber(paying.bill.amount)}đ vào ví bên dưới.
              </Text>

              <Text style={styles.label}>{t('bills.deductWallet')}</Text>
              <View style={styles.walletGrid}>
                {wallets.map((w) => {
                  const selected = paying.walletId === w.id;
                  return (
                    <TouchableOpacity
                      key={w.id}
                      style={[
                        styles.walletPick,
                        selected && { borderColor: w.color, borderWidth: 2, backgroundColor: w.color + '15' },
                      ]}
                      onPress={() => setPaying({ ...paying, walletId: w.id })}
                    >
                      <Icon name={w.icon} size={16} color={w.color} />
                      <Text style={styles.walletPickName} numberOfLines={1}>
                        {w.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setPaying(null)}>
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: palette.primary }]}
                  onPress={doPay}
                >
                  <Text style={styles.saveText}>{t('common.confirm')}</Text>
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
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  filterTab: { flex: 1, padding: 8, borderRadius: 8, alignItems: 'center' },
  filterTabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  filterTextActive: { color: '#111827', fontWeight: '700' },
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
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  emptyDesc: { fontSize: 13, color: '#6b7280', textAlign: 'center', maxWidth: 280, lineHeight: 18 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, marginTop: 12 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  billCard: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 12 },
  billHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  billIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  billName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  billDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  actionBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  billBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  billAmount: { fontSize: 18, fontWeight: '800' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  billActions: { flexDirection: 'row', gap: 8 },
  payBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 8,
  },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  editBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBgCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  // v3.101 — pageSheet đã có rounded native iOS, bỏ legacy
  modalCard: { flex: 1, backgroundColor: '#fff', padding: 20 },
  modalCardSmall: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 360 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12, textAlign: 'center' },
  payHint: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: 6, marginTop: 12, letterSpacing: 0.5 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 15, color: '#111827' },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12 },
  amountInput: { flex: 1, padding: 12, fontSize: 20, fontWeight: '700', color: '#111827' },
  currency: { fontSize: 16, fontWeight: '700', color: '#6b7280' },
  repeatRow: { flexDirection: 'row', gap: 6 },
  repeatItem: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', alignItems: 'center' },
  repeatText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 },
  catItem: { width: '32%', backgroundColor: '#f9fafb', borderRadius: 10, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', minHeight: 70, justifyContent: 'center' },
  catIconBox: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  catName: { fontSize: 10, color: '#374151', textAlign: 'center', fontWeight: '600' },
  walletGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  walletPick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    minWidth: '30%',
  },
  walletPickName: { fontSize: 12, color: '#374151', fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: 8, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#f3f4f6' },
  cancelText: { color: '#374151', fontWeight: '700', fontSize: 14 },
  saveBtn: { flex: 2, padding: 14, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
