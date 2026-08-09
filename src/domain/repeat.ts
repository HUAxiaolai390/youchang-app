import { fromDateKey, getWeek } from "./date";
import type { AppState, DateKey, FixedRepeatRule, FixedTaskTemplate } from "./types";

export const defaultFixedRepeatRule: Readonly<FixedRepeatRule> = { type: "daily" };
export const weekdayOptions = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 0, label: "周日" }
] as const;

export function normalizeFixedRepeatRule(rule: FixedRepeatRule | undefined): FixedRepeatRule {
  if (!rule || rule.type === "daily") return { type: "daily" };
  if (rule.type === "weekdays") return { type: "weekdays" };
  if (rule.type === "custom-weekdays") {
    const weekdays = [...new Set(rule.weekdays)].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).sort();
    if (weekdays.length === 0) throw new Error("请至少选择一个星期");
    return { type: "custom-weekdays", weekdays };
  }
  if (rule.type === "weekly-count") {
    if (!Number.isInteger(rule.timesPerWeek) || rule.timesPerWeek < 1 || rule.timesPerWeek > 7) {
      throw new Error("每周次数应为 1 到 7 次");
    }
    return { type: "weekly-count", timesPerWeek: rule.timesPerWeek };
  }
  if (!Number.isInteger(rule.intervalDays) || rule.intervalDays < 2 || rule.intervalDays > 30) {
    throw new Error("间隔天数应为 2 到 30 天");
  }
  return { type: "interval", intervalDays: rule.intervalDays };
}

export function getFixedRepeatRule(task: FixedTaskTemplate): FixedRepeatRule {
  return normalizeFixedRepeatRule(task.repeatRule);
}

export function formatFixedRepeatRule(rule: FixedRepeatRule | undefined): string {
  const normalized = normalizeFixedRepeatRule(rule);
  if (normalized.type === "daily") return "每天";
  if (normalized.type === "weekdays") return "仅工作日";
  if (normalized.type === "custom-weekdays") {
    return normalized.weekdays.map((day) => weekdayOptions.find((option) => option.value === day)?.label ?? "").join("、");
  }
  if (normalized.type === "weekly-count") return `每周 ${normalized.timesPerWeek} 次`;
  return `每隔 ${normalized.intervalDays} 天`;
}

export function isFixedTaskActiveOnDate(task: FixedTaskTemplate, date: DateKey): boolean {
  return task.activeFrom <= date
    && (!task.inactiveFrom || date < task.inactiveFrom)
    && (!task.pausedUntil || date > task.pausedUntil)
    && !(task.skippedDates ?? []).includes(date);
}

function differenceInCalendarDays(date: DateKey, anchor: DateKey): number {
  const current = fromDateKey(date);
  const start = fromDateKey(anchor);
  return Math.round((Date.UTC(current.getFullYear(), current.getMonth(), current.getDate())
    - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86_400_000);
}

export function getWeeklyCompletionCount(state: AppState, templateId: string, date: DateKey): number {
  const { start, end } = getWeek(fromDateKey(date));
  return state.fixedRecords.filter((record) => (
    record.templateId === templateId
    && record.date >= start
    && record.date <= end
    && Boolean(record.completedAt)
  )).length;
}

export function isFixedTaskDueOnDate(state: AppState, task: FixedTaskTemplate, date: DateKey): boolean {
  if (!isFixedTaskActiveOnDate(task, date)) return false;
  const rule = getFixedRepeatRule(task);
  const weekday = fromDateKey(date).getDay();
  if (rule.type === "daily") return true;
  if (rule.type === "weekdays") return weekday >= 1 && weekday <= 5;
  if (rule.type === "custom-weekdays") return rule.weekdays.includes(weekday);
  if (rule.type === "interval") return differenceInCalendarDays(date, task.activeFrom) % rule.intervalDays === 0;
  return getWeeklyCompletionCount(state, task.id, date) < rule.timesPerWeek;
}

export function shouldShowFixedTaskOnDate(
  state: AppState,
  task: FixedTaskTemplate,
  date: DateKey,
  today: DateKey
): boolean {
  const withinActivation = task.activeFrom <= date && (!task.inactiveFrom || date < task.inactiveFrom);
  if (!withinActivation) return false;
  const existing = state.fixedRecords.some((record) => record.templateId === task.id && record.date === date);
  if (existing) return true;
  if (!isFixedTaskDueOnDate(state, task, date)) return false;
  return getFixedRepeatRule(task).type !== "weekly-count" || date === today;
}
