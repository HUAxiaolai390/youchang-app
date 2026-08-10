import type {
  AppState,
  Category,
  DateKey,
  FixedTaskRecord,
  FixedTaskTemplate,
  ScheduledTask
} from "./types";
import { isWithinWeek, toDateKey } from "./date";
import { normalizeEstimatedMinutes, normalizePlannedStartTime } from "./planning";
import { normalizeReminderMinutesBefore } from "./reminders";
import { normalizeTaskPriority } from "./priorities";
import { getFixedRepeatRule, isFixedTaskDueOnDate, normalizeFixedRepeatRule } from "./repeat";
import type { FixedRepeatRule, ReminderMinutesBefore, TaskPriority, TimeKey } from "./types";

export interface AddCategoryInput {
  name: string;
  icon: string;
}

export interface AddScheduledTaskInput {
  title: string;
  categoryId: string;
  scheduledDate: DateKey;
  plannedStartTime?: TimeKey;
  reminderMinutesBefore?: ReminderMinutesBefore;
  estimatedMinutes?: number;
  priority?: TaskPriority;
}

export type UpdateScheduledTaskInput = AddScheduledTaskInput;

export interface AddFixedTaskInput {
  title: string;
  categoryId: string;
  activeFrom: DateKey;
  plannedStartTime?: TimeKey;
  reminderMinutesBefore?: ReminderMinutesBefore;
  estimatedMinutes?: number;
  repeatRule?: FixedRepeatRule;
  priority?: TaskPriority;
}

export interface UpdateFixedTaskInput {
  title: string;
  categoryId: string;
  plannedStartTime?: TimeKey;
  reminderMinutesBefore?: ReminderMinutesBefore;
  estimatedMinutes?: number;
  repeatRule?: FixedRepeatRule;
  priority?: TaskPriority;
}

export type TaskKind = "fixed" | "scheduled";

function requireTitle(value: string) {
  const title = value.trim();
  if (!title) throw new Error("请输入任务名称");
  return title;
}

function requireCategoryName(value: string) {
  const name = value.trim();
  if (!name) throw new Error("请输入分类名称");
  return name;
}

function requireCategory(state: AppState, categoryId: string) {
  const category = state.categories.find((item) => item.id === categoryId);
  if (!category) throw new Error("请选择有效分类");
  return category;
}

function categorySnapshot(category: Category) {
  return {
    categoryId: category.id,
    categoryNameSnapshot: category.name
  };
}

export function addCategory(state: AppState, input: AddCategoryInput, now: Date): AppState {
  const name = requireCategoryName(input.name);
  const normalizedName = name.toLowerCase();

  if (state.categories.some((category) => category.name.trim().toLowerCase() === normalizedName)) {
    throw new Error("分类名称已存在");
  }

  const category: Category = {
    id: crypto.randomUUID(),
    name,
    icon: input.icon,
    builtIn: false,
    order: state.categories.length,
    createdAt: now.toISOString()
  };

  return { ...state, categories: [...state.categories, category] };
}

export function deleteCategory(state: AppState, categoryId: string): AppState {
  const category = state.categories.find((item) => item.id === categoryId);
  if (!category || category.builtIn) return state;

  const reassignFixedTask = (task: FixedTaskTemplate) => task.categoryId === categoryId
    ? { ...task, categoryId: "other" }
    : task;
  const reassignScheduledTask = (task: ScheduledTask) => task.categoryId === categoryId
    ? { ...task, categoryId: "other" }
    : task;

  return {
    ...state,
    categories: state.categories.filter((item) => item.id !== categoryId),
    fixedTasks: state.fixedTasks.map(reassignFixedTask),
    fixedRecords: state.fixedRecords.map((record) => record.categoryId === categoryId
      ? { ...record, categoryId: "other" }
      : record),
    scheduledTasks: state.scheduledTasks.map(reassignScheduledTask),
    timeEntries: (state.timeEntries ?? []).map((entry) => entry.categoryId === categoryId
      ? { ...entry, categoryId: "other" }
      : entry)
  };
}

