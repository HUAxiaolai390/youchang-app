import { fromDateKey, getWeek, toDateKey } from "./date";
import type { AppState, DateKey, TimeKey } from "./types";
import { formatFixedRepeatRule, shouldShowFixedTaskOnDate } from "./repeat";

export type WeekPlanTask = {
  id: string;
  taskId: string;
  kind: "fixed" | "scheduled";
  title: string;
  categoryId: string;
  categoryName: string;
  date: DateKey;
  status: "pending" | "completed" | "backlog";
  plannedStartTime?: TimeKey;
  estimatedMinutes?: number;
  actualMinutes?: number;
  repeatLabel?: string;
};

export type WeekPlanDay = {
  date: DateKey;
  tasks: WeekPlanTask[];
  completed: number;
  estimatedMinutes: number;
  actualMinutes: number;
};

export function getWeekDates(anchor: Date): DateKey[] {
  const { start } = getWeek(anchor);
  const date = fromDateKey(start);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date);
    day.setDate(date.getDate() + index);
    return toDateKey(day);
  });
}

function compareTasks(left: WeekPlanTask, right: WeekPlanTask): number {
  const leftTime = left.plannedStartTime ?? "99:99";
  const rightTime = right.plannedStartTime ?? "99:99";
  if (leftTime !== rightTime) return leftTime.localeCompare(rightTime);
  if (left.kind !== right.kind) return left.kind === "fixed" ? -1 : 1;
  return left.title.localeCompare(right.title, "zh-CN");
}

export function getWeekPlan(state: AppState, anchor: Date): WeekPlanDay[] {
  const categoryNames = new Map(state.categories.map((category) => [category.id, category.name]));
  const liveCategoryName = (categoryId: string) => categoryNames.get(categoryId)
    ?? categoryNames.get("other")
    ?? "其他";

  const today = toDateKey(anchor);
  return getWeekDates(anchor).map((date) => {
    const tasks: WeekPlanTask[] = [];

    for (const template of state.fixedTasks) {
      const record = state.fixedRecords.find((item) => item.templateId === template.id && item.date === date);
      if (!record && !shouldShowFixedTaskOnDate(state, template, date, today)) continue;
      tasks.push({
        id: record?.id ?? `${template.id}:${date}`,
        taskId: template.id,
        kind: "fixed",
        title: record?.titleSnapshot ?? template.title,
        categoryId: record?.categoryId ?? template.categoryId,
        categoryName: liveCategoryName(record?.categoryId ?? template.categoryId),
        date,
        status: record?.completedAt ? "completed" : "pending",
        plannedStartTime: record?.plannedStartTime ?? template.plannedStartTime,
        estimatedMinutes: record?.estimatedMinutes ?? template.estimatedMinutes,
        actualMinutes: record?.actualMinutes,
        repeatLabel: formatFixedRepeatRule(template.repeatRule)
      });
    }

    for (const task of state.scheduledTasks) {
      if (task.scheduledDate !== date || !["pending", "completed", "backlog"].includes(task.status)) continue;
      tasks.push({
        id: task.id,
        taskId: task.id,
        kind: "scheduled",
        title: task.title,
        categoryId: task.categoryId,
        categoryName: liveCategoryName(task.categoryId),
        date,
        status: task.status as WeekPlanTask["status"],
        plannedStartTime: task.plannedStartTime,
        estimatedMinutes: task.estimatedMinutes,
        actualMinutes: task.actualMinutes
      });
    }

    tasks.sort(compareTasks);
    return {
      date,
      tasks,
      completed: tasks.filter((task) => task.status === "completed").length,
      estimatedMinutes: tasks.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0),
      actualMinutes: tasks.reduce((sum, task) => sum + (task.actualMinutes ?? 0), 0)
    };
  });
}
