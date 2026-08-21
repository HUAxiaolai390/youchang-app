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

export type TaskTimeAllocationItem = {
  taskKey: string;
  taskTitle: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  groupType: "task" | "goal";
  groupedTaskCount: number;
  inferredTaskCount: number;
  minutes: number;
  ratio: number;
};

export type TaskTimeAllocation = {
  totalMinutes: number;
  items: TaskTimeAllocationItem[];
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

export type TaskTimeAllocationOptions = {
  groupByGoal?: boolean;
};

function normalizeAllocationTitle(title: string): string {
  return (title.trim() || "自由记录")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\s·，,。.!！?？、:：;；_—-]+/g, "");
}

const genericGoalWords = [
  "全国", "大学生", "长期", "目标", "计划", "通过", "完成", "拿下",
  "备考", "备战", "准备", "考试", "竞赛", "比赛", "学习", "训练", "坚持", "提升"
] as const;

function goalAliases(title: string): string[] {
  const normalized = normalizeAllocationTitle(title);
  let distinctive = normalized;
  for (const word of genericGoalWords) distinctive = distinctive.replaceAll(word, "");

  const aliases = new Set<string>();
  if (distinctive.length >= 3) aliases.add(distinctive);
  if (normalized.includes("数学建模")) aliases.add("数模");
  if (normalized.includes("计算机三级")) aliases.add("计算机三级");
  if (normalized.includes("计算机二级")) aliases.add("计算机二级");
  if (normalized.includes("英语四级")) aliases.add("cet4");
  if (normalized.includes("英语六级")) aliases.add("cet6");
  if (normalized.includes("大学生数学竞赛")) aliases.add("cmc");

  return [...aliases];
}

function inferGoalForTitle(title: string, goals: AppState["goals"]): NonNullable<AppState["goals"]>[number] | undefined {
  const normalizedTitle = normalizeAllocationTitle(title);
  const matches = (goals ?? []).map((goal) => {
    const aliases = goalAliases(goal.title);
    const score = aliases.reduce((best, alias) => {
      if (!normalizedTitle.includes(alias)) return best;
      const aliasScore = alias.length === 2 ? 120 : 100 + Math.min(alias.length, 12);
      return Math.max(best, aliasScore);
    }, 0);
    return { goal, score };
  }).filter((match) => match.score > 0).sort((left, right) => right.score - left.score);

  if (matches.length === 0) return undefined;
  if (matches.length > 1 && matches[0].score === matches[1].score) return undefined;
  return matches[0].goal;
}

export function getTaskTimeAllocation(
  state: AppState,
  fromDate: DateKey,
  toDate: DateKey,
  options: TaskTimeAllocationOptions = {}
): TaskTimeAllocation {
  type TaskTotal = Omit<TaskTimeAllocationItem, "minutes" | "ratio" | "groupedTaskCount" | "inferredTaskCount"> & {
    minutes: number;
    taskTitles: Set<string>;
    inferredTaskTitles: Set<string>;
  };
  const totals = new Map<string, TaskTotal>();
  const fallback = state.categories.find((category) => category.id === "other");
  const goalsById = new Map((state.goals ?? []).map((goal) => [goal.id, goal]));
  const fixedTemplatesById = new Map(state.fixedTasks.map((task) => [task.id, task]));
  const add = (
    taskKey: string,
    taskTitle: string,
    categoryId: string,
    categoryNameSnapshot: string,
    minutes?: number,
    goalId?: string
  ) => {
    if (!minutes || minutes <= 0) return;
    const normalizedTitle = taskTitle.trim() || "自由记录";
    const explicitGoal = options.groupByGoal && goalId ? goalsById.get(goalId) : undefined;
    const inferredGoal = options.groupByGoal && !explicitGoal ? inferGoalForTitle(normalizedTitle, state.goals) : undefined;
    const goal = explicitGoal ?? inferredGoal;
    const inferred = Boolean(inferredGoal);
    const allocationKey = goal
      ? `goal:${goal.id}`
      : options.groupByGoal
        ? `task:${categoryId}:${normalizeAllocationTitle(normalizedTitle)}`
        : taskKey;
    const category = state.categories.find((item) => item.id === categoryId) ?? fallback;
    const current = totals.get(allocationKey);
    if (current) {
      current.minutes += minutes;
      current.taskTitles.add(normalizedTitle);
      if (inferred) current.inferredTaskTitles.add(normalizedTitle);
      return;
    }
    totals.set(allocationKey, {
      taskKey: allocationKey,
      taskTitle: goal?.title ?? normalizedTitle,
      categoryId: goal ? "goal" : category?.id ?? "other",
      categoryName: goal ? "长期目标" : category?.name ?? categoryNameSnapshot ?? "其他",
      categoryIcon: goal ? "目" : category?.icon ?? "其",
      groupType: goal ? "goal" : "task",
      taskTitles: new Set([normalizedTitle]),
      inferredTaskTitles: new Set(inferred ? [normalizedTitle] : []),
      minutes
    });
  };

  for (const record of state.fixedRecords) {
    if (record.date >= fromDate && record.date <= toDate) {
      const templateGoalId = fixedTemplatesById.get(record.templateId)?.goalId;
      add(`fixed:${record.templateId}`, record.titleSnapshot, record.categoryId, record.categoryNameSnapshot, record.actualMinutes, record.goalId ?? templateGoalId);
    }
  }
  for (const task of state.scheduledTasks) {
    if (task.scheduledDate >= fromDate && task.scheduledDate <= toDate) {
      add(`scheduled:${task.id}`, task.title, task.categoryId, task.categoryNameSnapshot, task.actualMinutes, task.goalId);
    }
  }
  for (const entry of state.timeEntries ?? []) {
    if (entry.date >= fromDate && entry.date <= toDate) {
      const normalizedTitle = entry.title.trim() || "自由记录";
      add(`entry:${entry.categoryId}:${normalizedTitle}`, normalizedTitle, entry.categoryId, entry.categoryNameSnapshot, entry.minutes);
    }
  }

  const totalMinutes = [...totals.values()].reduce((sum, item) => sum + item.minutes, 0);
  const items = [...totals.values()]
    .map((item): TaskTimeAllocationItem => ({
      taskKey: item.taskKey,
      taskTitle: item.taskTitle,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      categoryIcon: item.categoryIcon,
      groupType: item.groupType,
      groupedTaskCount: item.taskTitles.size,
      inferredTaskCount: item.inferredTaskTitles.size,
      minutes: item.minutes,
      ratio: totalMinutes === 0 ? 0 : item.minutes / totalMinutes
    }))
    .sort((left, right) => right.minutes - left.minutes || left.taskTitle.localeCompare(right.taskTitle, "zh-CN"));

  return { totalMinutes, items };
}

export function formatTrackedTime(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} 小时` : `${hours} 小时 ${remainder} 分`;
}
