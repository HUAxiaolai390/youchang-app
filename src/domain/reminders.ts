import { fromDateKey, toDateKey } from "./date";
import { getFixedRepeatRule, isFixedTaskDueOnDate } from "./repeat";
import type { AppState, DateKey, ReminderMinutesBefore, TimeKey } from "./types";

export const reminderMinuteOptions: ReadonlyArray<{ value: ReminderMinutesBefore; label: string }> = [
  { value: 0, label: "准时提醒" },
  { value: 5, label: "提前 5 分钟" },
  { value: 10, label: "提前 10 分钟" },
  { value: 30, label: "提前 30 分钟" },
  { value: 60, label: "提前 1 小时" }
];

const validReminderMinutes = new Set<ReminderMinutesBefore>(reminderMinuteOptions.map((option) => option.value));
export type TaskReminder = {
  kind: "fixed" | "scheduled";
  id: string;
  title: string;
  date: DateKey;
  plannedStartTime: TimeKey;
  reminderMinutesBefore: ReminderMinutesBefore;
  startAt: Date;
  remindAt: Date;
  snoozed: boolean;
};

export type ReminderOverviewStatus = "upcoming" | "missed" | "snoozed";

export type TaskReminderOverviewItem = TaskReminder & {
  status: ReminderOverviewStatus;
};

export function isReminderMinutesBefore(value: unknown): value is ReminderMinutesBefore {
  return typeof value === "number" && validReminderMinutes.has(value as ReminderMinutesBefore);
}

export function normalizeReminderMinutesBefore(value: unknown): ReminderMinutesBefore | undefined {
  if (value === undefined || value === "") return undefined;
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!isReminderMinutesBefore(numberValue)) throw new Error("请选择有效提醒时间");
  return numberValue;
}

export function formatReminderMinutes(value?: ReminderMinutesBefore): string {
  if (value === undefined) return "不提醒";
  return reminderMinuteOptions.find((option) => option.value === value)?.label ?? "不提醒";
}

function dateAtTime(date: DateKey, time: TimeKey): Date {
  const result = fromDateKey(date);
  const [hours, minutes] = time.split(":").map(Number);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

const defaultQuietHoursStart = 23 * 60;
const defaultQuietHoursEnd = 7 * 60;

function minutesOfDay(value: unknown, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)
    || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;
  return hours * 60 + minutes;
}

/** Returns whether a local date/time falls inside the configured quiet window. */
export function isWithinQuietHours(settings: AppState["settings"], at: Date): boolean {
  if (settings.quietHoursEnabled !== true) return false;
  const start = minutesOfDay(settings.quietHoursStart, defaultQuietHoursStart);
  const end = minutesOfDay(settings.quietHoursEnd, defaultQuietHoursEnd);
  if (start === end) return false;
  const current = at.getHours() * 60 + at.getMinutes();
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

/**
 * Returns every future reminder that can be handed to the phone operating
 * system. Unlike the in-app reminder list, this is not limited to today.
 */
export function getSchedulableTaskReminders(state: AppState, now: Date): TaskReminder[] {
  const candidates: TaskReminder[] = [];
  const fixedOccurrences = new Set<string>();

  for (const record of state.fixedRecords) {
    fixedOccurrences.add(`${record.templateId}:${record.date}`);
    const snoozedUntil = record.reminderSnoozedUntil ? new Date(record.reminderSnoozedUntil) : undefined;
    if (record.completedAt || record.reminderSentAt || !record.plannedStartTime
      || record.reminderMinutesBefore === undefined) continue;
    const startAt = dateAtTime(record.date, record.plannedStartTime);
    candidates.push({
      kind: "fixed",
      id: record.id,
      title: record.titleSnapshot,
      date: record.date,
      plannedStartTime: record.plannedStartTime,
      reminderMinutesBefore: record.reminderMinutesBefore,
      startAt,
      remindAt: snoozedUntil ?? new Date(startAt.getTime() - record.reminderMinutesBefore * 60_000),
      snoozed: Boolean(snoozedUntil)
    });
  }

  // Fixed records are normally created when a day begins. Pre-schedule the
  // predictable occurrences as well, so daily habits still notify if the app
  // stays closed overnight. Weekly-count habits are intentionally limited to
  // today because their remaining days depend on what the user completes.
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let offset = 0; offset <= 30; offset += 1) {
    const dateKey = toDateKey(date);
    for (const task of state.fixedTasks) {
      if (fixedOccurrences.has(`${task.id}:${dateKey}`) || !task.plannedStartTime
        || task.reminderMinutesBefore === undefined) continue;
      if (getFixedRepeatRule(task).type === "weekly-count" && offset > 0) continue;
      if (!isFixedTaskDueOnDate(state, task, dateKey)) continue;
      const startAt = dateAtTime(dateKey, task.plannedStartTime);
      candidates.push({
        kind: "fixed",
        id: `${task.id}:${dateKey}`,
        title: task.title,
        date: dateKey,
        plannedStartTime: task.plannedStartTime,
        reminderMinutesBefore: task.reminderMinutesBefore,
        startAt,
        remindAt: new Date(startAt.getTime() - task.reminderMinutesBefore * 60_000),
        snoozed: false
      });
    }
    date.setDate(date.getDate() + 1);
  }

  for (const task of state.scheduledTasks) {
    const snoozedUntil = task.reminderSnoozedUntil ? new Date(task.reminderSnoozedUntil) : undefined;
    const canRemindSnoozed = Boolean(snoozedUntil) && ["pending", "backlog", "archived"].includes(task.status);
    if ((!canRemindSnoozed && task.status !== "pending") || task.reminderSentAt
      || !task.plannedStartTime || task.reminderMinutesBefore === undefined) continue;
    const startAt = dateAtTime(task.scheduledDate, task.plannedStartTime);
    candidates.push({
      kind: "scheduled",
      id: task.id,
      title: task.title,
      date: task.scheduledDate,
      plannedStartTime: task.plannedStartTime,
      reminderMinutesBefore: task.reminderMinutesBefore,
      startAt,
      remindAt: snoozedUntil ?? new Date(startAt.getTime() - task.reminderMinutesBefore * 60_000),
      snoozed: Boolean(snoozedUntil)
    });
  }

  return candidates
    .filter((reminder) => reminder.remindAt.getTime() > now.getTime()
      && !isWithinQuietHours(state.settings, reminder.remindAt))
    .sort((left, right) => left.remindAt.getTime() - right.remindAt.getTime());
}

