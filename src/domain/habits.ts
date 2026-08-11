import { fromDateKey, toDateKey } from "./date";
import { getFixedRepeatRule, isFixedTaskActiveOnDate, isFixedTaskDueOnDate } from "./repeat";
import { formatTrackedTime } from "./time";
import type { AppState, DateKey, FixedTaskTemplate } from "./types";

export interface HabitDay {
  date: DateKey;
  due: boolean;
  completed: boolean;
  actualMinutes: number;
  isToday: boolean;
}

export interface HabitStats {
  templateId: string;
  title: string;
  currentStreak: number;
  longestStreak: number;
  completionRate30Days: number;
  completed30Days: number;
  due30Days: number;
  totalActualMinutes: number;
  totalActualTimeLabel: string;
  days: HabitDay[];
}

function addDays(key: DateKey, offset: number): DateKey {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}

function datesBetween(from: DateKey, to: DateKey): DateKey[] {
  const dates: DateKey[] = [];
  for (const cursor = fromDateKey(from); toDateKey(cursor) <= to; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(toDateKey(cursor));
  }
  return dates;
}

function isDueOnDate(state: AppState, template: FixedTaskTemplate, date: DateKey): boolean {
  if (!isFixedTaskActiveOnDate(template, date)) return false;
  const hasRecord = state.fixedRecords.some((record) => record.templateId === template.id && record.date === date);
  if (getFixedRepeatRule(template).type === "weekly-count") return hasRecord;
  return isFixedTaskDueOnDate(state, template, date);
}

function getHabitDay(state: AppState, template: FixedTaskTemplate, date: DateKey, today: DateKey): HabitDay {
  const record = state.fixedRecords.find((item) => item.templateId === template.id && item.date === date);
  return {
    date,
    due: isDueOnDate(state, template, date),
    completed: Boolean(record?.completedAt),
    actualMinutes: record?.actualMinutes ?? 0,
    isToday: date === today
  };
}

function getStreaks(days: HabitDay[]): { current: number; longest: number } {
  const dueDays = days.filter((day) => day.due);
  let longest = 0;
  let running = 0;

  for (const day of dueDays) {
    running = day.completed ? running + 1 : 0;
    longest = Math.max(longest, running);
  }

  let current = 0;
  for (const day of [...dueDays].reverse()) {
    if (!day.completed) break;
    current += 1;
  }

  return { current, longest };
}

export function getHabitStats(state: AppState, templateId: string, now: Date): HabitStats | undefined {
  const template = state.fixedTasks.find((task) => task.id === templateId);
  if (!template) return undefined;

  const today = toDateKey(now);
  const lifetimeDays = datesBetween(template.activeFrom, today)
    .map((date) => getHabitDay(state, template, date, today));
  const recentStart = addDays(today, -29);
  const days = datesBetween(recentStart, today)
    .map((date) => getHabitDay(state, template, date, today));
  const recentDueDays = days.filter((day) => day.due);
  const completed30Days = recentDueDays.filter((day) => day.completed).length;
  const due30Days = recentDueDays.length;
  const streaks = getStreaks(lifetimeDays);
  const totalActualMinutes = state.fixedRecords
    .filter((record) => record.templateId === templateId)
    .reduce((sum, record) => sum + (record.actualMinutes ?? 0), 0);

  return {
    templateId,
    title: template.title,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    completionRate30Days: due30Days === 0 ? 0 : completed30Days / due30Days,
    completed30Days,
    due30Days,
    totalActualMinutes,
    totalActualTimeLabel: formatTrackedTime(totalActualMinutes),
    days
  };
}
