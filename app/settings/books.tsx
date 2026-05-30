// F58 — Quản lý sổ kế toán (multi-book / multi-ledger).
import { useState } from 'react';
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
import { Book } from '../../src/db';
import { canCreate } from '../../src/services/premium';
import { usePremiumTier } from '../../src/store/usePremium';
import { ProUpgradeModal } from '../../src/components/ProUpgradeModal';

const ICON_CHOICES = ['Wallet', 'Home', 'Heart', 'Crown', 'Gift', 'Sparkles', 'Receipt', 'Bus', 'Store', 'BookOpen']
  .filter((n) => ICONS[n]);
const COLOR_CHOICES = ['#10b981', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#dc2626', '#f59e0b', '#0ea5e9', '#374151'];

interface Draft {
  id?: number;
  name: string;
  icon: string;
  color: string;
}

export default function BooksManage() {
  const t = useT();
  const router = useRouter();
  const palette = useTheme();
  const books = useStore((s) => s.books);
  const currentBookId = useStore((s) => s.currentBookId);
  const addBookAction = useStore((s) => s.addBookAction);
  const updateBookAction = useStore((s) => s.updateBookAction);
  const deleteBookAction = useStore((s) => s.deleteBookAction);
  const setCurrentBookId = useStore((s) => s.setCurrentBookId);
  const tier = usePremiumTier();

  const [editing, setEditing] = useState<Draft | null>(null);
  const [proModalOpen, setProModalOpen] = useState(false);

  function openCreate() {
    // v3.131 — Free reach limit → mở modal upgrade (không redirect ngay)
    const check = canCreate('books', books.length, tier);
    if (!check.allowed) {
      setProModalOpen(true);
      return;
    }
    setEditing({ name: '', icon: 'Wallet', color: palette.primary });
  }

  function openEdit(b: Book) {
    setEditing({ id: b.id, name: b.name, icon: b.icon, color: b.color });
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) return notify(t('books.err.invalidName'));
    try {
      if (editing.id) {
        await updateBookAction(editing.id, {
          name: editing.name.trim(),
          icon: editing.icon,
          color: editing.color,
        });
      } else {
        await addBookAction({
          name: editing.name.trim(),
          icon: editing.icon,
          color: editing.color,
        });
      }
      setEditing(null);
    } catch (e: any) {
      notify(`Lỗi: ${e?.message || 'unknown'}`);
    }
  }

  async function doSwitch(b: Book) {
    if (b.id === currentBookId) return;
    await setCurrentBookId(b.id);
    notify(t('books.switched', { name: b.name }));
  }

  async function doDelete(b: Book) {
    if (b.is_default === 1) {
      notify(t('books.err.cantDeleteDefault'));
      return;
    }
    const confirmed =
      Platform.OS === 'web'
        ? confirm(t('books.confirmDeleteWeb', { name: b.name }))
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              t('books.confirmDeleteTitle', { name: b.name }),
              t('books.confirmDeleteMsg'),
              [
                { text: t('common.cancel'), onPress: () => resolve(false) },
                { text: t('common.delete2'), style: 'destructive', onPress: () => resolve(true) },
              ]
            );
          });
    if (!confirmed) return;
    try {
      await deleteBookAction(b.id);
      notify(t('books.deleted'));
    } catch (e: any) {
      notify(`Lỗi: ${e?.message || 'unknown'}`);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('books.title')}</Text>
        <TouchableOpacity onPress={openCreate} style={styles.backBtn}>
          <Icon name="Sparkles" size={20} color={palette.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.intro}>{t('books.intro')}</Text>

        {books.map((b) => {
          const isActive = b.id === currentBookId;
          return (
            <TouchableOpacity
              key={b.id}
              style={[styles.bookCard, isActive && { borderColor: palette.primary, borderWidth: 2 }]}
              onPress={() => doSwitch(b)}
              activeOpacity={0.7}
            >
              <View style={[styles.bookIcon, { backgroundColor: b.color + '20' }]}>
                <Icon name={b.icon} size={24} color={b.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bookName} numberOfLines={1}>
                  {b.name}
                  {b.is_default === 1 ? <Text style={styles.bookSub}> · {t('books.defaultTag')}</Text> : null}
                </Text>
                {isActive ? (
                  <Text style={[styles.bookSub, { color: palette.primary, fontWeight: '700' }]}>
                    {t('books.currentUsing')}
                  </Text>
                ) : (
                  <Text style={styles.bookSub}>{t('books.tapToSwitch')}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => openEdit(b)} style={styles.actionBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="Pencil" size={18} color="#6b7280" />
              </TouchableOpacity>
              {b.is_default === 0 ? (
                <TouchableOpacity onPress={() => doDelete(b)} style={styles.actionBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Icon name="Trash2" size={18} color="#ef4444" />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: palette.primary }]}
          onPress={openCreate}
        >
          <Icon name="Sparkles" size={18} color="#fff" />
          <Text style={styles.addBtnText}>{t('books.addBtn', { n: books.length })}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={!!editing} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
            <View style={styles.modalCard}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>{editing.id ? t('books.editTitle') : t('books.createTitle')}</Text>

                <Text style={styles.label}>{t('books.nameLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={editing.name}
                  onChangeText={(v) => setEditing({ ...editing, name: v })}
                  placeholder={t('books.namePlaceholder')}
                  placeholderTextColor="#9ca3af"
                  maxLength={40}
                />

                <Text style={styles.label}>{t('books.iconLabel')}</Text>
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
                        <Icon name={n} size={22} color={selected ? editing.color : '#6b7280'} />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>{t('books.colorLabel')}</Text>
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
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  container: { padding: 16, paddingBottom: 32 },
  intro: { fontSize: 13, color: '#6b7280', lineHeight: 20, marginBottom: 16 },
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bookIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bookName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  bookSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  actionBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalCard: { flex: 1, backgroundColor: '#fff', padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12, textAlign: 'center' },
  label: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: 6, marginTop: 12, letterSpacing: 0.5 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 15, color: '#111827' },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChoice: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorChoice: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  colorSelected: { borderWidth: 2, borderColor: '#111827' },
  modalBtns: { flexDirection: 'row', gap: 8, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#f3f4f6' },
  cancelText: { color: '#374151', fontWeight: '700', fontSize: 14 },
  saveBtn: { flex: 2, padding: 14, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
