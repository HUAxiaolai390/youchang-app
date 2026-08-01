import type {
  AppState,
  Category,
  DateKey,
  FixedTaskRecord,
  FixedTaskTemplate,
  ScheduledTask
} from "./types";
import { toDateKey } from "./date";

export interface AddCategoryInput {
  name: string;
  icon: string;
}

export interface AddScheduledTaskInput {
  title: string;
  categoryId: string;
  scheduledDate: DateKey;
}

export type UpdateScheduledTaskInput = AddScheduledTaskInput;

export interface AddFixedTaskInput {
  title: string;
  categoryId: string;
  activeFrom: DateKey;
}

export interface UpdateFixedTaskInput {
  title: string;
  categoryId: string;
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
    scheduledTasks: state.scheduledTasks.map(reassignScheduledTask)
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
    order: state.fixedTasks.length,
    createdAt: now.toISOString()
  };

  const record: FixedTaskRecord = {
    id: crypto.randomUUID(),
    templateId: task.id,
    date: toDateKey(now),
    titleSnapshot: task.title,
    ...categorySnapshot(category)
  };

  return {
    ...state,
    fixedTasks: [...state.fixedTasks, task],
    fixedRecords: [...state.fixedRecords, record]
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
  const task = state.fixedTasks.find((item) => item.id === id);
  if (!task) return state;

  return {
    ...state,
    fixedTasks: state.fixedTasks.map((item) => item.id === id
      ? { ...item, title, ...categorySnapshot(category) }
      : item),
    fixedRecords: state.fixedRecords.map((record) => record.templateId === id && record.date === today
      ? { ...record, titleSnapshot: title, ...categorySnapshot(category) }
      : record)
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
    order: state.fixedTasks.length,
    createdAt: now.toISOString()
  };
  const record: FixedTaskRecord = {
    id: crypto.randomUUID(),
    templateId: successor.id,
    date: today,
    titleSnapshot: successor.title,
    categoryId: successor.categoryId,
    categoryNameSnapshot: successor.categoryNameSnapshot
  };

  return {
    ...state,
    fixedTasks: state.fixedTasks.map((item) => item.id === id
      ? { ...item, successorId }
      : item).concat(successor),
    fixedRecords: [...state.fixedRecords, record]
  };
}

export function addScheduledTask(state: AppState, input: AddScheduledTaskInput, now: Date): AppState {
  const title = requireTitle(input.title);
  const category = requireCategory(state, input.categoryId);
  const task: ScheduledTask = {
    id: crypto.randomUUID(),
    title,
    ...categorySnapshot(category),
    scheduledDate: input.scheduledDate,
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
  return {
    ...state,
    scheduledTasks: state.scheduledTasks.map((item) => item.id === id
      ? {
          ...item,
          title,
          ...categorySnapshot(category),
          scheduledDate: input.scheduledDate
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

export function toggleScheduledTask(state: AppState, taskId: string, now: Date): AppState {
  if (!state.scheduledTasks.some((task) => task.id === taskId)) return state;

  return {
    ...state,
    scheduledTasks: state.scheduledTasks.map((task) => task.id === taskId
      ? task.status === "completed"
        ? { ...task, status: "pending", completedAt: undefined }
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
