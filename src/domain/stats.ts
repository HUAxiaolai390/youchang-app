import { fromDateKey, getWeek, toDateKey } from "./date";
import { getTimeAllocation } from "./time";
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

export interface PeriodStat extends Progress {
  fromDate: DateKey;
  toDate: DateKey;
  trackedMinutes: number;
  activeDays: number;
}

export interface HeatmapDay extends DayStat {
  trackedMinutes: number;
  level: 0 | 1 | 2 | 3 | 4;
  isFuture: boolean;
}

function isCountableFixedRecord(state: AppState, record: AppState["fixedRecords"][number]): boolean {
  const template = state.fixedTasks.find((task) => task.id === record.templateId);
  if (!template) return true;

  return template.activeFrom <= record.date
    && (!template.inactiveFrom || record.date < template.inactiveFrom);
}

export function getDayStat(state: AppState, date: DateKey): DayStat {
  const fixedRecords = state.fixedRecords.filter((record) => record.date === date && isCountableFixedRecord(state, record));
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

function getRecordedDates(state: AppState, todayKey: DateKey): DateKey[] {
  const dates = new Set<DateKey>();

  for (const record of state.fixedRecords) {
    if (record.date <= todayKey && isCountableFixedRecord(state, record)) dates.add(record.date);
  }
  for (const task of state.scheduledTasks) {
    if (task.scheduledDate <= todayKey) dates.add(task.scheduledDate);
  }

  return [...dates].sort();
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

  let streak = 0;
  for (const date of getRecordedDates(state, todayKey).reverse()) {
    const day = getDayStat(state, date);
    if (day.hasFixedTasks ? day.allFixedCompleted : day.completed > 0) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

export function getPeriodStat(state: AppState, fromDate: DateKey, toDate: DateKey): PeriodStat {
  let completed = 0;
  let total = 0;
  let activeDays = 0;

  for (const cursor = fromDateKey(fromDate); toDateKey(cursor) <= toDate; cursor.setDate(cursor.getDate() + 1)) {
    const date = toDateKey(cursor);
    const day = getDayStat(state, date);
    const minutes = getTimeAllocation(state, date, date).totalMinutes;
    completed += day.completed;
    total += day.total;
    if (day.completed > 0 || minutes > 0) activeDays += 1;
  }

  return {
    fromDate,
    toDate,
    completed,
    total,
    ratio: total === 0 ? 0 : completed / total,
    trackedMinutes: getTimeAllocation(state, fromDate, toDate).totalMinutes,
    activeDays
  };
}

function getHeatLevel(day: DayStat, trackedMinutes: number): HeatmapDay["level"] {
  if (day.total > 0) {
    if (day.ratio >= 1) return 4;
    if (day.ratio >= 2 / 3) return 3;
    if (day.completed > 0) return 2;
    return 1;
  }
  if (trackedMinutes >= 120) return 4;
  if (trackedMinutes >= 60) return 3;
  if (trackedMinutes > 0) return 2;
  return 0;
}

export function getActivityHeatmap(state: AppState, today: Date, weeks = 12): HeatmapDay[] {
  const safeWeeks = Math.min(26, Math.max(1, Math.round(weeks)));
  const todayKey = toDateKey(today);
  const weekStart = fromDateKey(getWeek(today).start);
  const firstDay = new Date(weekStart);
  firstDay.setDate(firstDay.getDate() - (safeWeeks - 1) * 7);

  return Array.from({ length: safeWeeks * 7 }, (_, index) => {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + index);
    const dateKey = toDateKey(date);
    const day = getDayStat(state, dateKey);
    const trackedMinutes = getTimeAllocation(state, dateKey, dateKey).totalMinutes;
    const isFuture = dateKey > todayKey;
    return {
      ...day,
      trackedMinutes,
      level: isFuture ? 0 : getHeatLevel(day, trackedMinutes),
      isFuture
    };
  });
}

export function getLongestStreak(state: AppState, today: Date): number {
  const dates = getRecordedDates(state, toDateKey(today));
  if (dates.length === 0) return 0;

  const firstDate = new Date(`${dates[0]}T00:00:00`);
  const lastDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let longest = 0;
  let current = 0;

  for (const cursor = new Date(firstDate); cursor <= lastDate; cursor.setDate(cursor.getDate() + 1)) {
    const day = getDayStat(state, toDateKey(cursor));
    const qualifies = day.hasFixedTasks ? day.allFixedCompleted : day.completed > 0;
    current = qualifies ? current + 1 : 0;
    longest = Math.max(longest, current);
  }

  return longest;
}

export function getTotalCompleted(state: AppState): number {
  return state.fixedRecords.filter((record) => record.completedAt).length
    + state.scheduledTasks.filter((task) => task.status === "completed").length;
}
