import type { TaskPriority } from "./types";

export const taskPriorityOptions: Array<{
  value: TaskPriority;
  label: string;
  description: string;
}> = [
  { value: "high", label: "高", description: "重要且紧急" },
  { value: "medium", label: "中", description: "重要或紧急" },
  { value: "low", label: "低", description: "日常且可灵活安排" }
];

export function isTaskPriority(value: unknown): value is TaskPriority {
  return value === "high" || value === "medium" || value === "low";
}

export function normalizeTaskPriority(value: unknown): TaskPriority {
  return isTaskPriority(value) ? value : "medium";
}

export function formatTaskPriority(value: TaskPriority | undefined): string {
  const priority = normalizeTaskPriority(value);
  return taskPriorityOptions.find((option) => option.value === priority)?.label ?? "中";
}

export function taskPriorityRank(value: TaskPriority | undefined): number {
  const priority = normalizeTaskPriority(value);
  return priority === "high" ? 0 : priority === "medium" ? 1 : 2;
}
