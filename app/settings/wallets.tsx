// F32 — Quản lý ví: CRUD ví + transfer giữa ví.
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
} from 'react-native';
import { notify } from '../../src/utils/notify';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon, ICONS } from '../../src/components/Icon';
import { useStore } from '../../src/store/useStore';
import { useTheme } from '../../src/store/useTheme';
import { useT } from '../../src/i18n/useT';
import { formatNumber } from '../../src/utils/format';
import { todayISO } from '../../src/utils/date';
import { Wallet, getWalletBalance, transferBetweenWallets, setDefaultWallet } from '../../src/db';
import { useSubmitGuard } from '../../src/hooks/useSubmitGuard';
import { canCreate } from '../../src/services/premium';
import { usePremiumTier } from '../../src/store/usePremium';
import { ProUpgradeModal } from '../../src/components/ProUpgradeModal';
import { DatePickerField } from '../../src/components/DatePickerField';

const ICON_CHOICES = ['Wallet', 'Coins', 'Receipt', 'Store', 'Gift', 'Smartphone', 'Heart', 'Home', 'Crown', 'Sparkles'].filter((n) => ICONS[n]);
const COLOR_CHOICES = ['#10b981', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#dc2626', '#f59e0b', '#0ea5e9', '#374151'];

interface Draft {
  id?: number;
  name: string;
  icon: string;
  color: string;
  initial_balance: string;
}

interface TransferDraft {
  fromWalletId: number | null;
  toWalletId: number | null;
  amount: string;
  date: string;
  note: string;
}

export default function WalletsManage() {
  const t = useT();
  const router = useRouter();
  const palette = useTheme();
  const wallets = useStore((s) => s.wallets);
  const loadWallets = useStore((s) => s.loadWallets);
  const loadTransactions = useStore((s) => s.loadTransactions);
  const addWalletAction = useStore((s) => s.addWalletAction);
  const updateWalletAction = useStore((s) => s.updateWalletAction);
  const deleteWalletAction = useStore((s) => s.deleteWalletAction);

  const [balances, setBalances] = useState<Record<number, number>>({});
  const [editing, setEditing] = useState<Draft | null>(null);
  const [transferring, setTransferring] = useState<TransferDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const transferGuard = useSubmitGuard();
  const tier = usePremiumTier();
  const [proModalOpen, setProModalOpen] = useState(false);

  useEffect(() => {
    refreshBalances();
  }, [wallets]);

  async function refreshBalances() {
    const map: Record<number, number> = {};
    for (const w of wallets) {
      try {
        map[w.id] = await getWalletBalance(w.id);
      } catch {
        map[w.id] = 0;
      }
    }
    setBalances(map);
  }

  function openCreate() {
    // v3.124 — Limit check (5 ví free, unlimited Pro)
    const check = canCreate('wallets', wallets.length, tier);
    if (!check.allowed) {
      setProModalOpen(true);
      return;
    }
    setEditing({ name: '', icon: 'Wallet', color: palette.primary, initial_balance: '' });
  }

  function openEdit(w: Wallet) {
    setEditing({
      id: w.id,
      name: w.name,
      icon: w.icon,
      color: w.color,
      initial_balance: String(w.initial_balance),
    });
  }

  async function save() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return notify(t('wallets.err.invalidName'));
    const initBal = parseInt(editing.initial_balance.replace(/\D/g, ''), 10) || 0;
    setSaving(true);
    try {
      if (editing.id) {
        await updateWalletAction(editing.id, {
          name,
          icon: editing.icon,
          color: editing.color,
          initial_balance: initBal,
        });
      } else {
        await addWalletAction({
          name,
          icon: editing.icon,
          color: editing.color,
          initial_balance: initBal,
        });
      }
      await refreshBalances();
      setEditing(null);
    } catch (e: any) {
      notify(`Lỗi: ${e?.message || 'unknown'}`);
    } finally {
      setSaving(false);
    }
  }

  async function doDelete(w: Wallet) {
    if (w.is_default === 1) {
      notify(t('wallets.err.cantDeleteDefault'));
      return;
    }
    const confirmed =
      Platform.OS === 'web'
        ? confirm(`Xoá ví "${w.name}"? Giao dịch sẽ chuyển về ví mặc định.`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(t('common.delete2') + ' ví', `Xoá "${w.name}"? Tất cả giao dịch sẽ chuyển về ví mặc định.`, [
              { text: t('common.cancel'), onPress: () => resolve(false) },
              { text: t('common.delete2'), style: 'destructive', onPress: () => resolve(true) },
            ]);
          });
    if (!confirmed) return;
    try {
      const res = await deleteWalletAction(w.id);
      notify(res.reassigned > 0 ? t('wallets.deletedReassign', { n: res.reassigned }) : t('wallets.deleted'));
    } catch (e: any) {
      notify(`Lỗi: ${e?.message || 'unknown'}`);
    }
  }

  function openTransfer() {
    if (wallets.length < 2) {
      notify(t('wallets.err.needTwoWallets'));
      return;
    }
    setTransferring({
      fromWalletId: wallets[0].id,
      toWalletId: wallets[1].id,
      amount: '',
      date: todayISO(),
      note: '',
    });
  }

  async function doTransfer() {
    if (!transferring) return;
    if (!transferring.fromWalletId || !transferring.toWalletId) return notify(t('wallets.err.bothWallets'));
    if (transferring.fromWalletId === transferring.toWalletId) return notify(t('wallets.err.diffWallets'));
    const amt = parseInt(transferring.amount.replace(/\D/g, ''), 10);
    if (!amt || amt <= 0) return notify(t('wallets.err.invalidAmount'));
    await transferGuard.run(async () => {
      try {
        await transferBetweenWallets({
          fromWalletId: transferring.fromWalletId!,
          toWalletId: transferring.toWalletId!,
          amount: amt,
          date: transferring.date,
          note: transferring.note,
        });
        await loadTransactions();
        await refreshBalances();
        setTransferring(null);
        notify(t('wallets.transferred'));
      } catch (e: any) {
        notify(`Lỗi: ${e?.message || 'unknown'}`);
      }
    });
  }

  const totalBalance = wallets.reduce((s, w) => s + (balances[w.id] || 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('wallets.title')}</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addTopBtn}>
          <Icon name="Sparkles" size={20} color={palette.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Total balance card */}
        <View style={[styles.totalCard, { backgroundColor: palette.primary }]}>
          <Text style={styles.totalLabel}>{t('wallets.total')}</Text>
          <Text style={styles.totalValue}>{formatNumber(totalBalance)}đ</Text>
          <Text style={styles.totalSub}>
            {t('wallets.totalSub', { n: wallets.length })}
          </Text>
        </View>

        {/* Wallet list */}
        {wallets.map((w) => {
          const bal = balances[w.id] || 0;
          return (
            <TouchableOpacity key={w.id} style={styles.walletItem} onPress={() => openEdit(w)}>
              <View style={[styles.walletIcon, { backgroundColor: w.color + '20' }]}>
                <Icon name={w.icon} size={22} color={w.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletName} numberOfLines={1}>
                  {w.name}
                  {w.is_default === 1 ? <Text style={styles.defaultTag}> · {t('wallets.defaultTag')}</Text> : null}
                </Text>
                <Text style={[styles.walletBalance, { color: bal >= 0 ? '#111827' : '#dc2626' }]}>
                  {formatNumber(bal)}đ
                </Text>
              </View>
              {w.is_default === 0 ? (
                <>
                  {/* v3.64 — H3: Đặt làm mặc định */}
                  <TouchableOpacity
                    onPress={async () => {
                      await setDefaultWallet(w.id);
                      await loadWallets();
                    }}
                    style={styles.actionBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon name="Crown" size={18} color={palette.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => doDelete(w)}
                    style={styles.actionBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon name="Trash2" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </>
              ) : null}
            </TouchableOpacity>
          );
        })}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBig, { backgroundColor: palette.primary }]}
            onPress={openCreate}
          >
            <Icon name="Sparkles" size={18} color="#fff" />
            <Text style={styles.actionBigText}>{t('wallets.addBtn')}</Text>
          </TouchableOpacity>
          {wallets.length >= 2 ? (
            <TouchableOpacity
              style={[styles.actionBig, { backgroundColor: palette.primaryDark }]}
              onPress={openTransfer}
            >
              <Icon name="Bus" size={18} color="#fff" />
              <Text style={styles.actionBigText}>{t('wallets.transferBtn')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      {/* Edit / Create modal — v3.82 native iOS pageSheet (pull-down gesture mượt) */}
      <Modal visible={!!editing} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
            <View style={styles.modalCard}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>{editing.id ? t('wallets.editTitle') : t('wallets.createTitle')}</Text>

                <Text style={styles.label}>{t('wallets.nameLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={editing.name}
                  onChangeText={(v) => setEditing({ ...editing, name: v })}
                  placeholder={t('wallets.namePlaceholder')}
                  placeholderTextColor="#9ca3af"
                  maxLength={30}
                />

                <Text style={styles.label}>{t('wallets.balanceLabel')}</Text>
                <View style={styles.amountRow}>
                  <TextInput
                    style={styles.amountInput}
                    value={
                      editing.initial_balance
                        ? formatNumber(parseInt(editing.initial_balance.replace(/\D/g, ''), 10) || 0)
                        : ''
                    }
                    onChangeText={(v) => setEditing({ ...editing, initial_balance: v.replace(/\D/g, '') })}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                  />
                  <Text style={styles.currency}>đ</Text>
                </View>

                <Text style={styles.label}>{t('wallets.iconLabel')}</Text>
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

                <Text style={styles.label}>{t('wallets.colorLabel')}</Text>
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
                    style={[styles.saveBtn, { backgroundColor: palette.primary }, saving && { opacity: 0.6 }]}
                    onPress={save}
                    disabled={saving}
                  >
                    <Text style={styles.saveText}>{saving ? `${t('common.loading').replace('...', '')}...` : t('common.save')}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </SafeAreaView>
        ) : (
          <View />
        )}
      </Modal>

      {/* Transfer modal — v3.100 native iOS pageSheet (pull-down gesture mượt) */}
      <Modal visible={!!transferring} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setTransferring(null)}>
        {transferring ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
            <View style={styles.modalCard}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>{t('wallets.transferTitle')}</Text>

                <Text style={styles.label}>{t('wallets.fromWallet')}</Text>
                <View style={styles.walletGrid}>
                  {wallets.map((w) => {
                    const selected = transferring.fromWalletId === w.id;
                    return (
                      <TouchableOpacity
                        key={w.id}
                        style={[
                          styles.walletPick,
                          selected && { borderColor: w.color, borderWidth: 2, backgroundColor: w.color + '15' },
                        ]}
                        onPress={() => setTransferring({ ...transferring, fromWalletId: w.id })}
                      >
                        <Icon name={w.icon} size={18} color={w.color} />
                        <Text style={styles.walletPickName} numberOfLines={1}>
                          {w.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>{t('wallets.toWallet')}</Text>
                <View style={styles.walletGrid}>
                  {wallets.map((w) => {
                    const selected = transferring.toWalletId === w.id;
                    return (
                      <TouchableOpacity
                        key={w.id}
                        style={[
                          styles.walletPick,
                          selected && { borderColor: w.color, borderWidth: 2, backgroundColor: w.color + '15' },
                        ]}
                        onPress={() => setTransferring({ ...transferring, toWalletId: w.id })}
                      >
                        <Icon name={w.icon} size={18} color={w.color} />
                        <Text style={styles.walletPickName} numberOfLines={1}>
                          {w.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>{t('wallets.amount')}</Text>
                <View style={styles.amountRow}>
                  <TextInput
                    style={styles.amountInput}
                    value={
                      transferring.amount
                        ? formatNumber(parseInt(transferring.amount.replace(/\D/g, ''), 10) || 0)
                        : ''
                    }
                    onChangeText={(v) => setTransferring({ ...transferring, amount: v.replace(/\D/g, '') })}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                  />
                  <Text style={styles.currency}>đ</Text>
                </View>

                <Text style={styles.label}>{t('wallets.date')}</Text>
                <DatePickerField
                  value={transferring.date}
                  onChange={(d) => setTransferring({ ...transferring, date: d })}
                  label={t('wallets.date')}
                  maxDate={todayISO()}
                  todayISO={todayISO()}
                />

                <Text style={styles.label}>{t('wallets.noteOpt')}</Text>
                <TextInput
                  style={styles.input}
                  value={transferring.note}
                  onChangeText={(v) => setTransferring({ ...transferring, note: v })}
                  placeholder={t('wallets.notePlaceholder')}
                  placeholderTextColor="#9ca3af"
                  maxLength={100}
                />

                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setTransferring(null)}>
                    <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: palette.primary }]}
                    onPress={doTransfer}
                  >
                    <Text style={styles.saveText}>{t('wallets.transferConfirm')}</Text>
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
  totalCard: { borderRadius: 14, padding: 16, marginBottom: 16 },
  totalLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  totalValue: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 4 },
  totalSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  walletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  walletIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  walletName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  defaultTag: { fontSize: 11, color: '#9ca3af', fontWeight: '400' },
  walletBalance: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  actionBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBig: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 12,
  },
  actionBigText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // v3.101 — pageSheet đã có rounded native iOS, bỏ legacy
  modalCard: { flex: 1, backgroundColor: '#fff', padding: 20 },
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
  // v3.101 — Grid căn đều 2 mép (4 cột icons, 9 cột colors compact)
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  iconChoice: {
    // v3.118 — giống Tạo mục tiêu: 5 cột width 18% height 60
    width: '18%',
    height: 60,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  // v3.112 — Fix bug aspectRatio không work với width % → fixed 36px tròn
  colorChoice: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSelected: { borderWidth: 2, borderColor: '#111827' },
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
