import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
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
  Keyboard,
} from 'react-native';
import { notify } from '../../src/utils/notify';
import { NOTE_SUGGEST_DEBOUNCE_MS, DEFAULT_COOLDOWN_THRESHOLD } from '../../src/utils/constants';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useStore } from '../../src/store/useStore';
import { todayISO, localDateISO } from '../../src/utils/date';
import { formatNumber } from '../../src/utils/format';
import { Icon } from '../../src/components/Icon';
import { DatePickerField } from '../../src/components/DatePickerField';
import { useTheme } from '../../src/store/useTheme';
import { suggestCategoryFromNote, learnCategoryPattern, getBills, Bill, getSnapshot, getSavingsGoals, SavingsGoal, addToSavingsGoal } from '../../src/db';
import { parseAmountLocal, detectTypeLocal, extractNoteLocal } from '../../src/utils/localParse';
import { computeSafeToSpend, parseSalaryCycleFromSettings } from '../../src/services/safeToSpend';
import { SafeToSpendCard } from '../../src/components/SafeToSpendCard';
import { StreakBadge } from '../../src/components/StreakBadge';
import { CoolDownModal } from '../../src/components/CoolDownModal';
import { MonthReviewModal } from '../../src/components/MonthReviewModal';
import { computeMonthReview, shouldShowMonthReview, markMonthReviewDone, MonthReviewData } from '../../src/services/monthReview';
import { getStreak, StreakState, badgeLabel } from '../../src/services/streak';
import { t } from '../../src/i18n';
import { useLocale } from '../../src/i18n/useLocale';
import { displayCategoryName } from '../../src/i18n/categoryName';
import { displayWalletName } from '../../src/i18n/walletName';
import { displayGoalName } from '../../src/i18n/goalName';

