import { toDateKey } from "../domain/date";
import type { AppState, DateKey } from "../domain/types";
import { maximumActualMinutes } from "../domain/time";
import { isTimeKey, maximumEstimatedMinutes } from "../domain/planning";
import { isAchievementId } from "../domain/achievements";
import { isReminderMinutesBefore } from "../domain/reminders";
import { isTaskPriority } from "../domain/priorities";

const INVALID_BACKUP = "备份文件格式无效";
const UNSUPPORTED_VERSION = "备份文件版本不受支持";
const taskStatuses = new Set([
  "pending",
  "completed",
  "backlog",
  "rescheduled",
  "archived"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isDateKey(value: unknown): value is DateKey {
  if (!isString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  return toDateKey(new Date(year, month - 1, day)) === value;
}

function hasStrings(value: unknown, fields: string[]): value is Record<string, string> {
  return isRecord(value) && fields.every((field) => isString(value[field]));
}

function isCategory(value: unknown): boolean {
  return hasStrings(value, ["id", "name", "icon", "createdAt"])
    && typeof value.order === "number"
    && typeof value.builtIn === "boolean";
}

function isFixedRepeatRule(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value) || !isString(value.type)) return false;
  if (value.type === "daily" || value.type === "weekdays") return true;
  if (value.type === "custom-weekdays") {
    return Array.isArray(value.weekdays)
      && value.weekdays.length > 0
      && value.weekdays.every((day) => typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6)
      && new Set(value.weekdays).size === value.weekdays.length;
  }
  if (value.type === "weekly-count") {
    return typeof value.timesPerWeek === "number" && Number.isInteger(value.timesPerWeek)
      && value.timesPerWeek >= 1 && value.timesPerWeek <= 7;
  }
  if (value.type === "interval") {
    return typeof value.intervalDays === "number" && Number.isInteger(value.intervalDays)
      && value.intervalDays >= 2 && value.intervalDays <= 30;
  }
  return false;
}

function isFixedTask(value: unknown): boolean {
  return hasStrings(value, ["id", "title", "categoryId", "categoryNameSnapshot", "createdAt"])
    && isDateKey(value.activeFrom)
    && (value.inactiveFrom === undefined || isDateKey(value.inactiveFrom))
    && (value.successorId === undefined || isString(value.successorId))
    && isFixedRepeatRule(value.repeatRule)
    && (value.pausedUntil === undefined || isDateKey(value.pausedUntil))
    && (value.skippedDates === undefined
      || (Array.isArray(value.skippedDates)
        && value.skippedDates.every(isDateKey)
        && new Set(value.skippedDates).size === value.skippedDates.length))
    && isOptionalPlanning(value)
    && typeof value.order === "number";
}

function isFixedRecord(value: unknown): boolean {
  return hasStrings(value, ["id", "templateId", "titleSnapshot", "categoryId", "categoryNameSnapshot"])
    && isDateKey(value.date)
    && (value.completedAt === undefined || isString(value.completedAt))
    && (value.reminderSentAt === undefined || isString(value.reminderSentAt))
    && (value.priority === undefined || isTaskPriority(value.priority))
    && isOptionalPlanning(value)
    && isOptionalActualMinutes(value.actualMinutes);
}

function isScheduledTask(value: unknown): boolean {
  return hasStrings(value, ["id", "title", "categoryId", "categoryNameSnapshot", "createdAt"])
    && isDateKey(value.scheduledDate)
    && isString(value.status)
    && taskStatuses.has(value.status)
    && (value.sourceTaskId === undefined || isString(value.sourceTaskId))
    && (value.completedAt === undefined || isString(value.completedAt))
    && (value.reminderSentAt === undefined || isString(value.reminderSentAt))
    && (value.priority === undefined || isTaskPriority(value.priority))
    && isOptionalPlanning(value)
    && isOptionalActualMinutes(value.actualMinutes);
}

function isOptionalPlanning(value: Record<string, unknown>): boolean {
  return (value.plannedStartTime === undefined || isTimeKey(value.plannedStartTime))
    && (value.reminderMinutesBefore === undefined || isReminderMinutesBefore(value.reminderMinutesBefore))
    && (value.priority === undefined || isTaskPriority(value.priority))
    && (value.estimatedMinutes === undefined
      || (typeof value.estimatedMinutes === "number"
        && Number.isInteger(value.estimatedMinutes)
        && value.estimatedMinutes >= 1
        && value.estimatedMinutes <= maximumEstimatedMinutes));
}

function isOptionalActualMinutes(value: unknown): boolean {
  return value === undefined
    || (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= maximumActualMinutes);
}

function isTimeEntry(value: unknown): boolean {
  return hasStrings(value, ["id", "title", "categoryId", "categoryNameSnapshot", "createdAt"])
    && isDateKey(value.date)
    && typeof value.minutes === "number"
    && Number.isInteger(value.minutes)
    && value.minutes >= 1
    && value.minutes <= maximumActualMinutes;
}

function isRescheduleRecord(value: unknown): boolean {
  return hasStrings(value, ["id", "sourceTaskId", "targetTaskId", "changedAt"])
    && isDateKey(value.fromDate)
    && isDateKey(value.toDate);
}

function hasValidSettings(value: unknown): boolean {
  return hasStrings(value, ["displayName", "firstUsedAt"])
    && isDateKey(value.lastOpenedDate)
    && (value.featuredAchievementIds === undefined
      || (Array.isArray(value.featuredAchievementIds)
        && value.featuredAchievementIds.length <= 3
        && value.featuredAchievementIds.every((id) => isString(id) && isAchievementId(id))
        && new Set(value.featuredAchievementIds).size === value.featuredAchievementIds.length))
    && (value.musicVolume === undefined
      || (typeof value.musicVolume === "number"
        && Number.isFinite(value.musicVolume)
        && value.musicVolume >= 0
        && value.musicVolume <= 1))
    && (value.systemNotificationsEnabled === undefined || typeof value.systemNotificationsEnabled === "boolean");
}

function hasValidFocus(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;

  const focusMinutes = value.focusMinutes;
  const breakMinutes = value.breakMinutes;
  const completedSessions = value.completedSessions;
  const totalFocusMinutes = value.totalFocusMinutes;
  const experience = value.experience;

  return typeof focusMinutes === "number" && Number.isInteger(focusMinutes) && focusMinutes >= 1 && focusMinutes <= 180
    && typeof breakMinutes === "number" && Number.isInteger(breakMinutes) && breakMinutes >= 1 && breakMinutes <= 60
    && typeof completedSessions === "number" && Number.isInteger(completedSessions) && completedSessions >= 0
    && typeof totalFocusMinutes === "number" && Number.isInteger(totalFocusMinutes) && totalFocusMinutes >= 0
    && typeof experience === "number" && Number.isInteger(experience) && experience >= 0;
}

function assertValidBackup(value: unknown): asserts value is AppState {
  if (!isRecord(value)) {
    throw new Error(INVALID_BACKUP);
  }
  if (value.schemaVersion !== 1) {
    throw new Error(UNSUPPORTED_VERSION);
  }
  if (!hasValidSettings(value.settings)
    || !hasValidFocus(value.focus)
    || !Array.isArray(value.categories)
    || !Array.isArray(value.fixedTasks)
    || !Array.isArray(value.fixedRecords)
    || !Array.isArray(value.scheduledTasks)
    || !Array.isArray(value.reschedules)
    || (value.timeEntries !== undefined
      && (!Array.isArray(value.timeEntries) || !value.timeEntries.every(isTimeEntry)))
    || !value.categories.every(isCategory)
    || !value.fixedTasks.every(isFixedTask)
    || !value.fixedRecords.every(isFixedRecord)
    || !value.scheduledTasks.every(isScheduledTask)
    || !value.reschedules.every(isRescheduleRecord)) {
    throw new Error(INVALID_BACKUP);
  }
}

function normalizeCategoryReferences(state: AppState): AppState {
  const categories = new Map(state.categories.map((category) => [category.id, category]));
  const fallback = categories.get("other");

  const normalize = <T extends { categoryId: string; categoryNameSnapshot: string }>(task: T): T => {
    if (categories.has(task.categoryId)) {
      return task;
    }
    if (!fallback) {
      throw new Error(INVALID_BACKUP);
    }
    return {
      ...task,
      categoryId: fallback.id
    };
  };

  return {
    ...state,
    fixedTasks: state.fixedTasks.map(normalize),
    fixedRecords: state.fixedRecords.map(normalize),
    scheduledTasks: state.scheduledTasks.map(normalize),
    timeEntries: (state.timeEntries ?? []).map(normalize)
  };
}

export function serializeBackup(state: AppState): string {
  return JSON.stringify(state);
}

export function parseBackup(text: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(INVALID_BACKUP);
  }

  assertValidBackup(parsed);
  const copied = JSON.parse(JSON.stringify(parsed)) as AppState;
  return normalizeCategoryReferences(copied);
}

export function downloadBackup(state: AppState): void {
  const blob = new Blob([serializeBackup(state)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `有常备份-${toDateKey(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