export function getPendingTaskReminders(state: AppState, now: Date): TaskReminder[] {
  const today = toDateKey(now);
  const candidates: TaskReminder[] = [];

  for (const record of state.fixedRecords) {
    const snoozedUntil = record.reminderSnoozedUntil ? new Date(record.reminderSnoozedUntil) : undefined;
    if ((!snoozedUntil && record.date !== today) || record.completedAt || record.reminderSentAt
      || !record.plannedStartTime || record.reminderMinutesBefore === undefined) continue;
    const startAt = dateAtTime(record.date, record.plannedStartTime);
    candidates.push({
      kind: "fixed",
      id: record.id,
      title: record.titleSnapshot,
      date: record.date,
      plannedStartTime: record.plannedStartTime,
      reminderMinutesBefore: record.reminderMinutesBefore,
      startAt,
      remindAt: snoozedUntil ?? new Date(startAt.getTime() - record.reminderMinutesBefore * 60_000),
      snoozed: Boolean(snoozedUntil)
    });
  }

  for (const task of state.scheduledTasks) {
    const snoozedUntil = task.reminderSnoozedUntil ? new Date(task.reminderSnoozedUntil) : undefined;
    const canRemindSnoozed = Boolean(snoozedUntil) && ["pending", "backlog", "archived"].includes(task.status);
    if ((!snoozedUntil && task.scheduledDate !== today) || (!canRemindSnoozed && task.status !== "pending") || task.reminderSentAt
      || !task.plannedStartTime || task.reminderMinutesBefore === undefined) continue;
    const startAt = dateAtTime(task.scheduledDate, task.plannedStartTime);
    candidates.push({
      kind: "scheduled",
      id: task.id,
      title: task.title,
      date: task.scheduledDate,
      plannedStartTime: task.plannedStartTime,
      reminderMinutesBefore: task.reminderMinutesBefore,
      startAt,
      remindAt: snoozedUntil ?? new Date(startAt.getTime() - task.reminderMinutesBefore * 60_000),
      snoozed: Boolean(snoozedUntil)
    });
  }

  return candidates
    .filter((reminder) => reminder.remindAt <= now && !isWithinQuietHours(state.settings, now))
    .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
}

