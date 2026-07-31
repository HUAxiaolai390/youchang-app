import { toDateKey } from "../domain/date";
import type { AppState, DateKey } from "../domain/types";

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

function isFixedTask(value: unknown): boolean {
  return hasStrings(value, ["id", "title", "categoryId", "categoryNameSnapshot", "createdAt"])
    && isDateKey(value.activeFrom)
    && (value.inactiveFrom === undefined || isDateKey(value.inactiveFrom))
    && typeof value.order === "number";
}

function isFixedRecord(value: unknown): boolean {
  return hasStrings(value, ["id", "templateId", "titleSnapshot", "categoryId", "categoryNameSnapshot"])
    && isDateKey(value.date)
    && (value.completedAt === undefined || isString(value.completedAt));
}

function isScheduledTask(value: unknown): boolean {
  return hasStrings(value, ["id", "title", "categoryId", "categoryNameSnapshot", "createdAt"])
    && isDateKey(value.scheduledDate)
    && isString(value.status)
    && taskStatuses.has(value.status)
    && (value.sourceTaskId === undefined || isString(value.sourceTaskId))
    && (value.completedAt === undefined || isString(value.completedAt));
}

function isRescheduleRecord(value: unknown): boolean {
  return hasStrings(value, ["id", "sourceTaskId", "targetTaskId", "changedAt"])
    && isDateKey(value.fromDate)
    && isDateKey(value.toDate);
}

function hasValidSettings(value: unknown): boolean {
  return hasStrings(value, ["displayName", "firstUsedAt"])
    && isDateKey(value.lastOpenedDate);
}

function assertValidBackup(value: unknown): asserts value is AppState {
  if (!isRecord(value)) {
    throw new Error(INVALID_BACKUP);
  }
  if (value.schemaVersion !== 1) {
    throw new Error(UNSUPPORTED_VERSION);
  }
  if (!hasValidSettings(value.settings)
    || !Array.isArray(value.categories)
    || !Array.isArray(value.fixedTasks)
    || !Array.isArray(value.fixedRecords)
    || !Array.isArray(value.scheduledTasks)
    || !Array.isArray(value.reschedules)
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
      categoryId: fallback.id,
      categoryNameSnapshot: fallback.name
    };
  };

  return {
    ...state,
    fixedTasks: state.fixedTasks.map(normalize),
    fixedRecords: state.fixedRecords.map(normalize),
    scheduledTasks: state.scheduledTasks.map(normalize)
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
