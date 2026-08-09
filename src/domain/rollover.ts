import { fromDateKey, isWithinWeek, toDateKey } from "./date";
import type {
  AppState,
  DateKey,
  FixedTaskRecord,
  RescheduleRecord,
  ScheduledTask
} from "./types";
import { shouldShowFixedTaskOnDate } from "./repeat";

function eachDateAfter(lastOpenedDate: DateKey, today: DateKey): DateKey[] {
  const date = fromDateKey(lastOpenedDate);
  const dates: DateKey[] = [];

  date.setDate(date.getDate() + 1);
  while (toDateKey(date) <= today) {
    dates.push(toDateKey(date));
    date.setDate(date.getDate() + 1);
  }

  return dates;
}

function createFixedRecord(
  task: AppState["fixedTasks"][number],
  date: DateKey
): FixedTaskRecord {
  return {
    id: crypto.randomUUID(),
    templateId: task.id,
    date,
    titleSnapshot: task.title,
    categoryId: task.categoryId,
    categoryNameSnapshot: task.categoryNameSnapshot,
    plannedStartTime: task.plannedStartTime,
    estimatedMinutes: task.estimatedMinutes
  };
}

export function rollover(state: AppState, now: Date): AppState {
  const today = toDateKey(now);
  const fixedRecords = [...state.fixedRecords];

  for (const date of eachDateAfter(state.settings.lastOpenedDate, today)) {
    for (const task of state.fixedTasks) {
      const hasRecord = fixedRecords.some((record) => record.templateId === task.id && record.date === date);
      if (!hasRecord && shouldShowFixedTaskOnDate({ ...state, fixedRecords }, task, date, today)) {
        fixedRecords.push(createFixedRecord(task, date));
      }
    }
  }

  const scheduledTasks = state.scheduledTasks.map((task): ScheduledTask => {
    if (task.status === "pending" && task.scheduledDate < today) {
      return {
        ...task,
        status: isWithinWeek(task.scheduledDate, now) ? "backlog" : "archived"
      };
    }

    if (task.status === "backlog" && !isWithinWeek(task.scheduledDate, now)) {
      return { ...task, status: "archived" };
    }

    return task;
  });

  return {
    ...state,
    settings: { ...state.settings, lastOpenedDate: today },
    fixedRecords,
    scheduledTasks
  };
}

function requireReschedulableTask(state: AppState, sourceTaskId: string): ScheduledTask {
  const source = state.scheduledTasks.find((task) => task.id === sourceTaskId);
  if (!source || !["pending", "backlog", "archived"].includes(source.status)) {
    throw new Error("这个任务现在不能改期");
  }
  return source;
}

export function rescheduleTask(
  state: AppState,
  sourceTaskId: string,
  targetDate: DateKey,
  now: Date
): AppState {
  if (!isWithinWeek(targetDate, now)) {
    throw new Error("请选择本周内的日期");
  }

  const source = requireReschedulableTask(state, sourceTaskId);
  const target: ScheduledTask = {
    id: crypto.randomUUID(),
    title: source.title,
    categoryId: source.categoryId,
    categoryNameSnapshot: source.categoryNameSnapshot,
    scheduledDate: targetDate,
    status: "pending",
    sourceTaskId: source.id,
    plannedStartTime: source.plannedStartTime,
    estimatedMinutes: source.estimatedMinutes,
    createdAt: now.toISOString()
  };
  const record: RescheduleRecord = {
    id: crypto.randomUUID(),
    sourceTaskId: source.id,
    targetTaskId: target.id,
    fromDate: source.scheduledDate,
    toDate: targetDate,
    changedAt: now.toISOString()
  };

  return {
    ...state,
    scheduledTasks: state.scheduledTasks.map((task): ScheduledTask => task.id === source.id
      ? { ...task, status: "rescheduled" }
      : task).concat(target),
    reschedules: [...state.reschedules, record]
  };
}

export function moveArchivedTaskToCurrentWeek(
  state: AppState,
  sourceTaskId: string,
  targetDate: DateKey,
  now: Date
): AppState {
  const source = state.scheduledTasks.find((task) => task.id === sourceTaskId);
  if (source?.status !== "archived") {
    throw new Error("这个任务现在不能改期");
  }

  return rescheduleTask(state, sourceTaskId, targetDate, now);
}