export function getTaskReminderOverview(state: AppState, now: Date): TaskReminderOverviewItem[] {
  const today = toDateKey(now);
  const candidates: TaskReminder[] = [];

  for (const record of state.fixedRecords) {
    const snoozedUntil = record.reminderSnoozedUntil ? new Date(record.reminderSnoozedUntil) : undefined;
    if (record.completedAt
      || (!snoozedUntil && record.date !== today)
      || !record.plannedStartTime || record.reminderMinutesBefore === undefined) continue;
    const startAt = dateAtTime(record.date, record.plannedStartTime);
    candidates.push({
      kind: "fixed",
      id: record.id,
      title: record.titleSnapshot,
      date: record.date,
      plannedStartTime: record.plannedStartTime,
      reminderMinutesBefore: record.reminderMinutesBefore,
      startAt,
      remindAt: snoozedUntil ?? new Date(startAt.getTime() - record.reminderMinutesBefore * 60_000),
      snoozed: Boolean(snoozedUntil)
    });
  }

  for (const task of state.scheduledTasks) {
    const snoozedUntil = task.reminderSnoozedUntil ? new Date(task.reminderSnoozedUntil) : undefined;
    const canShowSnoozed = Boolean(snoozedUntil) && ["pending", "backlog", "archived"].includes(task.status);
    if (task.status === "completed"
      || (!snoozedUntil && task.scheduledDate !== today)
      || (!canShowSnoozed && task.status !== "pending")
      || !task.plannedStartTime || task.reminderMinutesBefore === undefined) continue;
    const startAt = dateAtTime(task.scheduledDate, task.plannedStartTime);
    candidates.push({
      kind: "scheduled",
      id: task.id,
      title: task.title,
      date: task.scheduledDate,
      plannedStartTime: task.plannedStartTime,
      reminderMinutesBefore: task.reminderMinutesBefore,
      startAt,
      remindAt: snoozedUntil ?? new Date(startAt.getTime() - task.reminderMinutesBefore * 60_000),
      snoozed: Boolean(snoozedUntil)
    });
  }

  return candidates.map((reminder): TaskReminderOverviewItem => ({
    ...reminder,
    status: reminder.snoozed && reminder.remindAt > now
      ? "snoozed"
      : reminder.startAt < now
        ? "missed"
        : "upcoming"
  })).sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
}

export function describeReminderOverviewItem(item: TaskReminderOverviewItem, now: Date): string {
  if (item.status === "snoozed") {
    return `${item.remindAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })} 再提醒`;
  }
  const differenceMinutes = Math.max(1, Math.ceil(Math.abs(item.startAt.getTime() - now.getTime()) / 60_000));
  if (item.status === "missed") {
    return differenceMinutes < 60 ? `已错过 ${differenceMinutes} 分钟` : `计划 ${item.plannedStartTime} 开始`;
  }
  if (item.startAt.getTime() === now.getTime()) return "现在开始";
  return differenceMinutes < 60 ? `还有 ${differenceMinutes} 分钟` : `计划 ${item.plannedStartTime} 开始`;
}

export function markTaskReminderSent(
  state: AppState,
  kind: TaskReminder["kind"],
  id: string,
  sentAt: string
): AppState {
  if (kind === "fixed") {
    return {
      ...state,
      fixedRecords: state.fixedRecords.map((record) => record.id === id
        ? { ...record, reminderSentAt: sentAt, reminderSnoozedUntil: undefined }
        : record)
    };
  }
  return {
    ...state,
    scheduledTasks: state.scheduledTasks.map((task) => task.id === id
      ? { ...task, reminderSentAt: sentAt, reminderSnoozedUntil: undefined }
      : task)
  };
}

export function snoozeTaskReminder(
  state: AppState,
  kind: TaskReminder["kind"],
  id: string,
  until: string,
  date?: DateKey
): AppState {
  if (!Number.isFinite(Date.parse(until))) return state;
  if (kind === "fixed") {
    const record = state.fixedRecords.find((item) => item.id === id);
    if (!record || record.completedAt || (date && record.date !== date)) return state;
    return {
      ...state,
      fixedRecords: state.fixedRecords.map((record) => record.id === id
        ? { ...record, reminderSentAt: undefined, reminderSnoozedUntil: until }
        : record)
    };
  }
  const task = state.scheduledTasks.find((item) => item.id === id);
  if (!task || task.status === "completed" || task.status === "rescheduled" || (date && task.scheduledDate !== date)) return state;
  return {
    ...state,
    scheduledTasks: state.scheduledTasks.map((task) => task.id === id
      ? { ...task, reminderSentAt: undefined, reminderSnoozedUntil: until }
      : task)
  };
}

export function describeTaskReminder(reminder: TaskReminder, now: Date): string {
  const minutesUntilStart = Math.ceil((reminder.startAt.getTime() - now.getTime()) / 60_000);
  if (minutesUntilStart > 0) return `还有 ${minutesUntilStart} 分钟开始`;
  if (minutesUntilStart >= -1) return "现在可以开始了";
  return `计划开始时间 ${reminder.plannedStartTime}`;
}
