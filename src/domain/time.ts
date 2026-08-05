import type { AppState, DateKey, TimeEntry } from "./types";

export const maximumActualMinutes = 10_080;

function normalizeMinutes(value: number, allowZero: boolean): number {
  if (!Number.isFinite(value)) throw new Error("请输入有效用时");
  const minimum = allowZero ? 0 : 1;
  return Math.min(maximumActualMinutes, Math.max(minimum, Math.round(value)));
}

export function setFixedActualMinutes(state: AppState, recordId: string, minutes: number): AppState {
  if (!state.fixedRecords.some((record) => record.id === recordId)) return state;
  const actualMinutes = normalizeMinutes(minutes, true);

  return {
    ...state,
    fixedRecords: state.fixedRecords.map((record) => record.id === recordId
      ? { ...record, actualMinutes: actualMinutes || undefined }
      : record)
  };
}

export function addFixedActualMinutes(state: AppState, recordId: string, minutes: number): AppState {
  const record = state.fixedRecords.find((item) => item.id === recordId);
  if (!record) return state;
  return setFixedActualMinutes(state, recordId, (record.actualMinutes ?? 0) + normalizeMinutes(minutes, false));
}

export function setScheduledActualMinutes(state: AppState, id: string, minutes: number): AppState {
  if (!state.scheduledTasks.some((task) => task.id === id)) return state;
  const actualMinutes = normalizeMinutes(minutes, true);

  return {
    ...state,
    scheduledTasks: state.scheduledTasks.map((task) => task.id === id
      ? { ...task, actualMinutes: actualMinutes || undefined }
      : task)
  };
}

export function addScheduledActualMinutes(state: AppState, id: string, minutes: number): AppState {
  const task = state.scheduledTasks.find((item) => item.id === id);
  if (!task) return state;
  return setScheduledActualMinutes(state, id, (task.actualMinutes ?? 0) + normalizeMinutes(minutes, false));
}

export type AddTimeEntryInput = {
  title: string;
  categoryId: string;
  date: DateKey;
  minutes: number;
};

export function addTimeEntry(state: AppState, input: AddTimeEntryInput, now: Date): AppState {
  const category = state.categories.find((item) => item.id === input.categoryId);
  if (!category) throw new Error("请选择有效分类");

  const entry: TimeEntry = {
    id: crypto.randomUUID(),
    title: input.title.trim() || "自由记录",
    categoryId: category.id,
    categoryNameSnapshot: category.name,
    date: input.date,
    minutes: normalizeMinutes(input.minutes, false),
    createdAt: now.toISOString()
  };

  return { ...state, timeEntries: [...(state.timeEntries ?? []), entry] };
}

export function stopwatchSecondsToMinutes(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(maximumActualMinutes, Math.max(1, Math.ceil(seconds / 60)));
}

export type TimeAllocationItem = {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  minutes: number;
  ratio: number;
};

export type TimeAllocation = {
  totalMinutes: number;
  items: TimeAllocationItem[];
};

export function getTimeAllocation(state: AppState, fromDate: DateKey, toDate: DateKey): TimeAllocation {
  const totals = new Map<string, number>();
  const add = (categoryId: string, minutes?: number) => {
    if (!minutes || minutes <= 0) return;
    totals.set(categoryId, (totals.get(categoryId) ?? 0) + minutes);
  };

  for (const record of state.fixedRecords) {
    if (record.date >= fromDate && record.date <= toDate) add(record.categoryId, record.actualMinutes);
  }
  for (const task of state.scheduledTasks) {
    if (task.scheduledDate >= fromDate && task.scheduledDate <= toDate) add(task.categoryId, task.actualMinutes);
  }
  for (const entry of state.timeEntries ?? []) {
    if (entry.date >= fromDate && entry.date <= toDate) add(entry.categoryId, entry.minutes);
  }

  const totalMinutes = [...totals.values()].reduce((sum, minutes) => sum + minutes, 0);
  const fallback = state.categories.find((category) => category.id === "other");
  const items = [...totals.entries()].map(([categoryId, minutes]): TimeAllocationItem => {
    const category = state.categories.find((item) => item.id === categoryId) ?? fallback;
    return {
      categoryId: category?.id ?? "other",
      categoryName: category?.name ?? "其他",
      categoryIcon: category?.icon ?? "其",
      minutes,
      ratio: totalMinutes === 0 ? 0 : minutes / totalMinutes
    };
  }).sort((left, right) => right.minutes - left.minutes);

  return { totalMinutes, items };
}

export function formatTrackedTime(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} 小时` : `${hours} 小时 ${remainder} 分`;
}
