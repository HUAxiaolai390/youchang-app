import { toDateKey } from "./date";
import type { AppState } from "./types";

export const maximumTodayFocusTasks = 3;

export function getTodayFocusCount(state: AppState, now: Date): number {
  const today = toDateKey(now);
  const fixedCount = state.fixedRecords.filter((record) => record.date === today && record.isTodayFocus).length;
  const scheduledCount = state.scheduledTasks.filter((task) => (
    task.scheduledDate === today
    && !["rescheduled", "archived"].includes(task.status)
    && task.isTodayFocus
  )).length;
  return fixedCount + scheduledCount;
}

export function toggleTodayFocus(
  state: AppState,
  kind: "fixed" | "scheduled",
  id: string,
  now: Date
): AppState {
  const today = toDateKey(now);
  const fixedRecord = kind === "fixed"
    ? state.fixedRecords.find((record) => record.id === id && record.date === today)
    : undefined;
  const scheduledTask = kind === "scheduled"
    ? state.scheduledTasks.find((task) => task.id === id && task.scheduledDate === today && !["rescheduled", "archived"].includes(task.status))
    : undefined;
  const target = fixedRecord ?? scheduledTask;
  if (!target) return state;

  if (!target.isTodayFocus && getTodayFocusCount(state, now) >= maximumTodayFocusTasks) {
    throw new Error("今日重点最多设置 3 项");
  }

  if (kind === "fixed") {
    return {
      ...state,
      fixedRecords: state.fixedRecords.map((record) => record.id === id
        ? { ...record, isTodayFocus: !record.isTodayFocus }
        : record)
    };
  }

  return {
    ...state,
    scheduledTasks: state.scheduledTasks.map((task) => task.id === id
      ? { ...task, isTodayFocus: !task.isTodayFocus }
      : task)
  };
}
