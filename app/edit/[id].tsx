import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { notify } from '../../src/utils/notify';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import { getTransaction } from '../../src/db';
import { formatNumber } from '../../src/utils/format';
import { Icon } from '../../src/components/Icon';
import { DatePickerField } from '../../src/components/DatePickerField';
import { todayISO } from '../../src/utils/date';
import { useTheme } from '../../src/store/useTheme';
import { useT } from '../../src/i18n/useT';
import { t } from '../../src/i18n';
import { displayCategoryName } from '../../src/i18n/categoryName';

export default function EditTransaction() {
  useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const txId = Number(id);
  const router = useRouter();
  const categories = useStore((s) => s.categories);
  const updateTx = useStore((s) => s.updateTransaction);
  const deleteTx = useStore((s) => s.deleteTransaction);
  const palette = useTheme();

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [walletId, setWalletId] = useState<number | null>(null); // v3.64 — H6
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false); // v3.58 — guard double-tap save
  const wallets = useStore((s) => s.wallets); // v3.64 — H6

  useEffect(() => {
    (async () => {
      const tx = await getTransaction(txId);
      if (!tx) {
        notify('Không tìm thấy giao dịch');
        router.back();
        return;
      }
      setType(tx.type);
      setAmount(String(tx.amount));
      setNote(tx.note ?? '');
      setDate(tx.date);
      setCategoryId(tx.category_id);
      setWalletId(tx.wallet_id ?? null); // v3.64 — H6
      setPhotoUri(tx.photo_uri ?? null);
      setLoaded(true);
    })();
  }, [txId]);

  async function save() {
    if (saving) return; // v3.58 — guard double-tap
    const n = parseInt(amount.replace(/\D/g, ''), 10);
    if (!n || n <= 0) return notify('Nhập số tiền');
    if (!categoryId) return notify('Chọn danh mục');
    setSaving(true);
    try {
      await updateTx(txId, { amount: n, category_id: categoryId, wallet_id: walletId ?? undefined, note, type, date, photo_uri: photoUri });
      // v3.65 — L6: học pattern cho note + cat (giống tab Nhập) để smart suggest tốt hơn
      if (note.trim()) {
        try {
          const { learnCategoryPattern } = await import('../../src/db');
          await learnCategoryPattern(note, categoryId);
        } catch {
          /* noop */
        }
      }
      notify('Đã cập nhật');
      router.back();
    } catch (e: any) {
      // v3.57 — Catch lỗi từ store guard (vd date tương lai) để user thấy feedback
      notify(e?.message || 'Lỗi khi cập nhật giao dịch');
      setSaving(false);
    }
  }

  // v3.79 — Guard chống bấm spam + check permission cache trước (tránh delay 2-3s)
  const pickingRef = useRef(false);

  async function pickPhoto() {
    if (pickingRef.current) return;
    pickingRef.current = true;
    try {
      let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') return notify('Cần quyền thư viện ảnh');
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets.length > 0) setPhotoUri(result.assets[0].uri);
    } finally {
      pickingRef.current = false;
    }
  }

  async function takePhoto() {
    if (pickingRef.current) return;
    pickingRef.current = true;
    try {
      let perm = await ImagePicker.getCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== 'granted') return notify('Cần quyền camera');
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets.length > 0) setPhotoUri(result.assets[0].uri);
    } finally {
      pickingRef.current = false;
    }
  }

  function confirmDelete() {
    const doDel = async () => {
      await deleteTx(txId);
      router.back();
    };
    if (Platform.OS === 'web') {
      if (confirm('Xoá giao dịch này?')) doDel();
    } else {
      Alert.alert('Xoá', 'Xoá giao dịch này?', [
        { text: 'Huỷ' },
        { text: 'Xoá', style: 'destructive', onPress: doDel },
      ]);
    }
  }

  if (!loaded) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={{ padding: 20 }}>Đang tải...</Text>
      </SafeAreaView>
    );
  }

  const filteredCats = categories.filter((c) => c.type === type);
  const displayAmount = amount ? formatNumber(parseInt(amount.replace(/\D/g, ''), 10) || 0) : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="ChevronRight" size={24} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>Sửa giao dịch</Text>
        <TouchableOpacity onPress={confirmDelete}>
          <Text style={styles.deleteText}>{t('common.delete')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.typeTabs}>
          <TouchableOpacity
            style={[styles.typeTab, type === 'expense' && styles.typeTabActive]}
            onPress={() => {
              // v3.63 — Reset categoryId khi đổi type để tránh data inconsistent
              //         (cat thuộc type cũ sẽ KHÔNG match filteredCats type mới)
              setType('expense');
              setCategoryId(null);
            }}
          >
            <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>
              Chi
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeTab, type === 'income' && styles.typeTabActive]}
            onPress={() => {
              setType('income');
              setCategoryId(null);
            }}
          >
            <Text style={[styles.typeText, type === 'income' && styles.typeTextActive]}>
              Thu
            </Text>
          </TouchableOpacity>
        </View>

        <DatePickerField value={date} onChange={setDate} maxDate={todayISO()} todayISO={todayISO()} />

        {/* v3.64 — H6: Wallet picker (chỉ hiện khi > 1 ví) */}
        {wallets.length > 1 ? (
          <>
            <Text style={styles.label}>Ví</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.walletRow}>
              {wallets.map((w) => {
                const selected = walletId === w.id;
                return (
                  <TouchableOpacity
                    key={w.id}
                    style={[
                      styles.walletPill,
                      selected && { backgroundColor: w.color + '20', borderColor: w.color },
                    ]}
                    onPress={() => setWalletId(w.id)}
                  >
                    <Icon name={w.icon} size={14} color={selected ? w.color : '#6b7280'} />
                    <Text style={[styles.walletPillText, selected && { color: w.color, fontWeight: '700' }]} numberOfLines={1}>
                      {w.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        <Text style={styles.label}>Số tiền</Text>
        <View style={styles.amountRow}>
          <TextInput
            style={styles.amountInput}
            value={displayAmount}
            onChangeText={(v) => setAmount(v.replace(/\D/g, ''))}
            keyboardType="numeric"
          />
          <Text style={styles.currency}>đ</Text>
        </View>

        <Text style={styles.label}>Ghi chú</Text>
        <TextInput style={styles.input} value={note} onChangeText={setNote} />

        <Text style={styles.label}>Ảnh đính kèm</Text>
        {photoUri ? (
          <View style={styles.photoBox}>
            <Image
              source={{ uri: photoUri }}
              style={styles.photoThumb}
              resizeMode="cover"
              onError={() => {
                console.warn('[photo] missing file:', photoUri);
                setPhotoUri(null);
              }}
            />
            <TouchableOpacity
              style={[styles.photoRemove, { backgroundColor: palette.expense }]}
              onPress={() => setPhotoUri(null)}
            >
              <Icon name="X" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoBtnRow}>
            <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
              <Icon name="Camera" size={16} color={palette.primary} />
              <Text style={[styles.photoBtnText, { color: palette.primary }]}>Chụp ảnh</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
              <Icon name="ImageIcon" size={16} color={palette.primary} />
              <Text style={[styles.photoBtnText, { color: palette.primary }]}>Chọn ảnh</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.label}>Danh mục</Text>
        <View style={styles.catGrid}>
          {filteredCats.map((c) => {
            const selected = categoryId === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.catItem,
                  selected && { borderColor: c.color, borderWidth: 2, backgroundColor: c.color + '15' },
                ]}
                onPress={() => setCategoryId(c.id)}
              >
                <View style={[styles.catIconBox, { backgroundColor: c.color + '20' }]}>
                  <Icon name={c.icon} size={22} color={c.color} />
                </View>
                <Text style={styles.catName} numberOfLines={1}>{displayCategoryName(c)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: type === 'expense' ? palette.expense : palette.income, opacity: saving ? 0.6 : 1 }]}
          onPress={save}
          disabled={saving}
        >
          <Text style={styles.submitText}>Lưu thay đổi</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backBtn: { transform: [{ rotate: '180deg' }] },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  deleteText: { color: '#ef4444', fontWeight: '700', fontSize: 14 },
  container: { padding: 20, paddingBottom: 40 },
  typeTabs: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 16 },
  typeTab: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  typeTabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 2 },
  typeText: { color: '#6b7280', fontWeight: '600' },
  typeTextActive: { color: '#111827' },
  label: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: 6, marginTop: 14, letterSpacing: 0.5 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 16, color: '#111827' },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12 },
  amountInput: { flex: 1, padding: 12, fontSize: 22, fontWeight: '700', color: '#111827' },
  currency: { fontSize: 18, fontWeight: '700', color: '#6b7280' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catItem: { width: '31%', backgroundColor: '#f9fafb', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', minHeight: 84, justifyContent: 'center' },
  catIconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  catName: { fontSize: 11, color: '#374151', textAlign: 'center', fontWeight: '600' },
  walletRow: { flexDirection: 'row', marginBottom: 8 },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 6,
  },
  walletPillText: { fontSize: 12, color: '#6b7280', fontWeight: '600', maxWidth: 100 },
  submitBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  photoBtnRow: { flexDirection: 'row', gap: 8 },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    backgroundColor: '#f9fafb',
  },
  photoBtnText: { fontSize: 13, fontWeight: '700' },
  photoBox: { position: 'relative', alignSelf: 'flex-start' },
  photoThumb: { width: 140, height: 140, borderRadius: 12, backgroundColor: '#f3f4f6' },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
