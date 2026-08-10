import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import {
  getTaskStepProgress,
  maximumTaskSteps,
  normalizeTaskSteps,
  resetTaskSteps,
  toggleFixedTaskStep,
  toggleScheduledTaskStep
} from "./steps";

describe("task steps", () => {
  it("normalizes non-empty steps and reports their progress", () => {
    const steps = normalizeTaskSteps([
      { id: "research", title: " 查资料 ", completed: true },
      { id: "draft", title: "写正文" },
      { title: "  " }
    ]);

    expect(steps).toHaveLength(2);
    expect(steps[0]).toEqual({ id: "research", title: "查资料", completed: true });
    expect(getTaskStepProgress(steps)).toEqual({ completed: 1, total: 2, ratio: 0.5 });
    expect(resetTaskSteps(steps).every((step) => !step.completed)).toBe(true);
  });

  it("rejects more than twenty non-empty steps", () => {
    expect(() => normalizeTaskSteps(Array.from({ length: maximumTaskSteps + 1 }, (_, index) => ({
      title: `步骤 ${index + 1}`
    })))).toThrow("任务步骤最多添加 20 项");
  });

  it("toggles fixed and scheduled steps independently", () => {
    const state = createInitialState(new Date(2026, 7, 11, 8));
    state.fixedRecords.push({
      id: "record", templateId: "fixed", date: "2026-08-11", titleSnapshot: "锻炼",
      categoryId: "exercise", categoryNameSnapshot: "运动",
      steps: [{ id: "warmup", title: "热身", completed: false }]
    });
    state.scheduledTasks.push({
      id: "scheduled", title: "论文", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-11", status: "pending", createdAt: "2026-08-11T00:00:00.000Z",
      steps: [{ id: "draft", title: "写正文", completed: false }]
    });

    const fixed = toggleFixedTaskStep(state, "record", "warmup");
    const scheduled = toggleScheduledTaskStep(fixed, "scheduled", "draft");
    expect(scheduled.fixedRecords[0]?.steps?.[0]?.completed).toBe(true);
    expect(scheduled.scheduledTasks[0]?.steps?.[0]?.completed).toBe(true);
  });
});
