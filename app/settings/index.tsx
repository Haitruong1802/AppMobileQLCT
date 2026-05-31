// v3.25 — Refactor Settings sang iOS-style flat list: nhóm có header uppercase, mỗi item 1 dòng compact.
import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import { notify } from '../../src/utils/notify';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import { Icon } from '../../src/components/Icon';
import { exportTransactionsCSV, shareFile, ExportRangeKey } from '../../src/services/export';
import { resetDatabase, getCategories, seedDefaultPatterns, optimizeDb } from '../../src/db';
import { exportFullBackup, shareBackup, importFullBackup, readBackupFile, BackupValidationError } from '../../src/services/backup';
import * as DocumentPicker from 'expo-document-picker';
import { usePremiumState } from '../../src/store/usePremium';
import { packageLabel } from '../../src/services/premium';
import { ProUpgradeModal } from '../../src/components/ProUpgradeModal';
import { ProBadge } from '../../src/components/ProBadge';
import { useTheme } from '../../src/store/useTheme';
import { t } from '../../src/i18n';
import { useLocale } from '../../src/i18n/useLocale';
import { FONT_SIZE, FONT_WEIGHT, GRAY, SPACING } from '../../src/theme/tokens';

type Row = {
  icon: string;
  iconColor?: string;
  label: string;
  sub?: string; // v3.54 — match style more.tsx
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  busy?: boolean;
  proBadge?: boolean; // v3.131 — hiện ProBadge inline cạnh label nếu free user
};

