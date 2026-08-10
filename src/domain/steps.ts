import type { AppState, TaskStep } from "./types";

export const maximumTaskSteps = 20;

export type TaskStepInput = {
  id?: string;
  title: string;
  completed?: boolean;
};

export function normalizeTaskSteps(value: TaskStepInput[] | undefined): TaskStep[] {
  const nonEmpty = (value ?? []).filter((step) => step.title.trim());
  if (nonEmpty.length > maximumTaskSteps) throw new Error(`任务步骤最多添加 ${maximumTaskSteps} 项`);

  const usedIds = new Set<string>();
  return nonEmpty.map((step) => {
    const requestedId = step.id?.trim();
    const id = requestedId && !usedIds.has(requestedId) ? requestedId : crypto.randomUUID();
    usedIds.add(id);
    return { id, title: step.title.trim(), completed: Boolean(step.completed) };
  });
}

export function resetTaskSteps(steps: TaskStep[] | undefined): TaskStep[] {
  return (steps ?? []).map((step) => ({ ...step, completed: false }));
}

export function getTaskStepProgress(steps: TaskStep[] | undefined) {
  const total = steps?.length ?? 0;
  const completed = steps?.filter((step) => step.completed).length ?? 0;
  return { completed, total, ratio: total === 0 ? 0 : completed / total };
}

export function toggleFixedTaskStep(state: AppState, recordId: string, stepId: string): AppState {
  return {
    ...state,
    fixedRecords: state.fixedRecords.map((record) => record.id === recordId
      ? { ...record, steps: record.steps?.map((step) => step.id === stepId ? { ...step, completed: !step.completed } : step) }
      : record)
  };
}

export function toggleScheduledTaskStep(state: AppState, taskId: string, stepId: string): AppState {
  return {
    ...state,
    scheduledTasks: state.scheduledTasks.map((task) => task.id === taskId
      ? { ...task, steps: task.steps?.map((step) => step.id === stepId ? { ...step, completed: !step.completed } : step) }
      : task)
  };
}