function createFixedRecord(task: FixedTaskTemplate, date: DateKey, completedAt?: string): FixedTaskRecord {
  return {
    id: crypto.randomUUID(),
    templateId: task.id,
    date,
    titleSnapshot: task.title,
    categoryId: task.categoryId,
    categoryNameSnapshot: task.categoryNameSnapshot,
    completedAt,
    plannedStartTime: task.plannedStartTime,
    reminderMinutesBefore: task.reminderMinutesBefore,
    priority: task.priority,
    estimatedMinutes: task.estimatedMinutes
  };
}

export function addFixedTask(state: AppState, input: AddFixedTaskInput, now: Date): AppState {
  const title = requireTitle(input.title);
  const category = requireCategory(state, input.categoryId);
  const task: FixedTaskTemplate = {
    id: crypto.randomUUID(),
    title,
    ...categorySnapshot(category),
    activeFrom: input.activeFrom,
    plannedStartTime: normalizePlannedStartTime(input.plannedStartTime),
    reminderMinutesBefore: input.plannedStartTime
      ? normalizeReminderMinutesBefore(input.reminderMinutesBefore)
      : undefined,
    estimatedMinutes: normalizeEstimatedMinutes(input.estimatedMinutes),
    priority: normalizeTaskPriority(input.priority),
    repeatRule: normalizeFixedRepeatRule(input.repeatRule),
    order: state.fixedTasks.length,
    createdAt: now.toISOString()
  };

  const today = toDateKey(now);
  const nextState = { ...state, fixedTasks: [...state.fixedTasks, task] };

  return {
    ...state,
    fixedTasks: [...state.fixedTasks, task],
    fixedRecords: isFixedTaskDueOnDate(nextState, task, today)
      ? [...state.fixedRecords, createFixedRecord(task, today)]
      : state.fixedRecords
  };
}

export function updateFixedTask(
  state: AppState,
  id: string,
  input: UpdateFixedTaskInput,
  today: DateKey
): AppState {
  const title = requireTitle(input.title);
  const category = requireCategory(state, input.categoryId);
  const plannedStartTime = normalizePlannedStartTime(input.plannedStartTime);
  const reminderMinutesBefore = plannedStartTime
    ? normalizeReminderMinutesBefore(input.reminderMinutesBefore)
    : undefined;
  const estimatedMinutes = normalizeEstimatedMinutes(input.estimatedMinutes);
  const task = state.fixedTasks.find((item) => item.id === id);
  if (!task) return state;
  const priority = normalizeTaskPriority(input.priority ?? task.priority);
  const repeatRule = normalizeFixedRepeatRule(input.repeatRule ?? getFixedRepeatRule(task));
  const updatedTask = { ...task, title, ...categorySnapshot(category), plannedStartTime, reminderMinutesBefore, estimatedMinutes, priority, repeatRule };
  const fixedTasks = state.fixedTasks.map((item) => item.id === id ? updatedTask : item);
  let fixedRecords = state.fixedRecords.map((record) => record.templateId === id && record.date === today
    ? { ...record, titleSnapshot: title, ...categorySnapshot(category), plannedStartTime, reminderMinutesBefore, reminderSentAt: undefined, estimatedMinutes, priority }
    : record);
  const todayRecord = fixedRecords.find((record) => record.templateId === id && record.date === today);
  const previewState = { ...state, fixedTasks, fixedRecords };
  const dueToday = isFixedTaskDueOnDate(previewState, updatedTask, today);
  if (dueToday && !todayRecord) fixedRecords = [...fixedRecords, createFixedRecord(updatedTask, today)];
  if (!dueToday && todayRecord && !todayRecord.completedAt) {
    fixedRecords = fixedRecords.filter((record) => record.id !== todayRecord.id);
  }

  return {
    ...state,
    fixedTasks,
    fixedRecords
  };
}

