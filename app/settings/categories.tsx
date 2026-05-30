// F23 — Quản lý danh mục: thêm/sửa/xoá custom + ẩn default.
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
import { useStore } from '../../src/store/useStore';
import { Icon, ICONS } from '../../src/components/Icon';
import { getAllCategories, Category } from '../../src/db';
import { useTheme } from '../../src/store/useTheme';
import { useT } from '../../src/i18n/useT';
import { t } from '../../src/i18n';
import { displayCategoryName } from '../../src/i18n/categoryName';

const ICON_CHOICES = [
  'Utensils', 'ShoppingBag', 'Shirt', 'Sparkles', 'Beer', 'Pill',
  'BookOpen', 'Zap', 'Bus', 'Smartphone', 'Home', 'MoreHorizontal',
  'Wallet', 'Gift', 'Coins', 'Heart', 'Receipt', 'Camera', 'Cloud', 'Palette',
  'BarChart3', 'Bell', 'Crown', 'Lock', 'Database', 'TrendingUp', 'TrendingDown',
  'Scale', 'CalendarDays', 'Pencil', 'Mic', 'Bot', 'Settings', 'Store', 'Share2',
].filter((n) => ICONS[n]);

const COLOR_CHOICES = [
  '#ef4444', '#f97316', '#f59e0b', '#fbbf24', '#facc15',
  '#84cc16', '#10b981', '#16a34a', '#22c55e', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#ec4899', '#dc2626', '#6b7280', '#374151',
];

interface DraftCat {
  id?: number;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
}

