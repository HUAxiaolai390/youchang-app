import { fromDateKey, toDateKey } from "./date";
import type { AppState, DateKey, Goal } from "./types";

export const maximumGoals = 20;
export const maximumGoalTitleLength = 60;

export type GoalProgress = {
  goal: Goal;
  completedTasks: number;
  totalTasks: number;
  ratio: number;
  actualMinutes: number;
  daysRemaining: number;
};

function normalizeTitle(value: string): string {
  const title = value.trim();
  if (!title) throw new Error("请输入目标名称");
  if (title.length > maximumGoalTitleLength) throw new Error(`目标名称最多 ${maximumGoalTitleLength} 个字`);
  return title;
}

function normalizeDeadline(value: DateKey): DateKey {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("请选择有效截止日期");
  const date = fromDateKey(value);
  if (toDateKey(date) !== value) throw new Error("请选择有效截止日期");
  return value;
}

export function addGoal(state: AppState, title: string, deadline: DateKey, now: Date): AppState {
  const goals = state.goals ?? [];
  if (goals.length >= maximumGoals) throw new Error(`长期目标最多添加 ${maximumGoals} 项`);
  const normalizedDeadline = normalizeDeadline(deadline);
  if (normalizedDeadline < toDateKey(now)) throw new Error("截止日期不能早于今天");
  const goal: Goal = {
    id: crypto.randomUUID(),
    title: normalizeTitle(title),
    deadline: normalizedDeadline,
    createdAt: now.toISOString()
  };
  return { ...state, goals: [...goals, goal] };
}

export function updateGoal(state: AppState, id: string, title: string, deadline: DateKey, now: Date): AppState {
  const goals = state.goals ?? [];
  const current = goals.find((goal) => goal.id === id);
  if (!current) return state;
  const normalizedDeadline = normalizeDeadline(deadline);
  if (normalizedDeadline < toDateKey(now) && normalizedDeadline !== current.deadline) {
    throw new Error("截止日期不能早于今天");
  }
  return {
    ...state,
    goals: goals.map((goal) => goal.id === id
      ? { ...goal, title: normalizeTitle(title), deadline: normalizedDeadline }
      : goal)
  };
}

export function deleteGoal(state: AppState, id: string): AppState {
  if (!(state.goals ?? []).some((goal) => goal.id === id)) return state;
  return {
    ...state,
    goals: (state.goals ?? []).filter((goal) => goal.id !== id),
    fixedTasks: state.fixedTasks.map((task) => task.goalId === id ? { ...task, goalId: undefined } : task),
    fixedRecords: state.fixedRecords.map((record) => record.goalId === id ? { ...record, goalId: undefined } : record),
    scheduledTasks: state.scheduledTasks.map((task) => task.goalId === id ? { ...task, goalId: undefined } : task)
  };
}

export function normalizeGoalId(state: AppState, value: unknown): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || !(state.goals ?? []).some((goal) => goal.id === value)) {
    throw new Error("请选择有效目标");
  }
  return value;
}

export function getGoalProgress(state: AppState, goal: Goal, now: Date): GoalProgress {
  const fixedRecords = state.fixedRecords.filter((record) => record.goalId === goal.id && record.date <= toDateKey(now));
  const scheduledTasks = state.scheduledTasks.filter((task) => task.goalId === goal.id && task.status !== "rescheduled");
  const completedTasks = fixedRecords.filter((record) => Boolean(record.completedAt)).length
    + scheduledTasks.filter((task) => task.status === "completed").length;
  const totalTasks = fixedRecords.length + scheduledTasks.length;
  const actualMinutes = fixedRecords.reduce((sum, record) => sum + (record.actualMinutes ?? 0), 0)
    + scheduledTasks.reduce((sum, task) => sum + (task.actualMinutes ?? 0), 0);
  const today = fromDateKey(toDateKey(now));
  const deadline = fromDateKey(goal.deadline);
  const daysRemaining = Math.round((deadline.getTime() - today.getTime()) / 86_400_000);
  return {
    goal,
    completedTasks,
    totalTasks,
    ratio: totalTasks ? completedTasks / totalTasks : 0,
    actualMinutes,
    daysRemaining
  };
}

export function getGoalsProgress(state: AppState, now: Date): GoalProgress[] {
  return [...(state.goals ?? [])]
    .sort((left, right) => left.deadline.localeCompare(right.deadline) || left.createdAt.localeCompare(right.createdAt))
    .map((goal) => getGoalProgress(state, goal, now));
}
