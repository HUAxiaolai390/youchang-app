import { fromDateKey, toDateKey } from "./date";
import type { AppState, DateKey, ReminderMinutesBefore, TimeKey } from "./types";

export const reminderMinuteOptions: ReadonlyArray<{ value: ReminderMinutesBefore; label: string }> = [
  { value: 0, label: "准时提醒" },
  { value: 5, label: "提前 5 分钟" },
  { value: 10, label: "提前 10 分钟" },
  { value: 30, label: "提前 30 分钟" },
  { value: 60, label: "提前 1 小时" }
];

const validReminderMinutes = new Set<ReminderMinutesBefore>(reminderMinuteOptions.map((option) => option.value));
const reminderGraceMinutes = 30;

export type TaskReminder = {
  kind: "fixed" | "scheduled";
  id: string;
  title: string;
  date: DateKey;
  plannedStartTime: TimeKey;
  reminderMinutesBefore: ReminderMinutesBefore;
  startAt: Date;
  remindAt: Date;
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

export function getPendingTaskReminders(state: AppState, now: Date): TaskReminder[] {
  const today = toDateKey(now);
  const candidates: TaskReminder[] = [];

  for (const record of state.fixedRecords) {
    if (record.date !== today || record.completedAt || record.reminderSentAt
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
      remindAt: new Date(startAt.getTime() - record.reminderMinutesBefore * 60_000)
    });
  }

  for (const task of state.scheduledTasks) {
    if (task.scheduledDate !== today || task.status !== "pending" || task.reminderSentAt
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
      remindAt: new Date(startAt.getTime() - task.reminderMinutesBefore * 60_000)
    });
  }

  return candidates
    .filter((reminder) => reminder.remindAt <= now
      && now.getTime() <= reminder.startAt.getTime() + reminderGraceMinutes * 60_000)
    .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
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
        ? { ...record, reminderSentAt: sentAt }
        : record)
    };
  }
  return {
    ...state,
    scheduledTasks: state.scheduledTasks.map((task) => task.id === id
      ? { ...task, reminderSentAt: sentAt }
      : task)
  };
}

export function describeTaskReminder(reminder: TaskReminder, now: Date): string {
  const minutesUntilStart = Math.ceil((reminder.startAt.getTime() - now.getTime()) / 60_000);
  if (minutesUntilStart > 0) return `还有 ${minutesUntilStart} 分钟开始`;
  if (minutesUntilStart >= -1) return "现在可以开始了";
  return `计划开始时间 ${reminder.plannedStartTime}`;
}
