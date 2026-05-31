// v3.82 — Streak screen full-page (native iOS modal sheet).
// Trước đây dùng <Modal> + PanResponder → khựng. Chuyển sang expo-router Stack
// với presentation='modal' → iOS native UIModalPresentationFormSheet, pull-down mượt.
// Cũng bỏ hero box sticky theo yêu cầu đại ca (pet đã hiển thị info, không trùng lặp).
import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  TextInput,
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { StatBox } from '../../src/components/StatBox';
import { PetView } from '../../src/components/PetView';
import {
  getStreak,
  StreakState,
  weekDays,
  activeDateSet,
  createdAtLocalDate,
} from '../../src/services/streak';
import { getSavingsGoals } from '../../src/db';
import {
  getPetStage,
  getStageProgress,
  PET_TASKS,
  computeMaturityPoints,
} from '../../src/services/petStages';
import { useStore } from '../../src/store/useStore';
import { useT } from '../../src/i18n/useT';
import { t } from '../../src/i18n';

const WEEK_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// v3.88 — Stage 1 (lửa Hạt giống) bé hơn rõ vs stage 2.
// Lửa=120, Bé con=180, Tinh nghịch=230, Trưởng thành=280, Huyền thoại=320
// v3.103 — Clamp theo screen width để stage 5 không overflow trên iPhone SE/mini (≤360dp).
function getPetSize(level: 1 | 2 | 3 | 4 | 5): number {
  const base = [120, 180, 230, 280, 320][level - 1] ?? 180;
  const screenW = Dimensions.get('window').width;
  // Pet + 40px buffer cho ground oval + horizontal padding container
  const maxPet = Math.max(120, screenW - 80);
  return Math.min(base, maxPet);
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function StreakScreen() {
  useT();
  const router = useRouter();
  const transactions = useStore((s) => s.transactions);
  const settings = useStore((s) => s.settings);
  const updateSetting = useStore((s) => s.updateSetting);
  const currentBookId = useStore((s) => s.currentBookId);

  const [streak, setStreak] = useState<StreakState | null>(null);
  const [goalsCompletedCount, setGoalsCompletedCount] = useState(0);
  const [renamingPet, setRenamingPet] = useState(false);
  const [petNameDraft, setPetNameDraft] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getStreak(new Date(), currentBookId).then((s) => {
        if (!cancelled) setStreak(s);
      });
      // v3.100 — Fix #11: Query goals thực thay vì badges.length proxy
      // v3.107 — Pass currentBookId để chỉ đếm goal của book hiện tại (tránh cross-book leak)
      getSavingsGoals(currentBookId).then((goals) => {
        if (!cancelled) {
          const completed = goals.filter((g) => g.completed_at !== null).length;
          setGoalsCompletedCount(completed);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [currentBookId])
  );

  const display = streak?.displayStreak ?? 0;
  const petStage = useMemo(() => getPetStage(display), [display]);
  const stageProgress = useMemo(() => getStageProgress(display), [display]);

  const txDateList = useMemo(
    () => transactions.map((t) => createdAtLocalDate(t.created_at)),
    [transactions]
  );
  const today = useMemo(() => todayStr(), []);
  const weekArr = useMemo(() => weekDays(), []);
  const activeInWeek = useMemo(
    () => activeDateSet(txDateList, weekArr[0], weekArr[6]),
    [txDateList, weekArr]
  );

  const taskContext = useMemo(() => {
    const currentMonthStr = today.slice(0, 7);
    const hasTxToday = txDateList.includes(today);
    const hasIncomeThisMonth = transactions.some(
      (t) => t.type === 'income' && t.date.startsWith(currentMonthStr)
    );
    // v3.108 — Key namespaced theo book
    const wizardAppliedThisMonth = settings[`wizard_goal_applied_${currentBookId}_${currentMonthStr}`] === '1';
    return {
      hasTxToday,
      hasIncomeThisMonth,
      streak: display,
      goalsCompleted: goalsCompletedCount,
      wizardAppliedThisMonth,
    };
  }, [txDateList, transactions, settings, display, today, goalsCompletedCount, currentBookId]);
  const maturity = useMemo(() => computeMaturityPoints(taskContext), [taskContext]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar gọn — chỉ nút X để đóng */}
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="X" size={22} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* PET SECTION — v3.83 gọn lại: tên + stage badge cùng 1 hàng, bỏ tagline */}
        <View style={styles.petBox}>
          <PetView stage={petStage} size={getPetSize(petStage.level)} />

          <TouchableOpacity
            style={styles.petNameRow}
            onPress={() => {
              setPetNameDraft(settings.pet_name || '');
              setRenamingPet(true);
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={[
                styles.petName,
                settings.pet_name
                  ? { color: petStage.color }
                  : { color: '#9ca3af', fontStyle: 'italic', fontWeight: '600' },
              ]}
            >
              {settings.pet_name || t('streak.namePetCta')}
            </Text>
            <View style={[styles.stageBadge, { backgroundColor: petStage.color + '20' }]}>
              <Text style={[styles.stageBadgeText, { color: petStage.color }]}>{petStage.name}</Text>
            </View>
            <Icon name="Pencil" size={14} color={petStage.color} />
          </TouchableOpacity>

          {stageProgress.next !== null ? (
            <View style={styles.petProgressWrap}>
              <View style={styles.petProgressBar}>
                <View
                  style={[
                    styles.petProgressFill,
                    { width: `${stageProgress.ratio * 100}%`, backgroundColor: petStage.color },
                  ]}
                />
              </View>
              <Text style={styles.petProgressLabel}>
                {t('streak.daysProgress', { current: display, next: stageProgress.next })}
              </Text>
            </View>
          ) : (
            // v3.101 — Stage 5 (Huyền thoại) hiển thị bar 100% full + kỷ lục, không chỉ text trống
            <View style={styles.petProgressWrap}>
              <View style={styles.petProgressBar}>
                <View
                  style={[
                    styles.petProgressFill,
                    { width: '100%', backgroundColor: petStage.color },
                  ]}
                />
              </View>
              <Text style={styles.petProgressLabel}>
                {t('streak.recordPeak', { days: streak?.longestStreak ?? 0 })}
              </Text>
            </View>
          )}
        </View>

        {/* Daily tasks */}
        <Text style={styles.sectionLabel}>
          {t('streak.feedSection', { name: settings.pet_name || 'pet', earned: maturity.earned, available: maturity.available })}
        </Text>
        <View style={styles.tasksList}>
          {PET_TASKS.map((task) => {
            const done = task.isDone(taskContext);
            return (
              <View
                key={task.id}
                style={[styles.taskItem, done && { backgroundColor: petStage.color + '15' }]}
              >
                <View style={[styles.taskCheck, { backgroundColor: done ? petStage.color : '#e5e7eb' }]}>
                  {done ? <Icon name="Check" size={14} color="#fff" /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.taskLabel, done && { color: petStage.color, fontWeight: '700' }]}
                  >
                    {t(task.label)}
                  </Text>
                  <Text style={styles.taskPoints}>{t('streak.maturityPoints', { points: task.points })}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* WEEK STRIP */}
        <Text style={styles.sectionLabel}>{t('streak.thisWeek')}</Text>
        <View style={styles.weekStrip}>
          {weekArr.map((d, i) => {
            const active = activeInWeek.has(d);
            const isToday = d === today;
            const isFuture = d > today;
            return (
              <View key={d} style={styles.weekCol}>
                <Text style={[styles.weekDayLabel, isToday && styles.weekDayLabelToday]}>
                  {WEEK_LABELS[i]}
                </Text>
                <View
                  style={[
                    styles.weekDot,
                    active && styles.weekDotActive,
                    isToday && !active && styles.weekDotToday,
                    isFuture && !active && styles.weekDotFuture,
                  ]}
                >
                  {active ? (
                    <Text style={styles.weekDotIcon}>🔥</Text>
                  ) : isToday ? (
                    <Text style={styles.weekDotPending}>!</Text>
                  ) : null}
                </View>
                <Text style={[styles.weekDateNum, isToday && styles.weekDateNumToday]}>
                  {parseInt(d.slice(-2), 10)}
                </Text>
              </View>
            );
          })}
        </View>
        {!activeInWeek.has(today) ? (
          <View style={styles.tipBox}>
            <Text style={styles.tipText}>
              {t('streak.tipNoTxToday')}
            </Text>
          </View>
        ) : null}

        {/* FREEZE PASS */}
        {(streak?.freezePasses ?? 0) > 0 ? (
          <View style={[styles.tipBox, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}>
            <Text style={[styles.tipText, { color: '#1e3a8a' }]}>
              {t('streak.freezeHint', { count: streak?.freezePasses ?? 0 })}
            </Text>
          </View>
        ) : null}

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox label={t('streak.currentLabel')} value={streak?.currentStreak ?? 0} align="center" />
          <StatBox label={t('streak.recordLabel')} value={streak?.longestStreak ?? 0} align="center" />
        </View>
      </ScrollView>

      {/* Rename pet — v3.103 bọc Modal để Android back đóng + chặn pull-down gesture sheet outer */}
      <Modal
        visible={renamingPet}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setRenamingPet(false);
          setPetNameDraft('');
        }}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, styles.renameBg]}
          onPress={() => {
            setRenamingPet(false);
            setPetNameDraft('');
          }}
        >
          <Pressable style={styles.renameCard} onPress={() => {}}>
            <Text style={styles.renameTitle}>{t('streak.petRenameTitle')}</Text>
            <Text style={styles.renameDesc}>Tên gọi yêu thương, 16 ký tự</Text>
            <TextInput
              style={styles.renameInput}
              value={petNameDraft}
              onChangeText={setPetNameDraft}
              placeholder={settings.pet_name || 'vd: Mochi, Bé Sol, Bú Bú...'}
              placeholderTextColor="#9ca3af"
              maxLength={16}
              autoFocus
            />
            <View style={styles.renameBtnRow}>
              <TouchableOpacity
                style={[styles.renameBtn, { backgroundColor: '#f3f4f6' }]}
                onPress={() => {
                  setRenamingPet(false);
                  setPetNameDraft('');
                }}
              >
                <Text style={{ color: '#6b7280', fontWeight: '700' }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameBtn, { backgroundColor: petStage.color }]}
                onPress={async () => {
                  const trimmed = petNameDraft.trim();
                  if (trimmed.length > 0) {
                    await updateSetting('pet_name', trimmed);
                  }
                  setRenamingPet(false);
                  setPetNameDraft('');
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeIconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingTop: 0, paddingBottom: 32 },
  petBox: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 12,
    backgroundColor: '#fafafa',
    borderRadius: 16,
  },
  petNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  petName: { fontSize: 20, fontWeight: '800' },
  stageBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  stageBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  petProgressWrap: { marginTop: 10, width: '85%' },
  petProgressBar: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  petProgressFill: { height: 8, borderRadius: 4 },
  petProgressLabel: { fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 6, fontWeight: '600' },
  tasksList: { gap: 8, marginBottom: 16 },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
  },
  taskCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  taskLabel: { fontSize: 13, color: '#374151', fontWeight: '600' },
  taskPoints: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 12,
  },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  weekCol: { alignItems: 'center', flex: 1 },
  weekDayLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600', marginBottom: 6 },
  weekDayLabelToday: { color: '#ea580c', fontWeight: '800' },
  weekDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  weekDotActive: { backgroundColor: '#fff7ed', borderColor: '#fb923c' },
  weekDotToday: { backgroundColor: '#fffbeb', borderColor: '#fbbf24', borderStyle: 'dashed' },
  weekDotFuture: { backgroundColor: '#fafafa' },
  weekDotIcon: { fontSize: 18 },
  weekDotPending: { fontSize: 14, fontWeight: '800', color: '#d97706' },
  weekDateNum: { fontSize: 11, color: '#6b7280', marginTop: 6, fontWeight: '600' },
  weekDateNumToday: { color: '#ea580c', fontWeight: '800' },
  tipBox: {
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 10,
  },
  tipText: { fontSize: 13, color: '#92400e', lineHeight: 18, fontWeight: '500' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  // Rename pet
  renameBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  renameCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 360 },
  renameTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 4 },
  renameDesc: { fontSize: 12, color: '#6b7280', marginBottom: 14 },
  renameInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 14,
  },
  renameBtnRow: { flexDirection: 'row', gap: 8 },
  renameBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
});
