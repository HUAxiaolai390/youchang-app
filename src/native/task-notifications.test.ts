import { describe, expect, it } from "vitest";
import { createInitialState } from "../domain/defaults";
import { buildNativeTaskNotifications } from "./task-notifications";

describe("native task notifications", () => {
  it("builds an Android notification with task details and a stable id", () => {
    const now = new Date(2026, 7, 9, 8);
    const state = createInitialState(now);
    state.scheduledTasks.push({
      id: "math-model", title: "数模学习", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "pending", createdAt: now.toISOString(),
      plannedStartTime: "09:30", reminderMinutesBefore: 10
    });

    const first = buildNativeTaskNotifications(state, now);
    const second = buildNativeTaskNotifications(state, now);

    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      id: second[0].id,
      title: "有常 · 数模学习",
      body: "计划 09:30 开始，还有 10 分钟。",
      autoCancel: true,
      extra: { source: "youchang-task-reminder", taskId: "math-model" }
    });
    expect(first[0].schedule?.at).toEqual(new Date(2026, 7, 9, 9, 20));
    expect(first[0].schedule?.allowWhileIdle).toBe(true);
  });

  it("removes completed tasks from the next synchronization", () => {
    const now = new Date(2026, 7, 9, 8);
    const state = createInitialState(now);
    state.scheduledTasks.push({
      id: "done", title: "已完成", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "completed", createdAt: now.toISOString(),
      plannedStartTime: "09:30", reminderMinutesBefore: 0
    });

    expect(buildNativeTaskNotifications(state, now)).toEqual([]);
  });
});