export default function CategoriesManage() {
  useT();
  const router = useRouter();
  const palette = useTheme();
  const addCategoryAction = useStore((s) => s.addCategoryAction);
  const updateCategoryAction = useStore((s) => s.updateCategoryAction);
  const deleteCategoryAction = useStore((s) => s.deleteCategoryAction);

  const [all, setAll] = useState<Category[]>([]);
  const [filter, setFilter] = useState<'expense' | 'income'>('expense');
  const [editing, setEditing] = useState<DraftCat | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const list = await getAllCategories();
    setAll(list);
  }

  function openCreate() {
    setEditing({ name: '', icon: 'MoreHorizontal', color: COLOR_CHOICES[6], type: filter });
  }

  function openEdit(c: Category) {
    setEditing({ id: c.id, name: c.name, icon: c.icon, color: c.color, type: c.type });
  }

  async function save() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      notify('Nhập tên danh mục');
      return;
    }
    if (name.length > 30) {
      notify('Tên tối đa 30 ký tự');
      return;
    }
    setSaving(true);
    try {
      if (editing.id) {
        await updateCategoryAction(editing.id, {
          name,
          icon: editing.icon,
          color: editing.color,
        });
      } else {
        await addCategoryAction({
          name,
          icon: editing.icon,
          color: editing.color,
          type: editing.type,
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

  async function toggleVisible(c: Category) {
    const newVisible = (c.is_visible ?? 1) === 1 ? 0 : 1;
    await updateCategoryAction(c.id, { is_visible: newVisible });
    await refresh();
  }

  async function doDelete(c: Category) {
    const confirmed =
      Platform.OS === 'web'
        ? confirm(`Xoá "${c.name}"? ${c.is_default === 1 ? 'Default sẽ chỉ bị ẩn.' : 'Transactions sẽ chuyển sang "Khác".'}`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              `Xoá "${c.name}"?`,
              c.is_default === 1
                ? 'Đây là danh mục mặc định, sẽ chỉ bị ẩn (có thể bật lại).'
                : 'Các giao dịch thuộc danh mục này sẽ chuyển sang "Khác".',
              [
                { text: 'Huỷ', onPress: () => resolve(false) },
                { text: 'Xoá', style: 'destructive', onPress: () => resolve(true) },
              ]
            );
          });
    if (!confirmed) return;
    const res = await deleteCategoryAction(c.id);
    await refresh();
    if (res.deleted) {
      notify(
        res.reassigned > 0
          ? `Đã xoá. ${res.reassigned} giao dịch chuyển sang "Khác"`
          : 'Đã xoá'
      );
    } else {
      notify('Đã ẩn danh mục mặc định');
    }
  }

  const filtered = all.filter((c) => c.type === filter);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('categories.title')}</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addTopBtn} accessibilityLabel="Thêm danh mục">
          <Icon name="Sparkles" size={20} color={palette.primary} />
        </TouchableOpacity>
      </View>

      {/* Type filter */}
      <View style={styles.typeTabs}>
        <TouchableOpacity
          style={[styles.typeTab, filter === 'expense' && styles.typeTabActive]}
          onPress={() => setFilter('expense')}
        >
          <Text style={[styles.typeText, filter === 'expense' && styles.typeTextActive]}>
            Chi tiêu
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeTab, filter === 'income' && styles.typeTabActive]}
          onPress={() => setFilter('income')}
        >
          <Text style={[styles.typeText, filter === 'income' && styles.typeTextActive]}>
            Thu nhập
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {filtered.map((c) => {
          const hidden = (c.is_visible ?? 1) === 0;
          return (
            <View key={c.id} style={[styles.item, hidden && { opacity: 0.5 }]}>
              <View style={[styles.iconBox, { backgroundColor: c.color + '20' }]}>
                <Icon name={c.icon} size={20} color={c.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {displayCategoryName(c)}
                  {c.is_default === 1 ? <Text style={styles.defaultTag}> · mặc định</Text> : null}
                  {hidden ? <Text style={styles.hiddenTag}> · đã ẩn</Text> : null}
                </Text>
              </View>
              <TouchableOpacity onPress={() => toggleVisible(c)} style={styles.actionBtn}>
                <Icon name={hidden ? 'Check' : 'X'} size={18} color="#6b7280" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEdit(c)} style={styles.actionBtn}>
                <Icon name="Pencil" size={18} color="#6b7280" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => doDelete(c)} style={styles.actionBtn}>
                <Icon name="Trash2" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          );
        })}
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: palette.primary }]} onPress={openCreate}>
          <Icon name="Sparkles" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Thêm danh mục {filter === 'expense' ? 'chi' : 'thu'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Editor modal */}
      <Modal visible={!!editing} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
            <View style={styles.modalCard}>
              <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                {editing.id ? 'Sửa danh mục' : 'Thêm danh mục'}
              </Text>

              <Text style={styles.label}>{t('categories.nameLabel')}</Text>
              <TextInput
                style={styles.input}
                value={editing.name}
                onChangeText={(v) => setEditing({ ...editing, name: v })}
                placeholder="Vd: Thú cưng, Du lịch..."
                placeholderTextColor="#9ca3af"
                maxLength={30}
              />

              <Text style={styles.label}>{t('categories.iconLabel')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconRow}>
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
              </ScrollView>

              <Text style={styles.label}>{t('categories.colorLabel')}</Text>
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

              {!editing.id ? (
                <>
                  <Text style={styles.label}>{t('categories.typeLabel')}</Text>
                  <View style={styles.typeTabs}>
                    <TouchableOpacity
                      style={[styles.typeTab, editing.type === 'expense' && styles.typeTabActive]}
                      onPress={() => setEditing({ ...editing, type: 'expense' })}
                    >
                      <Text style={[styles.typeText, editing.type === 'expense' && styles.typeTextActive]}>
                        Chi tiêu
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.typeTab, editing.type === 'income' && styles.typeTabActive]}
                      onPress={() => setEditing({ ...editing, type: 'income' })}
                    >
                      <Text style={[styles.typeText, editing.type === 'income' && styles.typeTextActive]}>
                        Thu nhập
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

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
  typeTabs: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
  },
  typeTab: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
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
  container: { padding: 16, paddingBottom: 32 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 8,
    gap: 10,
  },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  defaultTag: { fontSize: 11, color: '#9ca3af', fontWeight: '400' },
  hiddenTag: { fontSize: 11, color: '#dc2626', fontWeight: '500' },
  actionBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
  iconRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  iconChoice: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  colorChoice: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
