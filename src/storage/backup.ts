import { fromDateKey, toDateKey } from "../domain/date";
import type { AppState, DateKey } from "../domain/types";
import { maximumActualMinutes } from "../domain/time";
import { isTimeKey } from "../domain/planning";
import { isAchievementId } from "../domain/achievements";
import { isReminderMinutesBefore } from "../domain/reminders";
import { isTaskPriority } from "../domain/priorities";
import { maximumTaskSteps } from "../domain/steps";
import { maximumGoals } from "../domain/goals";

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

function isTaskSteps(value: unknown): boolean {
  if (value === undefined) return true;
  return Array.isArray(value)
    && value.length <= maximumTaskSteps
    && value.every((step) => hasStrings(step, ["id", "title"])
      && step.title.trim().length > 0
      && typeof step.completed === "boolean")
    && new Set(value.map((step) => step.id)).size === value.length;
}

function isFixedTask(value: unknown): boolean {
  return hasStrings(value, ["id", "title", "categoryId", "categoryNameSnapshot", "createdAt"])
    && isDateKey(value.activeFrom)
    && (value.inactiveFrom === undefined || isDateKey(value.inactiveFrom))
    && (value.successorId === undefined || isString(value.successorId))
    && (value.goalId === undefined || isString(value.goalId))
    && isFixedRepeatRule(value.repeatRule)
    && isTaskSteps(value.steps)
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
    && (value.goalId === undefined || isString(value.goalId))
    && (value.reminderSentAt === undefined || isString(value.reminderSentAt))
    && (value.reminderSnoozedUntil === undefined || isValidTimestamp(value.reminderSnoozedUntil))
    && (value.priority === undefined || isTaskPriority(value.priority))
    && isTaskSteps(value.steps)
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
    && (value.goalId === undefined || isString(value.goalId))
    && (value.reminderSentAt === undefined || isString(value.reminderSentAt))
    && (value.reminderSnoozedUntil === undefined || isValidTimestamp(value.reminderSnoozedUntil))
    && (value.priority === undefined || isTaskPriority(value.priority))
    && isTaskSteps(value.steps)
    && isOptionalPlanning(value)
    && isOptionalActualMinutes(value.actualMinutes);
}

function isOptionalPlanning(value: Record<string, unknown>): boolean {
  return (value.plannedStartTime === undefined || isTimeKey(value.plannedStartTime))
    && (value.reminderMinutesBefore === undefined || isReminderMinutesBefore(value.reminderMinutesBefore))
    && (value.priority === undefined || isTaskPriority(value.priority));
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
    && (value.systemNotificationsEnabled === undefined || typeof value.systemNotificationsEnabled === "boolean")
    && (value.wakeScreenForReminders === undefined || typeof value.wakeScreenForReminders === "boolean")
    && (value.quietHoursEnabled === undefined || typeof value.quietHoursEnabled === "boolean")
    && (value.quietHoursStart === undefined || isTimeKey(value.quietHoursStart))
    && (value.quietHoursEnd === undefined || isTimeKey(value.quietHoursEnd))
    && (value.lastBackupAt === undefined || isValidTimestamp(value.lastBackupAt));
}

function isWeeklyReview(value: unknown): boolean {
  if (!hasStrings(value, ["summary", "adjustment", "updatedAt"]) || !isDateKey(value.weekStart)) return false;
  return fromDateKey(value.weekStart).getDay() === 1
    && value.summary.length <= 500
    && value.adjustment.length <= 500
    && isValidTimestamp(value.updatedAt);
}

function isGoal(value: unknown): boolean {
  return hasStrings(value, ["id", "title", "createdAt"])
    && value.title.trim().length > 0
    && value.title.length <= 60
    && isDateKey(value.deadline)
    && isValidTimestamp(value.createdAt);
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
    && typeof experience === "number" && Number.isInteger(experience) && experience >= 0
    && hasValidFocusTimer(value.timer);
}

function isValidTimestamp(value: unknown): boolean {
  return isString(value) && Number.isFinite(Date.parse(value));
}

function hasValidFocusTimer(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value) || (value.mode !== "countdown" && value.mode !== "stopwatch")) return false;
  if (!isRecord(value.countdown) || !isRecord(value.stopwatch)) return false;

  const countdown = value.countdown;
  const stopwatch = value.stopwatch;
  return (countdown.phase === "focus" || countdown.phase === "break")
    && typeof countdown.remainingSeconds === "number"
    && Number.isSafeInteger(countdown.remainingSeconds)
    && countdown.remainingSeconds >= 0
    && countdown.remainingSeconds <= 10_800
    && (countdown.deadlineAt === undefined || isValidTimestamp(countdown.deadlineAt))
    && (countdown.target === undefined || typeof countdown.target === "string")
    && typeof stopwatch.elapsedSeconds === "number"
    && Number.isSafeInteger(stopwatch.elapsedSeconds)
    && stopwatch.elapsedSeconds >= 0
    && (stopwatch.startedAt === undefined || isValidTimestamp(stopwatch.startedAt))
    && hasStrings(stopwatch, ["target", "categoryId", "title"]);
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
    || (value.weeklyReviews !== undefined
      && (!Array.isArray(value.weeklyReviews)
        || !value.weeklyReviews.every(isWeeklyReview)
        || new Set(value.weeklyReviews.map((review) => isRecord(review) ? review.weekStart : undefined)).size !== value.weeklyReviews.length))
    || (value.goals !== undefined
      && (!Array.isArray(value.goals)
        || value.goals.length > maximumGoals
        || !value.goals.every(isGoal)
        || new Set(value.goals.map((goal) => isRecord(goal) ? goal.id : undefined)).size !== value.goals.length))
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
  const goals = state.goals ?? [];
  const goalIds = new Set(goals.map((goal) => goal.id));

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

  const normalizeGoal = <T extends { goalId?: string }>(task: T): T => task.goalId && !goalIds.has(task.goalId)
    ? { ...task, goalId: undefined }
    : task;

  return {
    ...state,
    fixedTasks: state.fixedTasks.map((task) => normalizeGoal(normalize(task))),
    fixedRecords: state.fixedRecords.map((record) => normalizeGoal(normalize(record))),
    scheduledTasks: state.scheduledTasks.map((task) => normalizeGoal(normalize(task))),
    timeEntries: (state.timeEntries ?? []).map(normalize),
    weeklyReviews: state.weeklyReviews ?? [],
    goals
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

export async function downloadTextFile(text: string, filename: string): Promise<void> {
  const file = new File([text], filename, { type: "application/json" });
  if (typeof navigator.share === "function"
    && typeof navigator.canShare === "function"
    && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: filename });
    return;
  }

  const blob = new Blob([text], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

export function downloadBackup(state: AppState): Promise<void> {
  return downloadTextFile(
    serializeBackup(state),
    `有常备份-${toDateKey(new Date())}.json`
  );
}
