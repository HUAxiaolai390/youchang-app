import { toDateKey } from "./date";
import type { AppState, DateKey } from "./types";

export interface DayStat {
  date: DateKey;
  completed: number;
  total: number;
  ratio: number;
  hasData: boolean;
  hasFixedTasks: boolean;
  allFixedCompleted: boolean;
}

export type Progress = Pick<DayStat, "completed" | "total" | "ratio">;

function getDayStat(state: AppState, date: DateKey): DayStat {
  const fixedRecords = state.fixedRecords.filter((record) => record.date === date);
  const scheduledTasks = state.scheduledTasks.filter((task) => task.scheduledDate === date);
  const completed = fixedRecords.filter((record) => record.completedAt).length
    + scheduledTasks.filter((task) => task.status === "completed").length;
  const total = fixedRecords.length + scheduledTasks.length;
  const hasFixedTasks = fixedRecords.length > 0;

  return {
    date,
    completed,
    total,
    ratio: total === 0 ? 0 : completed / total,
    hasData: total > 0,
    hasFixedTasks,
    allFixedCompleted: hasFixedTasks && fixedRecords.every((record) => Boolean(record.completedAt))
  };
}

export function getTodayProgress(state: AppState, today: Date): Progress {
  const { completed, total, ratio } = getDayStat(state, toDateKey(today));
  return { completed, total, ratio };
}

export function getCatMessage(progress: Progress): string {
  if (progress.ratio >= 1) return "今天已经足够，和小猫一起休息吧。";
  if (progress.ratio > 0) return "你已经开始了，小猫在陪着你。";
  return "先完成一件小事，小猫会为你加油。";
}

export function getSevenDayStats(state: AppState, today: Date): DayStat[] {
  const firstDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + index);
    return getDayStat(state, toDateKey(date));
  });
}

export function getCurrentStreak(state: AppState, today: Date): number {
  const todayKey = toDateKey(today);
  const dates = new Set<DateKey>();

  for (const record of state.fixedRecords) {
    if (record.date <= todayKey) dates.add(record.date);
  }
  for (const task of state.scheduledTasks) {
    if (task.scheduledDate <= todayKey) dates.add(task.scheduledDate);
  }

  let streak = 0;
  for (const date of [...dates].sort().reverse()) {
    const day = getDayStat(state, date);
    if (day.hasFixedTasks ? day.allFixedCompleted : day.completed > 0) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

export function getTotalCompleted(state: AppState): number {
  return state.fixedRecords.filter((record) => record.completedAt).length
    + state.scheduledTasks.filter((task) => task.status === "completed").length;
}
