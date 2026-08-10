import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import {
  moveArchivedTaskToCurrentWeek,
  rescheduleTask,
  rollover
} from "./rollover";
import type { AppState, ScheduledTask } from "./types";

const july30 = new Date(2026, 6, 30, 8);
const july31 = new Date(2026, 6, 31, 8);
const mondayAugust3 = new Date(2026, 7, 3, 8);

function state(lastOpenedDate = "2026-07-30"): AppState {
  return {
    ...createInitialState(july30),
    settings: {
      ...createInitialState(july30).settings,
      lastOpenedDate: lastOpenedDate as AppState["settings"]["lastOpenedDate"]
    }
  };
}

function scheduledTask(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: "task-1",
    title: "完成实验报告",
    categoryId: "study",
    categoryNameSnapshot: "学习",
    scheduledDate: "2026-07-30",
    status: "pending",
    createdAt: july30.toISOString(),
    ...overrides
  };
}

describe("daily rollover and rescheduling", () => {
  it("creates one fixed record for each active template and elapsed date without duplication", () => {
    const withTemplate: AppState = {
      ...state(),
      fixedTasks: [{
        id: "fixed-1",
        title: "拉伸",
        categoryId: "exercise",
        categoryNameSnapshot: "运动",
        activeFrom: "2026-07-31",
        steps: [{ id: "warmup", title: "热身", completed: true }],
        order: 0,
        createdAt: july30.toISOString()
      }]
    };

    const once = rollover(withTemplate, july31);
    const twice = rollover(once, new Date(2026, 6, 31, 12));

    expect(twice.fixedRecords).toMatchObject([{
      templateId: "fixed-1",
      date: "2026-07-31",
      titleSnapshot: "拉伸",
      categoryId: "exercise",
      categoryNameSnapshot: "运动"
    }]);
    expect(twice.fixedRecords).toHaveLength(1);
    expect(twice.fixedRecords[0]?.steps).toEqual([{ id: "warmup", title: "热身", completed: false }]);
  });

  it("creates records for every active elapsed date, excluding the inactive boundary", () => {
    const withTemplate: AppState = {
      ...state("2026-07-28"),
      fixedTasks: [{
        id: "fixed-1",
        title: "拉伸",
        categoryId: "exercise",
        categoryNameSnapshot: "运动",
        activeFrom: "2026-07-29",
        inactiveFrom: "2026-07-31",
        order: 0,
        createdAt: july30.toISOString()
      }]
    };

    const result = rollover(withTemplate, july31);

    expect(result.fixedRecords.map((record) => record.date)).toEqual([
      "2026-07-29",
      "2026-07-30"
    ]);
  });

  it("moves a past pending task from this week into the backlog", () => {
    const result = rollover({
      ...state(),
      scheduledTasks: [scheduledTask()]
    }, july31);

    expect(result.scheduledTasks[0]).toMatchObject({
      scheduledDate: "2026-07-30",
      status: "backlog"
    });
  });

  it("archives an unresolved task from a previous week when a new week starts", () => {
    const result = rollover({
      ...state("2026-08-02"),
      scheduledTasks: [scheduledTask({
        scheduledDate: "2026-08-02",
        status: "backlog"
      })]
    }, mondayAugust3);

    expect(result.scheduledTasks[0]?.status).toBe("archived");
  });

  it("preserves completed tasks when moving unfinished tasks forward", () => {
    const result = rollover({
      ...state(),
      scheduledTasks: [scheduledTask({
        status: "completed",
        completedAt: july30.toISOString()
      })]
    }, july31);

    expect(result.scheduledTasks[0]).toMatchObject({
      status: "completed",
      completedAt: july30.toISOString()
    });
  });

  it("keeps the old attempt incomplete and creates a new pending task on reschedule", () => {
    const result = rescheduleTask({
      ...state("2026-07-31"),
      scheduledTasks: [scheduledTask({
        status: "backlog",
        steps: [{ id: "draft", title: "写初稿", completed: true }]
      })]
    }, "task-1", "2026-08-01", july31);

    expect(result.scheduledTasks.find((task) => task.id === "task-1")?.status).toBe("rescheduled");
    expect(result.scheduledTasks.find((task) => task.sourceTaskId === "task-1")).toMatchObject({
      scheduledDate: "2026-08-01",
      status: "pending",
      title: "完成实验报告"
    });
    expect(result.scheduledTasks.find((task) => task.sourceTaskId === "task-1")?.steps)
      .toEqual([{ id: "draft", title: "写初稿", completed: true }]);
    expect(result.reschedules).toMatchObject([{
      sourceTaskId: "task-1",
      fromDate: "2026-07-30",
      toDate: "2026-08-01",
      changedAt: july31.toISOString()
    }]);
    expect(result.reschedules).toHaveLength(1);
  });

  it("rejects rescheduling a completed task or a date outside the current week", () => {
    const completedState = {
      ...state("2026-07-31"),
      scheduledTasks: [scheduledTask({ status: "completed" })]
    };
    const pendingState = {
      ...state("2026-07-31"),
      scheduledTasks: [scheduledTask()]
    };

    expect(() => rescheduleTask(completedState, "task-1", "2026-08-01", july31))
      .toThrow("这个任务现在不能改期");
    expect(() => rescheduleTask(pendingState, "task-1", "2026-08-03", july31))
      .toThrow("请选择本周内的日期");
  });

  it("moves an archived task into the current week as a new pending attempt", () => {
    const result = moveArchivedTaskToCurrentWeek({
      ...state("2026-08-03"),
      scheduledTasks: [scheduledTask({ status: "archived" })]
    }, "task-1", "2026-08-04", mondayAugust3);

    expect(result.scheduledTasks.find((task) => task.id === "task-1")?.status).toBe("rescheduled");
    expect(result.scheduledTasks.find((task) => task.sourceTaskId === "task-1")).toMatchObject({
      scheduledDate: "2026-08-04",
      status: "pending"
    });
    expect(result.reschedules).toHaveLength(1);
  });
});
