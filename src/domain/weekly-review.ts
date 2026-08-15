import { fromDateKey, getWeek, toDateKey } from "./date";
import { getPeriodStat } from "./stats";
import { getTimeAllocation } from "./time";
import type { AppState, DateKey, WeeklyReview } from "./types";

export const maximumWeeklyReviewLength = 500;

export interface WeeklyReviewSnapshot {
  weekStart: DateKey;
  weekEnd: DateKey;
  throughDate: DateKey;
  completed: number;
  total: number;
  ratio: number;
  actualMinutes: number;
  trackedMinutes: number;
  topCategoryName?: string;
}

function normalizeReviewText(value: string): string {
  const text = value.trim();
  if (text.length > maximumWeeklyReviewLength) {
    throw new Error(`每项复盘内容最多 ${maximumWeeklyReviewLength} 字`);
  }
  return text;
}

export function getWeeklyReview(state: AppState, weekStart: DateKey): WeeklyReview | undefined {
  return (state.weeklyReviews ?? []).find((review) => review.weekStart === weekStart);
}

export function saveWeeklyReview(
  state: AppState,
  weekStart: DateKey,
  summary: string,
  adjustment: string,
  now: Date
): AppState {
  const normalizedSummary = normalizeReviewText(summary);
  const normalizedAdjustment = normalizeReviewText(adjustment);
  const withoutCurrent = (state.weeklyReviews ?? []).filter((review) => review.weekStart !== weekStart);

  if (!normalizedSummary && !normalizedAdjustment) {
    return { ...state, weeklyReviews: withoutCurrent };
  }

  const review: WeeklyReview = {
    weekStart,
    summary: normalizedSummary,
    adjustment: normalizedAdjustment,
    updatedAt: now.toISOString()
  };
  return {
    ...state,
    weeklyReviews: [...withoutCurrent, review].sort((left, right) => left.weekStart.localeCompare(right.weekStart))
  };
}

export function getWeeklyReviewSnapshot(state: AppState, now: Date): WeeklyReviewSnapshot {
  const { start: weekStart, end: weekEnd } = getWeek(now);
  const today = toDateKey(now);
  const throughDate = today < weekEnd ? today : weekEnd;
  const period = getPeriodStat(state, weekStart, throughDate);
  const inRange = (date: DateKey) => date >= weekStart && date <= throughDate;
  const fixedRecords = state.fixedRecords.filter((record) => inRange(record.date));
  const scheduledTasks = state.scheduledTasks.filter((task) => inRange(task.scheduledDate) && task.status !== "rescheduled");
  const actualMinutes = fixedRecords.reduce((sum, record) => sum + (record.actualMinutes ?? 0), 0)
    + scheduledTasks.reduce((sum, task) => sum + (task.actualMinutes ?? 0), 0);
  const allocation = getTimeAllocation(state, weekStart, throughDate);

  return {
    weekStart,
    weekEnd,
    throughDate,
    completed: period.completed,
    total: period.total,
    ratio: period.ratio,
    actualMinutes,
    trackedMinutes: allocation.totalMinutes,
    topCategoryName: allocation.items[0]?.categoryName
  };
}

export function getReviewWeekEnd(weekStart: DateKey): DateKey {
  const end = fromDateKey(weekStart);
  end.setDate(end.getDate() + 6);
  return toDateKey(end);
}
