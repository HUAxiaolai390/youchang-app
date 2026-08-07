import { fromDateKey, getWeek, toDateKey } from "./date";
import { getFocusProgress } from "./focus";
import { getDayStat, getLongestStreak, getTotalCompleted } from "./stats";
import type { AppState, DateKey } from "./types";

export type AchievementTier = "bronze" | "silver" | "gold";

export const achievementTierLabels: Record<AchievementTier, string> = {
  bronze: "铜章",
  silver: "银章",
  gold: "金章"
};

export const achievementDefinitions = [
  { id: "first-task", name: "初见有常", description: "完成第 1 个任务", tier: "bronze", icon: "初", metric: "completed", target: 1 },
  { id: "ten-tasks", name: "小步不停", description: "累计完成 10 个任务", tier: "silver", icon: "步", metric: "completed", target: 10 },
  { id: "hundred-tasks", name: "百事可成", description: "累计完成 100 个任务", tier: "gold", icon: "百", metric: "completed", target: 100 },
  { id: "three-day-streak", name: "三日成习", description: "连续 3 天完成任务", tier: "bronze", icon: "三", metric: "streak", target: 3 },
  { id: "seven-day-streak", name: "七日有常", description: "连续坚持 7 天", tier: "silver", icon: "七", metric: "streak", target: 7 },
  { id: "thirty-day-streak", name: "月光不辍", description: "连续坚持 30 天", tier: "gold", icon: "月", metric: "streak", target: 30 },
  { id: "first-focus", name: "一刻入心", description: "完成第一次专注", tier: "bronze", icon: "心", metric: "focusSessions", target: 1 },
  { id: "ten-focus-hours", name: "十时深潜", description: "累计专注 10 小时", tier: "silver", icon: "深", metric: "focusMinutes", target: 600 },
  { id: "hundred-focus-hours", name: "百时匠心", description: "累计专注 100 小时", tier: "gold", icon: "匠", metric: "focusMinutes", target: 6000 },
  { id: "perfect-day", name: "今日圆满", description: "一天任务全部完成", tier: "bronze", icon: "满", metric: "perfectDays", target: 1 },
  { id: "weekly-eighty", name: "周周有常", description: "一周完成率达到 80%", tier: "gold", icon: "周", metric: "weeklyRate", target: 80 },
  { id: "balanced-study-exercise", name: "文武兼修", description: "学习和运动任务分别完成 10 次", tier: "silver", icon: "衡", metric: "balanced", target: 10 }
] as const satisfies ReadonlyArray<{
  id: string;
  name: string;
  description: string;
  tier: AchievementTier;
  icon: string;
  metric: "completed" | "streak" | "focusSessions" | "focusMinutes" | "perfectDays" | "weeklyRate" | "balanced";
  target: number;
}>;

export type AchievementId = typeof achievementDefinitions[number]["id"];

export interface AchievementProgress {
  id: AchievementId;
  name: string;
  description: string;
  tier: AchievementTier;
  icon: string;
  current: number;
  target: number;
  ratio: number;
  progressLabel: string;
  unlocked: boolean;
}

const achievementIds = new Set<string>(achievementDefinitions.map((achievement) => achievement.id));

export function isAchievementId(value: string): value is AchievementId {
  return achievementIds.has(value);
}

export function normalizeFeaturedAchievementIds(ids: readonly string[] | undefined): AchievementId[] {
  if (!ids) return [];
  return [...new Set(ids.filter(isAchievementId))].slice(0, 3);
}

function getHistoricalDays(state: AppState, today: Date) {
  const todayKey = toDateKey(today);
  const dates = new Set<DateKey>();
  state.fixedRecords.forEach((record) => {
    if (record.date <= todayKey) dates.add(record.date);
  });
  state.scheduledTasks.forEach((task) => {
    if (task.scheduledDate <= todayKey) dates.add(task.scheduledDate);
  });
  return [...dates].sort().map((date) => getDayStat(state, date)).filter((day) => day.hasData);
}

function getBestWeeklyRate(state: AppState, today: Date): number {
  const weeks = new Map<DateKey, { completed: number; total: number }>();
  for (const day of getHistoricalDays(state, today)) {
    const week = getWeek(fromDateKey(day.date)).start;
    const current = weeks.get(week) ?? { completed: 0, total: 0 };
    current.completed += day.completed;
    current.total += day.total;
    weeks.set(week, current);
  }

  return Math.max(0, ...[...weeks.values()].map((week) => (
    week.total === 0 ? 0 : Math.round((week.completed / week.total) * 100)
  )));
}

function getBalancedCount(state: AppState): number {
  const completedByCategory = new Map<string, number>();
  const add = (categoryId: string) => completedByCategory.set(categoryId, (completedByCategory.get(categoryId) ?? 0) + 1);

  state.fixedRecords.filter((record) => Boolean(record.completedAt)).forEach((record) => add(record.categoryId));
  state.scheduledTasks.filter((task) => task.status === "completed").forEach((task) => add(task.categoryId));
  return Math.min(completedByCategory.get("study") ?? 0, completedByCategory.get("exercise") ?? 0);
}

function formatFocusMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}小时` : `${hours}小时${remainder}分钟`;
}

function getProgressLabel(metric: typeof achievementDefinitions[number]["metric"], current: number, target: number): string {
  if (metric === "focusMinutes") return `${formatFocusMinutes(current)} / ${formatFocusMinutes(target)}`;
  if (metric === "weeklyRate") return `${current}% / ${target}%`;
  if (metric === "streak" || metric === "perfectDays") return `${current} / ${target} 天`;
  if (metric === "focusSessions" || metric === "balanced") return `${current} / ${target} 次`;
  return `${current} / ${target} 项`;
}

export function getAchievements(state: AppState, today: Date): AchievementProgress[] {
  const focus = getFocusProgress(state);
  const completed = getTotalCompleted(state);
  const streak = getLongestStreak(state, today);
  const historicalDays = getHistoricalDays(state, today);
  const metrics = {
    completed,
    streak,
    focusSessions: focus.completedSessions,
    focusMinutes: focus.totalFocusMinutes,
    perfectDays: historicalDays.filter((day) => day.ratio >= 1).length,
    weeklyRate: getBestWeeklyRate(state, today),
    balanced: getBalancedCount(state)
  };

  return achievementDefinitions.map((definition) => {
    const current = metrics[definition.metric];
    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      tier: definition.tier,
      icon: definition.icon,
      current,
      target: definition.target,
      ratio: Math.min(1, current / definition.target),
      progressLabel: getProgressLabel(definition.metric, current, definition.target),
      unlocked: current >= definition.target
    };
  });
}

export function getFeaturedAchievements(state: AppState, today: Date): AchievementProgress[] {
  const featuredIds = normalizeFeaturedAchievementIds(state.settings.featuredAchievementIds);
  const achievements = new Map(getAchievements(state, today).map((achievement) => [achievement.id, achievement]));
  return featuredIds.map((id) => achievements.get(id)).filter((achievement): achievement is AchievementProgress => Boolean(achievement?.unlocked));
}
