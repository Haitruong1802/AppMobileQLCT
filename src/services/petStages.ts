// v3.67 — Pet stages cho streak retention (concept Snapchat-style).
// 5 stage theo milestone streak: 1/7/30/100/365 ngày.
// Mỗi stage có icon Lucide (placeholder) + color + tagline.
// Khi đại ca có Lottie asset thật → swap path trong PetView component.

export type PetStage = {
  level: 1 | 2 | 3 | 4 | 5;
  /** Streak ngày tối thiểu để đạt stage này. */
  minStreak: number;
  /** Streak ngày tối thiểu để đạt stage TIẾP THEO. null = max level. */
  nextStreak: number | null;
  /** Tên stage hiển thị. */
  name: string;
  /** Emoji character (v3.71 — visual primary). */
  emoji: string;
  /** Lucide icon fallback. */
  icon: string;
  /** Hex color theme cho card/progress. */
  color: string;
  /** Tagline mô tả ngắn. */
  tagline: string;
};

// v3.71 — Dùng emoji character (animal evolution) thay vì Lucide ráp xấu
// name/tagline lưu i18n key — UI tự resolve qua t() để follow locale.
export const PET_STAGES: PetStage[] = [
  {
    level: 1,
    minStreak: 0,
    nextStreak: 7,
    name: 'pet.stage.seed.name',
    emoji: '🥚',
    icon: 'Sparkles',
    color: '#a3e635',
    tagline: 'pet.stage.seed.tagline',
  },
  {
    level: 2,
    minStreak: 7,
    nextStreak: 30,
    name: 'pet.stage.baby.name',
    emoji: '🐣',
    icon: 'Heart',
    color: '#fbbf24',
    tagline: 'pet.stage.baby.tagline',
  },
  {
    level: 3,
    minStreak: 30,
    nextStreak: 100,
    name: 'pet.stage.playful.name',
    emoji: '🦊',
    icon: 'Flame',
    color: '#f97316',
    tagline: 'pet.stage.playful.tagline',
  },
  {
    level: 4,
    minStreak: 100,
    nextStreak: 365,
    name: 'pet.stage.adult.name',
    emoji: '🐺',
    icon: 'Crown',
    color: '#a855f7',
    tagline: 'pet.stage.adult.tagline',
  },
  {
    level: 5,
    minStreak: 365,
    nextStreak: null,
    name: 'pet.stage.legend.name',
    emoji: '🐉',
    icon: 'Award',
    // v3.85 — đổi từ gold #fbbf24 → red #dc2626 để pet đỏ rực rõ khác stage 2 (vàng)
    color: '#dc2626',
    tagline: 'pet.stage.legend.tagline',
  },
];

/** Trả về pet stage hiện tại theo streak. */
export function getPetStage(streak: number): PetStage {
  for (let i = PET_STAGES.length - 1; i >= 0; i--) {
    if (streak >= PET_STAGES[i].minStreak) return PET_STAGES[i];
  }
  return PET_STAGES[0];
}

/** Tính progress 0-1 đến stage tiếp theo. */
export function getStageProgress(streak: number): {
  current: number;
  next: number | null;
  ratio: number;
} {
  const stage = getPetStage(streak);
  if (stage.nextStreak === null) {
    return { current: stage.minStreak, next: null, ratio: 1 };
  }
  const range = stage.nextStreak - stage.minStreak;
  const done = streak - stage.minStreak;
  return {
    current: stage.minStreak,
    next: stage.nextStreak,
    ratio: Math.max(0, Math.min(1, done / range)),
  };
}

export type PetTask = {
  id: string;
  label: string;
  points: number;
  /** Hàm check task done dựa trên data. */
  isDone: (ctx: PetTaskContext) => boolean;
};

export type PetTaskContext = {
  /** Có TX hôm nay không (theo created_at). */
  hasTxToday: boolean;
  /** Có TX income trong tháng không. */
  hasIncomeThisMonth: boolean;
  /** Streak hiện tại. */
  streak: number;
  /** Tổng số goals completed (lifetime). */
  goalsCompleted: number;
  /** Đã apply Wizard tháng này. */
  wizardAppliedThisMonth: boolean;
};

/** Daily/recurring tasks để kiếm "điểm trưởng thành" — gamification light.
 *  Label dùng i18n key — UI tự resolve qua t() để follow locale. */
export const PET_TASKS: PetTask[] = [
  {
    id: 'tx-today',
    label: 'streak.task.txToday',
    points: 1,
    isDone: (c) => c.hasTxToday,
  },
  {
    id: 'income-month',
    label: 'streak.task.incomeMonth',
    points: 2,
    isDone: (c) => c.hasIncomeThisMonth,
  },
  {
    id: 'wizard-month',
    label: 'streak.task.wizardMonth',
    points: 3,
    isDone: (c) => c.wizardAppliedThisMonth,
  },
  {
    id: 'streak-7',
    label: 'streak.task.streak7',
    points: 5,
    isDone: (c) => c.streak >= 7,
  },
  {
    id: 'goal-complete',
    label: 'streak.task.goalComplete',
    points: 10,
    isDone: (c) => c.goalsCompleted >= 1,
  },
];

/** Tính tổng điểm done từ task list. */
export function computeMaturityPoints(ctx: PetTaskContext): {
  done: number;
  total: number;
  earned: number;
  available: number;
} {
  let done = 0;
  let earned = 0;
  let available = 0;
  for (const t of PET_TASKS) {
    available += t.points;
    if (t.isDone(ctx)) {
      done++;
      earned += t.points;
    }
  }
  return { done, total: PET_TASKS.length, earned, available };
}