export default function Settings() {
  const router = useRouter();
  const settings = useStore((s) => s.settings);
  const updateSetting = useStore((s) => s.updateSetting);
  const loadCategories = useStore((s) => s.loadCategories);
  const loadTransactions = useStore((s) => s.loadTransactions);
  const loadBudgets = useStore((s) => s.loadBudgets);
  const loadSettings = useStore((s) => s.loadSettings);
  const loadWallets = useStore((s) => s.loadWallets);
  const loadBooks = useStore((s) => s.loadBooks);
  const palette = useTheme();
  useLocale();
  const state = usePremiumState();
  const tier = state.tier;

  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // v3.131 — Modal upgrade Pro (thay router.push trực tiếp)
  const [proModalFor, setProModalFor] = useState<'autoSavings' | 'theme' | 'backup' | 'unlimited' | 'generic' | null>(null);

  async function doBackup() {
    if (backingUp) return;
    if (tier === 'free') {
      setProModalFor('backup');
      return;
    }
    setBackingUp(true);
    try {
      const { uri, bytes } = await exportFullBackup();
      try {
        await shareBackup(uri);
      } catch (shareErr: any) {
        // Sharing throw nếu user cancel share sheet — coi như không lỗi
        const msg = String(shareErr?.message || '');
        if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('dismiss')) {
          return;
        }
        throw shareErr;
      }
      notify(`Đã tạo file sao lưu (${Math.round(bytes / 1024)} KB)`, 'success');
    } catch (e: any) {
      // v3.130 — Hiện error chi tiết để debug
      const msg = String(e?.message || e || 'unknown');
      console.warn('[backup] export failed:', e);
      notify(`Lỗi sao lưu: ${msg.slice(0, 120)}`, 'error');
    } finally {
      setBackingUp(false);
    }
  }

  async function doRestore() {
    if (restoring) return;
    if (tier === 'free') {
      setProModalFor('backup');
      return;
    }
    setRestoring(true);
    try {
      // Step 1: pick file — user huỷ → return im lặng, không show lỗi
      let pickResult;
      try {
        pickResult = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
        });
      } catch {
        notify(t('err.filePickerFailed'), 'error');
        return;
      }
      if (pickResult.canceled) return;
      const uri = pickResult.assets?.[0]?.uri;
      if (!uri) {
        notify(t('err.fileReadFailed'), 'error');
        return;
      }

      // Step 2: validate file. Sai → KHÔNG ghi đè dữ liệu hiện tại.
      let bundle: Awaited<ReturnType<typeof readBackupFile>>;
      try {
        bundle = await readBackupFile(uri);
      } catch (e: any) {
        if (e instanceof BackupValidationError) {
          notify(e.message, 'error');
        } else {
          notify(t('err.invalidBackup'), 'error');
        }
        return;
      }

      // Step 3: confirm — chỉ khi file valid
      const totalRows = Object.values(bundle.data).reduce(
        (s: number, arr: any) => s + (Array.isArray(arr) ? arr.length : 0),
        0
      );
      const stamp = (bundle.exportedAt || '').slice(0, 10) || '?';
      const confirmed = await new Promise<boolean>((resolve) => {
        if (Platform.OS === 'web') {
          resolve(
            confirm(
              `Khôi phục backup ngày ${stamp} (${totalRows} bản ghi)?\n\nToàn bộ dữ liệu hiện tại sẽ bị thay thế.`
            )
          );
        } else {
          Alert.alert(
            'Khôi phục dữ liệu',
            `Backup ngày ${stamp}, tổng ${totalRows} bản ghi.\n\nToàn bộ dữ liệu hiện tại sẽ bị THAY THẾ. Hành động này không thể hoàn tác.`,
            [
              { text: 'Huỷ', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Khôi phục', style: 'destructive', onPress: () => resolve(true) },
            ],
            { cancelable: true, onDismiss: () => resolve(false) }
          );
        }
      });
      if (!confirmed) return;

      // Step 4: import. Atomic qua DB transaction — fail giữa chừng → rollback data cũ.
      try {
        const { restoredCount } = await importFullBackup(bundle);
        const total = Object.values(restoredCount).reduce((s, n) => s + n, 0);
        await Promise.all([
          loadSettings(),
          loadCategories(),
          loadTransactions(),
          loadBudgets(),
          loadWallets(),
          loadBooks(),
        ]);
        notify(`Đã khôi phục ${total} bản ghi`, 'success');
      } catch {
        notify(t('err.restoreFailed'), 'error');
      }
    } finally {
      setRestoring(false);
    }
  }

  async function doOptimize() {
    setOptimizing(true);
    try {
      await optimizeDb();
      notify(t('msg.dbOptimized'));
    } catch (e: any) {
      notify(`Lỗi: ${e?.message || 'unknown'}`);
    } finally {
      setOptimizing(false);
    }
  }

  async function doExport() {
    if (exporting) return;
    const pick = await pickExportRange();
    if (!pick) return;
    setExporting(true);
    try {
      const { uri, rows, fileName, rangeLabel: rangeName } = await exportTransactionsCSV(pick);
      if (rows === 0) {
        notify(`Không có giao dịch trong ${rangeName.toLowerCase()}.`, 'info');
        return;
      }
      try {
        await shareFile(uri, 'text/csv', fileName);
        notify(`Đã xuất ${rows} giao dịch (${rangeName.toLowerCase()})`, 'success');
      } catch (shareErr: any) {
        const msg = String(shareErr?.message || '');
        if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('dismiss')) return;
        throw shareErr;
      }
    } catch (e: any) {
      notify(`Không xuất được file: ${e?.message || 'lỗi không xác định'}`, 'error');
    } finally {
      setExporting(false);
    }
  }

  /** Modal chọn phạm vi xuất. iOS Alert max 4 nút (kể cả Cancel). */
  function pickExportRange(): Promise<ExportRangeKey | null> {
    return new Promise((resolve) => {
      if (Platform.OS === 'web') {
        const choice = prompt(
          'Chọn phạm vi xuất:\n1 = Tháng này\n2 = Tháng trước\n3 = Năm nay\n4 = Tất cả',
          '1'
        );
        if (!choice) return resolve(null);
        const map: Record<string, ExportRangeKey> = {
          '1': 'thisMonth',
          '2': 'lastMonth',
          '3': 'thisYear',
          '4': 'all',
        };
        resolve(map[choice.trim()] || null);
        return;
      }
      Alert.alert(
        t('settings.exportCsvLabel'),
        t('export.chooseRangeMsg'),
        [
          { text: t('export.cancel'), style: 'cancel', onPress: () => resolve(null) },
          { text: t('export.thisYear'), onPress: () => resolve('thisYear') },
          { text: t('export.thisMonth'), onPress: () => resolve('thisMonth') },
          { text: t('export.all'), onPress: () => resolve('all') },
        ],
        { cancelable: true, onDismiss: () => resolve(null) }
      );
    });
  }

  async function doReset() {
    // v3.60 — Accept confirm word theo locale: vi=XOÁ, en=DELETE, zh=删除
    const expectedWord = t('settings.resetConfirmWord');
    const input = resetConfirmText.trim();
    const normalizedInput = input.toUpperCase();
    const normalizedExpected = expectedWord.toUpperCase();
    if (normalizedInput !== normalizedExpected && input !== expectedWord) {
      notify(t('settings.resetConfirmHint', { word: expectedWord }));
      return;
    }
    setResetting(true);
    try {
      await resetDatabase();
      await getCategories();
      // v3.57 — Re-seed default patterns ngay sau reset để suggest category hoạt động luôn,
      //         không phải chờ restart app (boot hook chỉ chạy 1 lần lúc khởi động).
      await seedDefaultPatterns();
      await Promise.all([
        loadSettings(),
        loadCategories(),
        loadTransactions(),
        loadBudgets(),
        loadWallets(),
        loadBooks(),
      ]);
      setResetModalOpen(false);
      setResetConfirmText('');
      notify(t('settings.resetDone'));
    } catch (e: any) {
      notify(`Lỗi: ${e?.message || 'unknown'}`);
    } finally {
      setResetting(false);
    }
  }

  const localeLabel =
    settings.locale === 'en' ? 'English' : settings.locale === 'zh' ? '中文' : 'Tiếng Việt';

  // v3.54 — Style match tab Khác: card lớn + icon tròn 40 + label đậm + sub xám + chevron
  function renderRow(row: Row) {
    const Cmp: any = row.onPress ? TouchableOpacity : View;
    return (
      <Cmp
        key={row.label}
        onPress={row.onPress}
        activeOpacity={row.onPress ? 0.7 : 1}
        style={styles.item}
      >
        <View style={[styles.iconBox, { backgroundColor: (row.iconColor || palette.primary) + '20' }]}>
          <Icon name={row.icon} size={22} color={row.iconColor || palette.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.itemNameRow}>
            <Text style={[styles.itemName, row.danger && { color: '#dc2626' }]}>{row.label}</Text>
            {row.proBadge ? <ProBadge size="sm" /> : null}
          </View>
          {row.sub ? <Text style={styles.itemSub}>{row.sub}</Text> : null}
        </View>
        {row.value ? <Text style={styles.itemValue}>{row.value}</Text> : null}
        {row.busy ? (
          <ActivityIndicator size="small" color="#9ca3af" />
        ) : row.onPress ? (
          <Icon name="ChevronRight" size={20} color="#d1d5db" />
        ) : null}
      </Cmp>
    );
  }

  function renderGroup(header: string, rows: Row[]) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{header}</Text>
        {rows.map((r) => renderRow(r))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* v3.133 — Centralized Pro entry: 1 row duy nhất trong Settings */}
        {renderGroup(t('settings.section.account'), [
          (() => {
            if (state.earlyAccess) {
              return {
                icon: 'Crown',
                iconColor: '#fbbf24',
                label: t('settings.earlyAccessLabel'),
                sub: t('settings.earlyAccessDesc'),
                onPress: () => router.push('/premium'),
                proBadge: false,
              };
            }
            const isPro = state.tier === 'pro';
            const sub = isPro
              ? `${packageLabel(state.package)}${
                  state.isLifetime
                    ? ` · ${t('settings.lifetime')}`
                    : state.daysLeft !== null && state.daysLeft >= 0
                    ? ` · ${t('settings.daysLeft', { days: state.daysLeft })}`
                    : ''
                }`
              : t('settings.freeUpgradeHint');
            return {
              icon: 'Crown',
              iconColor: isPro ? '#fbbf24' : '#9ca3af',
              label: isPro ? 'Bux2 Pro' : t('settings.planLabel'),
              sub,
              onPress: () => router.push('/premium'),
              proBadge: isPro,
            };
          })(),
          {
            icon: 'ShoppingBag',
            label: t('settings.categories'),
            sub: t('settings.categoriesDesc'),
            onPress: () => router.push('/settings/categories'),
          },
        ])}

        {renderGroup(t('settings.section.security'), [
          {
            icon: 'Lock',
            label: t('settings.security'),
            sub: t('settings.securityDesc'),
            onPress: () => router.push('/settings/security'),
          },
          {
            icon: 'Languages',
            label: t('settings.language'),
            sub: t('settings.languageDesc'),
            value: localeLabel,
            onPress: () => router.push('/settings/language'),
          },
        ])}

        {/* v3.147 — Bỏ group "Thông báo" theo yêu cầu: app tự thông báo ngầm,
            user không cần quản lý. "Giao dịch lặp" chuyển sang tab Khác. */}

        {/* v3.147 — Theme rút gọn: 1 row dẫn vào screen chọn theme riêng. */}
        {renderGroup(t('settings.section.appearance'), [
          {
            icon: 'Palette',
            label: t('settings.theme'),
            sub: t('settings.themeUsing', { name: palette.label }),
            value: palette.label,
            onPress: () => router.push('/settings/theme'),
          },
        ])}

        {renderGroup(t('settings.section.data'), [
          {
            icon: 'Download',
            label: t('settings.exportCsvLabel'),
            sub: t('settings.exportCsvDesc'),
            onPress: exporting ? undefined : doExport,
            busy: exporting,
          },
          {
            icon: 'Cloud',
            label: t('settings.backupLabel'),
            sub: t('settings.backupDesc'),
            onPress: backingUp ? undefined : doBackup,
            busy: backingUp,
            proBadge: tier === 'free',
          },
          {
            icon: 'RotateCcw',
            label: t('settings.restoreLabel'),
            sub: t('settings.restoreDesc'),
            onPress: restoring ? undefined : doRestore,
            busy: restoring,
            proBadge: tier === 'free',
          },
          {
            icon: 'Database',
            label: t('settings.optimizeLabel'),
            sub: t('settings.optimizeDesc'),
            onPress: optimizing ? undefined : doOptimize,
            busy: optimizing,
          },
        ])}

        {renderGroup(t('settings.section.danger'), [
          {
            icon: 'Trash2',
            iconColor: '#dc2626',
            label: t('settings.resetBtn'),
            sub: t('settings.resetSubShort'),
            danger: true,
            onPress: () => {
              setResetConfirmText('');
              setResetModalOpen(true);
            },
          },
        ])}

        <View style={styles.aboutBox}>
          <Text style={styles.aboutVer}>Bux2 v0.3.0</Text>
          <Text style={styles.aboutSub}>{t('settings.aboutSub')}</Text>
          {/* v3.76 — Credit Lottie animation tác giả theo Lottie Simple License */}
          <Text style={styles.aboutCredit}>
            Pet animation by U know me · LottieFiles
          </Text>
        </View>
      </ScrollView>

      {/* Reset confirmation modal */}
      <Modal
        visible={resetModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setResetModalOpen(false)}
      >
        <Pressable style={styles.resetModalBg} onPress={() => setResetModalOpen(false)}>
          <Pressable style={styles.resetModalCard} onPress={() => {}}>
            <View style={styles.resetIconBox}>
              <Icon name="AlertCircle" size={42} color="#dc2626" />
            </View>
            <Text style={styles.resetTitle}>{t('settings.resetTitle')}</Text>
            <Text style={styles.resetDesc}>{t('settings.resetDesc')}</Text>
            <Text style={styles.resetLabel}>{t('settings.resetEnter')}</Text>
            {(() => {
              const word = t('settings.resetConfirmWord');
              const matched =
                resetConfirmText.trim() === word ||
                resetConfirmText.trim().toUpperCase() === word.toUpperCase();
              return (
                <>
                  <TextInput
                    style={[
                      styles.resetInput,
                      matched && {
                        borderColor: '#dc2626',
                        backgroundColor: '#fef2f2',
                      },
                    ]}
                    value={resetConfirmText}
                    onChangeText={setResetConfirmText}
                    placeholder={word}
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <View style={styles.resetBtns}>
                    <TouchableOpacity
                      style={styles.resetCancel}
                      onPress={() => {
                        setResetModalOpen(false);
                        setResetConfirmText('');
                      }}
                    >
                      <Text style={styles.resetCancelText}>{t('settings.resetCancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.resetConfirm,
                        !matched && { opacity: 0.4 },
                      ]}
                      onPress={doReset}
                      disabled={!matched || resetting}
                    >
                      {resetting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.resetConfirmText}>{t('settings.resetConfirm')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* v3.131 — Modal upgrade Pro */}
      <ProUpgradeModal
        visible={proModalFor !== null}
        feature={proModalFor || 'generic'}
        onClose={() => setProModalFor(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: GRAY[100],
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: GRAY[900] },
  container: { padding: 20, paddingTop: 8 },

  // v3.54 — Style match more.tsx (tab Khác)
  section: { marginTop: 8 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  itemSub: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  itemValue: { fontSize: 13, color: '#9ca3af', marginRight: 4 },

  // ── ABOUT ──
  aboutBox: { alignItems: 'center', paddingVertical: 20, marginTop: 14 },
  aboutVer: { fontSize: 13, color: '#9ca3af', fontWeight: '600' },
  aboutSub: { fontSize: 11, color: '#d1d5db', marginTop: 2 },
  aboutCredit: { fontSize: 10, color: '#d1d5db', marginTop: 12, fontStyle: 'italic' },

  // ── RESET MODAL (giữ nguyên) ──
  resetModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  resetModalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  resetIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  resetTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 8 },
  resetDesc: {
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  resetLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  resetInput: {
    width: '100%',
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 4,
  },
  resetBtns: { flexDirection: 'row', gap: 8, marginTop: 16, width: '100%' },
  resetCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  resetCancelText: { color: '#374151', fontWeight: '700', fontSize: 14 },
  resetConfirm: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#dc2626',
  },
  resetConfirmText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
