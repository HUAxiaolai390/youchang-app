import type {
  AppState,
  CatDecor,
  CatGrowthProgress,
  CatOutfit,
  CatRoom,
  CatSpecialAction
} from "./types";

export const catExperiencePerLevel = 280;
export const catMaximumLevel = 10;
export const catTaskExperience = 12;
export const catFocusExperience = 20;
export const catTimeBlockExperience = 5;
export const catTimeBlockMinutes = 30;

export type CatRewardSlot = "outfit" | "decor" | "specialAction" | "room";
export type CatRewardItem =
  | { slot: "outfit"; value: CatOutfit; label: string }
  | { slot: "decor"; value: CatDecor; label: string }
  | { slot: "specialAction"; value: CatSpecialAction; label: string }
  | { slot: "room"; value: CatRoom; label: string };

export type CatLevelReward = {
  level: number;
  name: string;
  description: string;
  icon: string;
  items: CatRewardItem[];
};

export const catLevelRewards: CatLevelReward[] = [
  { level: 1, name: "初来有常", description: "默认小猫和基础房间", icon: "初", items: [] },
  { level: 2, name: "元气领巾", description: "解锁温暖领巾", icon: "巾", items: [{ slot: "outfit", value: "scarf", label: "佩戴领巾" }] },
  { level: 3, name: "毛线伙伴", description: "解锁毛线球摆件", icon: "球", items: [{ slot: "decor", value: "yarn-ball", label: "摆放毛线球" }] },
  { level: 4, name: "好运击掌", description: "点击小猫触发击掌互动", icon: "掌", items: [{ slot: "specialAction", value: "high-five", label: "使用击掌动作" }] },
  { level: 5, name: "暖暖小窝", description: "解锁猫咪软垫", icon: "窝", items: [{ slot: "decor", value: "cushion", label: "摆放软垫" }] },
  { level: 6, name: "星星帽", description: "解锁星星帽装扮", icon: "星", items: [{ slot: "outfit", value: "star-hat", label: "佩戴星星帽" }] },
  { level: 7, name: "开心转圈", description: "点击小猫触发开心转圈", icon: "转", items: [{ slot: "specialAction", value: "happy-spin", label: "使用转圈动作" }] },
  { level: 8, name: "月光小灯", description: "解锁月亮小灯摆件", icon: "灯", items: [{ slot: "decor", value: "moon-lamp", label: "摆放月亮灯" }] },
  { level: 9, name: "有常皇冠", description: "解锁成长皇冠", icon: "冠", items: [{ slot: "outfit", value: "crown", label: "佩戴皇冠" }] },
  {
    level: 10,
    name: "星光相伴",
    description: "解锁星空房间和特别庆祝动作",
    icon: "伴",
    items: [
      { slot: "room", value: "starry-room", label: "使用星空房间" },
      { slot: "specialAction", value: "star-celebration", label: "使用星光庆祝" }
    ]
  }
];

export const defaultCatGrowthProgress: CatGrowthProgress = {
  experience: 0,
  rewardedCompletionIds: [],
  rewardedFocusSessions: 0,
  rewardedTimeBlocks: 0
};

function completedIds(state: AppState): string[] {
  return [
    ...state.fixedRecords.filter((record) => record.completedAt).map((record) => `fixed:${record.id}`),
    ...state.scheduledTasks.filter((task) => task.status === "completed").map((task) => `scheduled:${task.id}`)
  ];
}

function totalTrackedMinutes(state: AppState): number {
  return state.fixedRecords.reduce((sum, record) => sum + (record.actualMinutes ?? 0), 0)
    + state.scheduledTasks.reduce((sum, task) => sum + (task.actualMinutes ?? 0), 0)
    + (state.timeEntries ?? []).reduce((sum, entry) => sum + entry.minutes, 0);
}

export function calculateCatGrowthProgress(state: AppState): CatGrowthProgress {
  const current = state.catGrowth ?? defaultCatGrowthProgress;
  const rewardedIds = new Set(current.rewardedCompletionIds);
  const newCompletionIds = completedIds(state).filter((id) => !rewardedIds.has(id));
  const completedSessions = state.focus?.completedSessions ?? 0;
  const newFocusSessions = Math.max(0, completedSessions - current.rewardedFocusSessions);
  const timeBlocks = Math.floor(totalTrackedMinutes(state) / catTimeBlockMinutes);
  const newTimeBlocks = Math.max(0, timeBlocks - current.rewardedTimeBlocks);

  return {
    ...current,
    experience: current.experience
      + newCompletionIds.length * catTaskExperience
      + newFocusSessions * catFocusExperience
      + newTimeBlocks * catTimeBlockExperience,
    rewardedCompletionIds: [...current.rewardedCompletionIds, ...newCompletionIds],
    rewardedFocusSessions: Math.max(current.rewardedFocusSessions, completedSessions),
    rewardedTimeBlocks: Math.max(current.rewardedTimeBlocks, timeBlocks)
  };
}

export function syncCatGrowth(state: AppState): AppState {
  return { ...state, catGrowth: calculateCatGrowthProgress(state) };
}

export function getCatLevel(experience: number): number {
  return Math.min(catMaximumLevel, Math.floor(Math.max(0, experience) / catExperiencePerLevel) + 1);
}

export function getCatLevelExperience(experience: number): number {
  if (getCatLevel(experience) >= catMaximumLevel) return catExperiencePerLevel;
  return Math.max(0, experience) % catExperiencePerLevel;
}

export function getCatCustomization(state: AppState) {
  const progress = calculateCatGrowthProgress(state);
  return {
    outfit: progress.outfit,
    decor: progress.decor,
    specialAction: progress.specialAction,
    room: progress.room
  };
}

export function equipCatReward(state: AppState, item: CatRewardItem): AppState {
  const synced = syncCatGrowth(state);
  const progress = synced.catGrowth!;
  const level = getCatLevel(progress.experience);
  const unlocked = catLevelRewards.some((reward) => reward.level <= level
    && reward.items.some((candidate) => candidate.slot === item.slot && candidate.value === item.value));
  if (!unlocked) return synced;

  return {
    ...synced,
    catGrowth: {
      ...progress,
      [item.slot]: progress[item.slot] === item.value ? undefined : item.value
    }
  };
}
