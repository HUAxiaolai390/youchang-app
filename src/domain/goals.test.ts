import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import { addGoal, deleteGoal, getGoalProgress, updateGoal } from "./goals";

describe("long-term goals", () => {
  it("adds, edits, and deletes a goal while keeping its tasks", () => {
    const now = new Date(2026, 7, 11, 9);
    const added = addGoal(createInitialState(now), "  通过英语六级  ", "2026-12-20", now);
    const goal = added.goals![0];
    expect(goal).toMatchObject({ title: "通过英语六级", deadline: "2026-12-20" });

    added.scheduledTasks.push({
      id: "words", title: "背单词", categoryId: "study", categoryNameSnapshot: "学习",
      goalId: goal.id, scheduledDate: "2026-08-11", status: "pending", createdAt: now.toISOString()
    });
    const updated = updateGoal(added, goal.id, "英语六级 550 分", "2026-12-25", now);
    expect(updated.goals![0]).toMatchObject({ title: "英语六级 550 分", deadline: "2026-12-25" });

    const deleted = deleteGoal(updated, goal.id);
    expect(deleted.goals).toEqual([]);
    expect(deleted.scheduledTasks[0]).toMatchObject({ id: "words", goalId: undefined });
  });

  it("calculates completion and invested time from linked task records", () => {
    const now = new Date(2026, 7, 11, 9);
    const state = createInitialState(now);
    state.goals = [{ id: "english", title: "通过英语六级", deadline: "2026-08-31", createdAt: now.toISOString() }];
    state.fixedRecords.push({
      id: "fixed-done", templateId: "words", date: "2026-08-11", titleSnapshot: "英语单词",
      categoryId: "study", categoryNameSnapshot: "学习", goalId: "english",
      completedAt: now.toISOString(), actualMinutes: 25
    });
    state.scheduledTasks.push({
      id: "listening", title: "英语听力", categoryId: "study", categoryNameSnapshot: "学习",
      goalId: "english", scheduledDate: "2026-08-11", status: "pending", actualMinutes: 35,
      createdAt: now.toISOString()
    }, {
      id: "old-copy", title: "旧任务", categoryId: "study", categoryNameSnapshot: "学习",
      goalId: "english", scheduledDate: "2026-08-10", status: "rescheduled", actualMinutes: 50,
      createdAt: now.toISOString()
    });

    expect(getGoalProgress(state, state.goals[0], now)).toMatchObject({
      completedTasks: 1,
      totalTasks: 2,
      ratio: 0.5,
      actualMinutes: 60,
      latestActionDate: "2026-08-11",
      recentStreakDays: 1,
      daysRemaining: 20
    });
  });

  it("tracks the latest action date and most recent streak", () => {
    const now = new Date(2026, 7, 11, 9);
    const state = createInitialState(now);
    state.goals = [{ id: "exam", title: "通过计算机三级", deadline: "2026-09-30", createdAt: now.toISOString() }];
    state.scheduledTasks.push(
      { id: "day-1", title: "刷题", categoryId: "study", categoryNameSnapshot: "学习", goalId: "exam", scheduledDate: "2026-08-09", status: "completed", createdAt: now.toISOString() },
      { id: "day-2", title: "刷题", categoryId: "study", categoryNameSnapshot: "学习", goalId: "exam", scheduledDate: "2026-08-10", status: "completed", createdAt: now.toISOString() },
      { id: "day-3", title: "错题复盘", categoryId: "study", categoryNameSnapshot: "学习", goalId: "exam", scheduledDate: "2026-08-11", status: "pending", actualMinutes: 20, createdAt: now.toISOString() }
    );

    expect(getGoalProgress(state, state.goals[0], now)).toMatchObject({
      completedTasks: 2,
      latestActionDate: "2026-08-11",
      recentStreakDays: 3,
      actualMinutes: 20
    });
  });

  it("rejects a blank title and a past deadline", () => {
    const now = new Date(2026, 7, 11, 9);
    const state = createInitialState(now);
    expect(() => addGoal(state, " ", "2026-08-31", now)).toThrow("请输入目标名称");
    expect(() => addGoal(state, "跑步计划", "2026-08-10", now)).toThrow("截止日期不能早于今天");
  });
});