export function setFixedTaskActive(
  state: AppState,
  id: string,
  active: boolean,
  now: Date
): AppState {
  const today = toDateKey(now);
  const task = state.fixedTasks.find((item) => item.id === id);
  if (!task) return state;

  if (!active) {
    if (task.inactiveFrom) return state;
    return {
      ...state,
      fixedTasks: state.fixedTasks.map((item) => item.id === id
        ? { ...item, inactiveFrom: today }
        : item)
    };
  }

  if (!task.inactiveFrom || task.successorId) return state;

  const successorId = crypto.randomUUID();
  const currentCategoryName = state.categories.find((category) => category.id === task.categoryId)?.name
    ?? state.categories.find((category) => category.id === "other")?.name
    ?? "其他";
  const successor: FixedTaskTemplate = {
    ...task,
    id: successorId,
    categoryNameSnapshot: currentCategoryName,
    activeFrom: today,
    inactiveFrom: undefined,
    successorId: undefined,
    pausedUntil: undefined,
    skippedDates: [],
    order: state.fixedTasks.length,
    createdAt: now.toISOString()
  };
  const fixedTasks = state.fixedTasks.map((item) => item.id === id
    ? { ...item, successorId }
    : item).concat(successor);
  const previewState = { ...state, fixedTasks };

  return {
    ...state,
    fixedTasks,
    fixedRecords: isFixedTaskDueOnDate(previewState, successor, today)
      ? [...state.fixedRecords, createFixedRecord(successor, today)]
      : state.fixedRecords
  };
}

export function toggleFixedTaskSkipDate(state: AppState, id: string, date: DateKey, now: Date): AppState {
  const task = state.fixedTasks.find((item) => item.id === id);
  if (!task) return state;
  const skippedDates = task.skippedDates ?? [];
  const isSkipped = skippedDates.includes(date);
  const nextTask = {
    ...task,
    skippedDates: isSkipped ? skippedDates.filter((item) => item !== date) : [...skippedDates, date].sort()
  };
  const fixedTasks = state.fixedTasks.map((item) => item.id === id ? nextTask : item);
  let fixedRecords = isSkipped
    ? state.fixedRecords
    : state.fixedRecords.filter((record) => record.templateId !== id || record.date !== date || Boolean(record.completedAt));

  const today = toDateKey(now);
  const existing = fixedRecords.some((record) => record.templateId === id && record.date === date);
  if (isSkipped && date === today && !existing && isFixedTaskDueOnDate({ ...state, fixedTasks, fixedRecords }, nextTask, date)) {
    fixedRecords = [...fixedRecords, createFixedRecord(nextTask, date)];
  }

  return { ...state, fixedTasks, fixedRecords };
}

export function setFixedTaskPausedUntil(state: AppState, id: string, pausedUntil: DateKey | undefined, now: Date): AppState {
  const task = state.fixedTasks.find((item) => item.id === id);
  if (!task) return state;
  const today = toDateKey(now);
  if (pausedUntil && pausedUntil < today) throw new Error("暂停日期不能早于今天");

  const nextTask = { ...task, pausedUntil };
  const fixedTasks = state.fixedTasks.map((item) => item.id === id ? nextTask : item);
  let fixedRecords = pausedUntil
    ? state.fixedRecords.filter((record) => (
        record.templateId !== id
        || record.date < today
        || record.date > pausedUntil
        || Boolean(record.completedAt)
      ))
    : state.fixedRecords;
  const existing = fixedRecords.some((record) => record.templateId === id && record.date === today);
  if (!pausedUntil && !existing && isFixedTaskDueOnDate({ ...state, fixedTasks, fixedRecords }, nextTask, today)) {
    fixedRecords = [...fixedRecords, createFixedRecord(nextTask, today)];
  }

  return { ...state, fixedTasks, fixedRecords };
}