export default function NhapVao() {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  // v3.146 — refs cho auto-scroll xuống category section sau khi auto fill.
  //   Cache y-offset của anchor qua onLayout thay vì measureLayout (Fabric không hỗ trợ).
  const scrollRef = useRef<ScrollView>(null);
  const categoryYRef = useRef(0);
  // v3.146 — Ref guard chống double-submit race: state setSubmitting là async,
  //   2 tap nhanh có thể vượt qua check `if (submitting) return` trước khi state cập nhật.
  const submittingRef = useRef(false);
  const [voiceText, setVoiceText] = useState('');

  const categories = useStore((s) => s.categories);
  const settings = useStore((s) => s.settings);
  const wallets = useStore((s) => s.wallets);
  const transactions = useStore((s) => s.transactions);
  const addTransaction = useStore((s) => s.addTransaction);
  const loadCategories = useStore((s) => s.loadCategories);
  const lastStreakDelta = useStore((s) => s.lastStreakDelta);
  const clearStreakDelta = useStore((s) => s.clearStreakDelta);
  const currentBookId = useStore((s) => s.currentBookId);
  useLocale(); // Re-render khi đổi ngôn ngữ
  const palette = useTheme();
  // v3.121 — Memoize, tránh re-filter mỗi render (mỗi keystroke ở amount/note trigger rerender)
  const filteredCats = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);
  const [walletId, setWalletId] = useState<number | null>(null);
  const [suggestion, setSuggestion] = useState<{ category_id: number; confidence: number } | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [showSafeDetail, setShowSafeDetail] = useState(false);
  // v3.23 + v3.27 Active Savings
  const [allocatedToday, setAllocatedToday] = useState<number>(0);
  const [allocatedGoalLabel, setAllocatedGoalLabel] = useState<string>('');
  const [unusedAutoYesterday, setUnusedAutoYesterday] = useState<number>(0);
  // v3.37 — F9 Cool-down
  const [cooldownPending, setCooldownPending] = useState<{
    amount: number;
    catName: string;
    note: string;
  } | null>(null);
  // v3.58 — Tránh double-tap submit
  const [submitting, setSubmitting] = useState(false);
  // v3.66 — Month-end review modal
  const [monthReviewData, setMonthReviewData] = useState<MonthReviewData | null>(null);
  const [monthReviewGoals, setMonthReviewGoals] = useState<SavingsGoal[]>([]);
  const [monthReviewVisible, setMonthReviewVisible] = useState(false);

  // v3.77 — Refresh streak khi focus tab (cho phép DEV test pet stages từ settings/advanced)
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const s = await getStreak(new Date(), currentBookId);
          setStreak(s);
        } catch {
          /* noop */
        }
      })();
    }, [])
  );

  // F10 — load bills cho safe-to-spend
  // F6 — load streak cho badge
  // v3.27 — load today's allocation snapshot + yesterday's auto-processed unused
  // v3.65 — L5: deps đổi từ `[transactions]` → `[transactions.length]` để KHÔNG reload mỗi lần update field TX cũ
  useEffect(() => {
    (async () => {
      try {
        const todayStr = todayISO();
        const d = new Date();
        d.setDate(d.getDate() - 1);
        // v3.146 — Dùng localDateISO thay vì toISOString để tránh lệch ngày khi UTC khác local
        const yestStr = localDateISO(d);
        const [b, s, todaySnap, yestSnap, goals] = await Promise.all([
          getBills(currentBookId),
          getStreak(new Date(), currentBookId),
          getSnapshot(todayStr),
          getSnapshot(yestStr),
          getSavingsGoals(currentBookId),
        ]);
        setBills(b);
        setStreak(s);
        const allocated = todaySnap?.auto_allocated ?? 0;
        setAllocatedToday(allocated);
        if (allocated > 0) {
          const activeGoals = goals.filter((g) => !g.completed_at);
          if (activeGoals.length === 1) {
            setAllocatedGoalLabel(`"${activeGoals[0].name}"`);
          } else if (activeGoals.length > 1) {
            setAllocatedGoalLabel(t('input.allocGoalsCount', { n: activeGoals.length }));
          }
        }
        // Hôm qua đã được auto-process dư bao nhiêu (manual_added giờ chứa số tự cộng)
        setUnusedAutoYesterday(yestSnap?.manual_added ?? 0);
      } catch {
        /* noop */
      }
    })();
  }, [transactions.length, currentBookId]);

  // v3.66 — Detect month-end review (ngày >= 28 + tháng có TX + chưa review)
  useEffect(() => {
    (async () => {
      try {
        const { show, monthStr } = await shouldShowMonthReview(new Date(), transactions);
        if (!show) return;
        const data = await computeMonthReview(transactions, monthStr, currentBookId);
        const goals = await getSavingsGoals(currentBookId);
        setMonthReviewData(data);
        setMonthReviewGoals(goals);
        // Defer 800ms để không show ngay khi user vừa nhập TX (tránh gián đoạn)
        setTimeout(() => setMonthReviewVisible(true), 800);
      } catch (e) {
        console.warn('[monthReview] detect fail:', e);
      }
    })();
  }, [transactions.length, currentBookId]);

  // F6 — hiện toast khi unlock badge mới hoặc dùng freeze pass
  useEffect(() => {
    if (!lastStreakDelta) return;
    const d = lastStreakDelta;
    if (d.newBadge !== null) {
      const info = badgeLabel(d.newBadge);
      notify(t('streak.badgeUnlock', { emoji: info.emoji, name: info.name, days: d.currentStreak }));
    } else if (d.usedFreezePass) {
      notify(t('streak.freezeActivated', { days: d.currentStreak }));
    } else if (d.currentStreak > d.previousStreak && d.currentStreak > 1) {
      notify(t('streak.dailyToast', { days: d.currentStreak }));
    }
    clearStreakDelta();
  }, [lastStreakDelta, clearStreakDelta]);

  const cycleConfig = parseSalaryCycleFromSettings(settings);
  const safeToSpend = computeSafeToSpend(transactions, bills, new Date(), cycleConfig);

  // Auto-pick default wallet khi wallets load lần đầu
  useEffect(() => {
    if (walletId === null && wallets.length > 0) {
      const def = wallets.find((w) => w.is_default === 1) || wallets[0];
      setWalletId(def.id);
    }
  }, [wallets, walletId]);

  // F47 — Smart suggest category khi user gõ note (debounce 350ms)
  useEffect(() => {
    if (!note.trim() || categoryId) {
      setSuggestion(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const sug = await suggestCategoryFromNote(note, type);
        setSuggestion(sug);
      } catch {
        setSuggestion(null);
      }
    }, NOTE_SUGGEST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [note, type, categoryId]);

  async function submit() {
    if (submittingRef.current || submitting) return; // v3.146 — ref guard race-safe
    const n = parseInt(amount.replace(/\D/g, ''), 10);
    if (!n || n <= 0) return notify(t('input.err.noAmount'));
    if (!categoryId) return notify(t('input.err.noCategory'));
    if (!walletId) return notify(t('input.err.noWallet'));
    Keyboard.dismiss();

    // v3.37 — Cool-down check: chi > ngưỡng cho category "tiêu vào quá tay"
    // v3.120 — Check theo column is_impulse, user có thể bật/tắt category bất kỳ
    const cooldownEnabled = settings.cooldown_enabled !== '0'; // default ON
    const threshold = parseInt(settings.cooldown_threshold || String(DEFAULT_COOLDOWN_THRESHOLD), 10);
    const cat = categories.find((c) => c.id === categoryId);
    if (
      cooldownEnabled &&
      type === 'expense' &&
      n >= threshold &&
      cat &&
      cat.is_impulse === 1
    ) {
      setCooldownPending({ amount: n, catName: cat.name, note: note.trim() });
      return;
    }
    await doSubmit(n);
  }

  async function doSubmit(n: number) {
    if (!categoryId || !walletId) return;
    if (submittingRef.current) return; // v3.146 — ref guard sync, không bị race
    submittingRef.current = true;
    setSubmitting(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await addTransaction({ amount: n, category_id: categoryId, note, type, date, wallet_id: walletId, photo_uri: photoUri });
      if (note.trim()) {
        try {
          await learnCategoryPattern(note, categoryId);
        } catch {
          /* noop */
        }
      }
      setAmount('');
      setNote('');
      setCategoryId(null);
      setSuggestion(null);
      setPhotoUri(null);
      notify(
        t('input.recorded', {
          type: type === 'expense' ? t('input.type.expense') : t('input.type.income'),
          amount: formatNumber(n),
        })
      );
    } catch (e: any) {
      // v3.57 — Catch lỗi từ store guard (vd date tương lai)
      notify(e?.message || t('input.err.saveFailed'));
    } finally {
      // v3.146 — Luôn reset cả ref + state để guard mở lại cho lần submit tiếp
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // v3.79 — Guard chống bấm spam pick/take photo (mỗi lần bấm nhanh chồng picker → đơ).
  // Đồng thời check permission từ cache (getMediaLibraryPermissionsAsync) trước khi request,
  // tránh round-trip OS permission check làm delay 2-3s mỗi lần.
  const pickingRef = useRef(false);

  async function pickPhoto() {
    if (pickingRef.current) return;
    pickingRef.current = true;
    try {
      let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') {
          return notify(t('input.err.libPermission'));
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets.length > 0) {
        // v3.121 — Resize 800px width + jpeg 0.7 để file lưu nhẹ (~50-150KB thay vì 2-5MB)
        const resized = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        setPhotoUri(resized.uri);
      }
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
        if (perm.status !== 'granted') {
          return notify(t('input.err.camPermission'));
        }
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets.length > 0) {
        const resized = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        setPhotoUri(resized.uri);
      }
    } finally {
      pickingRef.current = false;
    }
  }

  /** v3.146 — Scroll mượt xuống section "Danh mục" với offset header sticky.
   *   Dùng y-offset đã cache qua onLayout, tránh measureLayout (Fabric không tương thích).
   */
  function scrollToCategorySection() {
    const sv = scrollRef.current;
    if (!sv) return;
    const targetY = Math.max(0, categoryYRef.current - 16);
    setTimeout(() => {
      try {
        sv.scrollTo({ y: targetY, animated: true });
      } catch {
        /* noop */
      }
    }, 80);
  }

  async function tryVoiceParse() {
    if (autoFilling) return;
    if (!voiceText.trim()) return notify(t('err.voiceTextRequired'));

    setAutoFilling(true);
    Keyboard.dismiss();

    try {
      // 100% LOCAL parse — không gọi API, không tốn quota
      const localAmount = parseAmountLocal(voiceText);
      const localType = detectTypeLocal(voiceText);
      const localNote = extractNoteLocal(voiceText);
      let localCatId: number | null = null;
      if (localNote) {
        if (localType === 'income') {
          const incomeMap: Record<string, string> = {
            'lương': 'Lương',
            'luong': 'Lương',
            'salary': 'Lương',
            'thưởng': 'Thưởng',
            'thuong': 'Thưởng',
            'bonus': 'Thưởng',
            'tip': 'Thưởng',
            'tips': 'Thưởng',
          };
          const noteLower = localNote.toLowerCase();
          for (const [kw, catName] of Object.entries(incomeMap)) {
            if (noteLower.includes(kw)) {
              const cat = categories.find((c) => c.name === catName && c.type === 'income');
              if (cat) {
                localCatId = cat.id;
                break;
              }
            }
          }
        }
        if (!localCatId) {
          const sug = await suggestCategoryFromNote(localNote, localType);
          if (sug && sug.confidence > 0.4) {
            const cat = categories.find((c) => c.id === sug.category_id);
            if (cat && cat.type === localType) localCatId = cat.id;
          }
        }
      }

      if (!localAmount) {
        notify(t('input.err.parseFailed'));
        return;
      }

      // Fill form từ local parse
      setType(localType);
      setAmount(String(localAmount));
      setNote(localNote || '');
      setVoiceText('');
      if (Platform.OS !== 'web') Haptics.selectionAsync();

      if (localCatId) {
        const cat = categories.find((c) => c.id === localCatId);
        setCategoryId(localCatId);
        notify(
          cat
            ? t('input.filledWithCat', { amount: formatNumber(localAmount), cat: displayCategoryName(cat) })
            : t('input.filledNoCat', { amount: formatNumber(localAmount) })
        );
      } else {
        setCategoryId(null);
        notify(t('input.filledNoCat', { amount: formatNumber(localAmount) }));
      }

      // Scroll xuống category section để user kiểm tra / chọn
      scrollToCategorySection();
    } finally {
      setAutoFilling(false);
    }
  }

  const displayAmount = amount
    ? formatNumber(parseInt(amount.replace(/\D/g, ''), 10) || 0)
    : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* v3.45 — Sticky header: title + streak pill yên trên khi cuộn */}
      <View style={styles.stickyHeader}>
        <Text style={styles.title}>
          {type === 'expense' ? t('input.title.expense') : t('input.title.income')}
        </Text>
        {streak ? <StreakBadge streak={streak} /> : null}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.container, { paddingBottom: 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* F10 + v3.27 — Số dư an toàn hôm nay + auto unused yesterday */}
        {/* v3.97 — Card hôm nay full width + thanh "Mai dự kiến" full width mỏng phía dưới */}
        <View style={{ marginTop: 10 }}>
          <SafeToSpendCard
            data={safeToSpend}
            expanded={showSafeDetail}
            onTapDetail={() => setShowSafeDetail((v) => !v)}
            allocatedToday={allocatedToday}
            allocatedGoalLabel={allocatedGoalLabel}
            unusedAutoYesterday={unusedAutoYesterday}
          />
          {/* v3.98 — Chỉ hiện thanh khi user đã xài quá quota hôm nay (âm tiền) */}
          {safeToSpend.tomorrowAmount !== null &&
          safeToSpend.tomorrowAmount > 0 &&
          safeToSpend.safeAmount !== null &&
          safeToSpend.todayExpense > safeToSpend.safeAmount ? (
            <View style={[styles.tomorrowBar, { backgroundColor: palette.primaryLight, borderColor: palette.primary + '40' }]}>
              <Icon name="CalendarDays" size={14} color={palette.primary} />
              <Text style={[styles.tomorrowBarLabel, { color: palette.primary }]}>{t('input.tomorrowReset')}</Text>
              <Text style={[styles.tomorrowBarAmount, { color: palette.primaryDark }]}>
                {formatNumber(safeToSpend.tomorrowAmount)}đ
              </Text>
            </View>
          ) : null}
        </View>

        {/* Smart quick input */}
        <View style={[styles.voiceBox, { backgroundColor: palette.primaryLight, borderColor: palette.primary + '40' }]}>
          <View style={styles.voiceHead}>
            <Icon name="Sparkles" size={16} color={palette.primary} />
            <Text style={[styles.voiceTitle, { color: palette.primary }]}>{t('input.quickInput')}</Text>
          </View>
          <TextInput
            style={[styles.voiceInput, { borderColor: palette.primary + '30' }]}
            placeholder={t('input.quickPlaceholder')}
            placeholderTextColor="#9ca3af"
            value={voiceText}
            onChangeText={setVoiceText}
            onSubmitEditing={tryVoiceParse}
          />
          <TouchableOpacity
            style={[styles.voiceBtn, { backgroundColor: palette.primary }, autoFilling && { opacity: 0.6 }]}
            onPress={tryVoiceParse}
            disabled={autoFilling}
            activeOpacity={0.85}
          >
            <Text style={styles.voiceBtnText}>{autoFilling ? t('input.autoFilling') : t('input.autoFill')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.typeTabs}>
          <TouchableOpacity
            style={[styles.typeTab, type === 'expense' && styles.typeTabActive]}
            onPress={() => {
              setType('expense');
              setCategoryId(null);
            }}
          >
            <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>{t('input.tab.expense')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeTab, type === 'income' && styles.typeTabActive]}
            onPress={() => {
              setType('income');
              setCategoryId(null);
            }}
          >
            <Text style={[styles.typeText, type === 'income' && styles.typeTextActive]}>{t('input.tab.income')}</Text>
          </TouchableOpacity>
        </View>

        {wallets.length > 1 ? (
          <>
            <Text style={styles.label}>{t('input.wallet')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.walletRow}>
              {wallets.map((w) => {
                const selected = walletId === w.id;
                return (
                  <TouchableOpacity
                    key={w.id}
                    style={[
                      styles.walletPill,
                      selected && { borderColor: w.color, borderWidth: 2, backgroundColor: w.color + '15' },
                    ]}
                    onPress={() => setWalletId(w.id)}
                  >
                    <Icon name={w.icon} size={14} color={selected ? w.color : '#6b7280'} />
                    <Text
                      style={[styles.walletPillText, selected && { color: w.color, fontWeight: '700' }]}
                      numberOfLines={1}
                    >
                      {displayWalletName(w)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        <DatePickerField value={date} onChange={setDate} label={t('input.date')} maxDate={todayISO()} todayISO={todayISO()} />

        <Text style={styles.label}>{t('input.amount')}</Text>
        <View style={styles.amountRow}>
          <TextInput
            style={styles.amountInput}
            value={displayAmount}
            onChangeText={(v) => setAmount(v.replace(/\D/g, ''))}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#9ca3af"
          />
          <Text style={styles.currency}>đ</Text>
        </View>

        <Text style={styles.label}>{t('input.note')}</Text>
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={setNote}
          placeholder={t('input.notePlaceholder')}
          placeholderTextColor="#9ca3af"
        />

        {/* F35 Photo attachment */}
        <Text style={styles.label}>{t('input.photo')}</Text>
        {photoUri ? (
          <View style={styles.photoBox}>
            <Image
              source={{ uri: photoUri }}
              style={styles.photoThumb}
              resizeMode="cover"
              onError={() => {
                // v3.65 — M3: file ảnh bị xoá khỏi gallery → clear state để KHÔNG render image trống
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
              <Text style={[styles.photoBtnText, { color: palette.primary }]}>{t('input.takePhoto')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
              <Icon name="ImageIcon" size={16} color={palette.primary} />
              <Text style={[styles.photoBtnText, { color: palette.primary }]}>{t('input.pickPhoto')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* F47 Suggestion pill */}
        {/* v3.64 — H4 fix: chỉ hiện khi confidence > 0.4 (tránh suggestion noise yếu) */}
        {suggestion && suggestion.confidence > 0.4 ? (() => {
          const sugCat = categories.find((c) => c.id === suggestion.category_id);
          if (!sugCat) return null;
          return (
            <TouchableOpacity
              style={[styles.suggestion, { backgroundColor: sugCat.color + '15', borderColor: sugCat.color }]}
              onPress={() => {
                setCategoryId(sugCat.id);
                setSuggestion(null);
              }}
            >
              <Icon name="Sparkles" size={14} color={sugCat.color} />
              <Text style={styles.suggestionLabel}>{t('input.suggestion')}</Text>
              <View style={[styles.suggestionIconBox, { backgroundColor: sugCat.color + '30' }]}>
                <Icon name={sugCat.icon} size={14} color={sugCat.color} />
              </View>
              <Text style={[styles.suggestionName, { color: sugCat.color }]}>{displayCategoryName(sugCat)}</Text>
              <Text style={styles.suggestionTap}>{t('input.suggestionTap')}</Text>
            </TouchableOpacity>
          );
        })() : null}

        <View
          collapsable={false}
          onLayout={(e) => {
            categoryYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.label}>{t('input.category')}</Text>
        </View>
        {filteredCats.length === 0 ? (
          <View style={styles.emptyCatBox}>
            <Icon name="AlertCircle" size={20} color="#f59e0b" />
            <Text style={styles.emptyCatText}>{t('input.emptyCat')}</Text>
            <TouchableOpacity
              style={styles.reloadBtn}
              onPress={async () => {
                try {
                  await loadCategories();
                  notify(t('input.loadedCats', { n: useStore.getState().categories.length }));
                } catch (e: any) {
                  notify(t('common.errorPrefix', { msg: e?.message || 'unknown' }));
                }
              }}
            >
              <Icon name="RotateCcw" size={14} color="#fff" />
              <Text style={styles.reloadBtnText}>{t('input.reloadCat')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
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
                  onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
                >
                  <View style={[styles.catIconBox, { backgroundColor: c.color + '20' }]}>
                    <Icon name={c.icon} size={22} color={c.color} strokeWidth={2} />
                  </View>
                  <Text style={styles.catName} numberOfLines={1}>
                    {displayCategoryName(c)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* Sticky submit button — luôn hiển thị cuối màn, không phải cuộn */}
      <View style={styles.stickyFooter}>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: type === 'expense' ? palette.expense : palette.income, opacity: submitting ? 0.6 : 1 },
          ]}
          onPress={submit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>
            {type === 'expense' ? t('input.submit.expense') : t('input.submit.income')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* v3.37 F9 — Cool-down 5 giây cho chi tiêu lớn */}
      <CoolDownModal
        visible={!!cooldownPending}
        amount={cooldownPending?.amount ?? 0}
        categoryName={cooldownPending?.catName ?? ''}
        note={cooldownPending?.note}
        onProceed={() => {
          const pending = cooldownPending;
          setCooldownPending(null);
          if (pending) doSubmit(pending.amount);
        }}
        onCancel={() => setCooldownPending(null)}
      />

      {/* v3.66 — Month-end review modal */}
      <MonthReviewModal
        visible={monthReviewVisible}
        data={monthReviewData}
        goals={monthReviewGoals}
        onApply={async (goalId, amount) => {
          try {
            await addToSavingsGoal(goalId, amount);
            if (monthReviewData) await markMonthReviewDone(monthReviewData.monthStr);
            const goal = monthReviewGoals.find((g) => g.id === goalId);
            notify(t('goals.toastAdded', { amount: formatNumber(amount), name: goal ? displayGoalName(goal) : t('goals.fundGeneral') }));
          } catch (e) {
            console.warn('[monthReview] apply fail:', e);
          } finally {
            setMonthReviewVisible(false);
          }
        }}
        onSkip={async () => {
          if (monthReviewData) await markMonthReviewDone(monthReviewData.monthStr);
          setMonthReviewVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20, paddingTop: 0, paddingBottom: 40 },
  // v3.45 — Sticky header: title + streak pill yên trên top khi cuộn
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    zIndex: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  // v3.99 — Thanh "Dự kiến sử dụng ngày mai", spacing đều cả trên + dưới
  tomorrowBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 6,
  },
  tomorrowBarLabel: { fontSize: 12, fontWeight: '700', flex: 1 },
  tomorrowBarAmount: { fontSize: 15, fontWeight: '800' },
  voiceBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    marginBottom: 10,
  },
  voiceHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  voiceTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  voiceInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    marginBottom: 10,
    // v3.45 — Fix font spacing kỳ lạ (letter giãn rộng) khi reset DB
    letterSpacing: 0,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  voiceBtn: { padding: 12, borderRadius: 10, alignItems: 'center' },
  voiceBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    marginTop: 8,
    marginBottom: 4,
  },
  suggestionLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  suggestionIconBox: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  suggestionName: { flex: 1, fontSize: 13, fontWeight: '700' },
  suggestionTap: { fontSize: 10, color: '#9ca3af', fontWeight: '500', fontStyle: 'italic' },
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typeText: { color: '#6b7280', fontWeight: '600', fontSize: 14 },
  typeTextActive: { color: '#111827' },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
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
  amountInput: { flex: 1, padding: 8, fontSize: 22, fontWeight: '700', color: '#111827' },
  currency: { fontSize: 18, fontWeight: '700', color: '#6b7280' },
  // v3.95 — catGrid căn đều 2 bên (justifyContent space-between thay vì gap), width 32%
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  catItem: {
    width: '32%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 84,
    justifyContent: 'center',
  },
  catIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  catName: { fontSize: 11, color: '#374151', textAlign: 'center', fontWeight: '600' },
  emptyCatBox: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    gap: 10,
  },
  emptyCatText: { fontSize: 13, color: '#92400e', textAlign: 'center', lineHeight: 18 },
  reloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  reloadBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  submitBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
});