export function addScheduledTask(state: AppState, input: AddScheduledTaskInput, now: Date): AppState {
  const title = requireTitle(input.title);
  const category = requireCategory(state, input.categoryId);
  const task: ScheduledTask = {
    id: crypto.randomUUID(),
    title,
    ...categorySnapshot(category),
    scheduledDate: input.scheduledDate,
    plannedStartTime: normalizePlannedStartTime(input.plannedStartTime),
    reminderMinutesBefore: input.plannedStartTime
      ? normalizeReminderMinutesBefore(input.reminderMinutesBefore)
      : undefined,
    estimatedMinutes: normalizeEstimatedMinutes(input.estimatedMinutes),
    priority: normalizeTaskPriority(input.priority),
    status: "pending",
    createdAt: now.toISOString()
  };

  return { ...state, scheduledTasks: [...state.scheduledTasks, task] };
}

export function updateScheduledTask(
  state: AppState,
  id: string,
  input: UpdateScheduledTaskInput
): AppState {
  const task = state.scheduledTasks.find((item) => item.id === id);
  if (!task || (task.status !== "pending" && task.status !== "backlog")) return state;

  const title = requireTitle(input.title);
  const category = requireCategory(state, input.categoryId);
  const plannedStartTime = normalizePlannedStartTime(input.plannedStartTime);
  const reminderMinutesBefore = plannedStartTime
    ? normalizeReminderMinutesBefore(input.reminderMinutesBefore)
    : undefined;
  const estimatedMinutes = normalizeEstimatedMinutes(input.estimatedMinutes);
  const priority = normalizeTaskPriority(input.priority ?? task.priority);
  return {
    ...state,
    scheduledTasks: state.scheduledTasks.map((item) => item.id === id
      ? {
          ...item,
          title,
          ...categorySnapshot(category),
          scheduledDate: input.scheduledDate,
          plannedStartTime,
          reminderMinutesBefore,
          reminderSentAt: undefined,
          estimatedMinutes,
          priority
        }
      : item)
  };
}

export function toggleFixedRecord(state: AppState, recordId: string, now: Date): AppState {
  if (!state.fixedRecords.some((record) => record.id === recordId)) return state;

  return {
    ...state,
    fixedRecords: state.fixedRecords.map((record): FixedTaskRecord => record.id === recordId
      ? { ...record, completedAt: record.completedAt ? undefined : now.toISOString() }
      : record)
  };
}

export function toggleFixedTaskForDate(
  state: AppState,
  templateId: string,
  date: DateKey,
  now: Date
): AppState {
  const existing = state.fixedRecords.find((record) => record.templateId === templateId && record.date === date);
  if (existing) return toggleFixedRecord(state, existing.id, now);

  const template = state.fixedTasks.find((task) => task.id === templateId);
  if (!template || !isFixedTaskDueOnDate(state, template, date)) {
    return state;
  }

  return {
    ...state,
    fixedRecords: [...state.fixedRecords, createFixedRecord(template, date, now.toISOString())]
  };
}

export function toggleScheduledTask(state: AppState, taskId: string, now: Date): AppState {
  if (!state.scheduledTasks.some((task) => task.id === taskId)) return state;

  return {
    ...state,
    scheduledTasks: state.scheduledTasks.map((task) => task.id === taskId
      ? task.status === "completed"
        ? {
            ...task,
            status: task.scheduledDate >= toDateKey(now)
              ? "pending"
              : isWithinWeek(task.scheduledDate, now) ? "backlog" : "archived",
            completedAt: undefined
          }
        : { ...task, status: "completed", completedAt: now.toISOString() }
      : task)
  };
}

export function deleteTask(state: AppState, kind: TaskKind, id: string): AppState {
  if (kind === "fixed") {
    if (!state.fixedTasks.some((task) => task.id === id)) return state;
    return { ...state, fixedTasks: state.fixedTasks.filter((task) => task.id !== id) };
  }

  if (!state.scheduledTasks.some((task) => task.id === id)) return state;
  return { ...state, scheduledTasks: state.scheduledTasks.filter((task) => task.id !== id) };
}
