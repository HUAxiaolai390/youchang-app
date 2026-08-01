import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import {
  getCatMessage,
  getCurrentStreak,
  getSevenDayStats,
  getTodayProgress,
  getTotalCompleted
} from "./stats";
import type { AppState, FixedTaskRecord, ScheduledTask } from "./types";

const today = new Date(2026, 6, 31, 8);

function state(): AppState {
  return createInitialState(today);
}

function fixedRecord(date: "2026-07-29" | "2026-07-30" | "2026-07-31", completed = false): FixedTaskRecord {
  return {
    id: `fixed-${date}`,
    templateId: `template-${date}`,
    date,
    titleSnapshot: "拉伸",
    categoryId: "exercise",
    categoryNameSnapshot: "运动",
    ...(completed ? { completedAt: today.toISOString() } : {})
  };
}

function scheduledTask(
  id: string,
  scheduledDate: "2026-07-29" | "2026-07-30" | "2026-07-31",
  status: ScheduledTask["status"]
): ScheduledTask {
  return {
    id,
    title: "完成报告",
    categoryId: "study",
    categoryNameSnapshot: "学习",
    scheduledDate,
    status,
    createdAt: today.toISOString(),
    ...(status === "completed" ? { completedAt: today.toISOString() } : {})
  };
}

describe("progress and growth statistics", () => {
  it("counts completed and incomplete attempts scheduled for today", () => {
    const result = getTodayProgress({
      ...state(),
      fixedRecords: [fixedRecord("2026-07-31", true)],
      scheduledTasks: [
        scheduledTask("done", "2026-07-31", "completed"),
        scheduledTask("open", "2026-07-31", "pending")
      ]
    }, today);

    expect(result).toEqual({ completed: 2, total: 3, ratio: 2 / 3 });
  });

  it("counts rescheduled source attempts as incomplete", () => {
    const day = getSevenDayStats({
      ...state(),
      scheduledTasks: [
        scheduledTask("source", "2026-07-30", "rescheduled"),
        scheduledTask("target", "2026-07-31", "completed")
      ]
    }, today).find((item) => item.date === "2026-07-30");

    expect(day).toMatchObject({ completed: 0, total: 1, ratio: 0 });
  });

  it("marks a day with no attempts as no data", () => {
    const day = getSevenDayStats(state(), today)
      .find((item) => item.date === "2026-07-31");

    expect(day).toMatchObject({
      completed: 0,
      total: 0,
      ratio: 0,
      hasData: false,
      hasFixedTasks: false,
      allFixedCompleted: false
    });
  });

  it("uses all fixed tasks for a streak day", () => {
    const history = {
      ...state(),
      fixedRecords: [
        fixedRecord("2026-07-30", true),
        fixedRecord("2026-07-31", true)
      ],
      scheduledTasks: [scheduledTask("unfinished", "2026-07-31", "pending")]
    };

    expect(getCurrentStreak(history, today)).toBe(2);
  });

  it("does not increase or break streak on a no-task day", () => {
    const history = {
      ...state(),
      fixedRecords: [
        fixedRecord("2026-07-29", true),
        fixedRecord("2026-07-31", true)
      ]
    };

    expect(getCurrentStreak(history, today)).toBe(2);
  });

  it("uses a completed scheduled task when a day has no fixed tasks", () => {
    const history = {
      ...state(),
      scheduledTasks: [
        scheduledTask("yesterday", "2026-07-30", "completed"),
        scheduledTask("today", "2026-07-31", "completed")
      ]
    };

    expect(getCurrentStreak(history, today)).toBe(2);
  });

  it("counts every completed fixed record and scheduled attempt", () => {
    const result = getTotalCompleted({
      ...state(),
      fixedRecords: [fixedRecord("2026-07-30", true), fixedRecord("2026-07-31")],
      scheduledTasks: [
        scheduledTask("done", "2026-07-31", "completed"),
        scheduledTask("moved", "2026-07-30", "rescheduled")
      ]
    });

    expect(result).toBe(2);
  });

  it("excludes records on or after a template's inactive date from day and streak statistics", () => {
    const template = {
      id: "template-active",
      title: "拉伸",
      categoryId: "exercise",
      categoryNameSnapshot: "运动",
      activeFrom: "2026-07-30" as const,
      inactiveFrom: "2026-07-31" as const,
      order: 0,
      createdAt: today.toISOString()
    };
    const history = {
      ...state(),
      fixedTasks: [template],
      fixedRecords: [
        { ...fixedRecord("2026-07-30", true), templateId: template.id },
        { ...fixedRecord("2026-07-31", false), templateId: template.id }
      ]
    };

    expect(getTodayProgress(history, today)).toEqual({ completed: 0, total: 0, ratio: 0 });
    expect(getSevenDayStats(history, today).find((day) => day.date === "2026-07-30")).toMatchObject({ completed: 1, total: 1 });
    expect(getCurrentStreak(history, today)).toBe(1);
  });

  it("counts a record whose template no longer exists as compatible historical data", () => {
    const history = {
      ...state(),
      fixedRecords: [{ ...fixedRecord("2026-07-31", true), templateId: "deleted-template" }]
    };

    expect(getTodayProgress(history, today)).toEqual({ completed: 1, total: 1, ratio: 1 });
  });

  it("returns the three cat message states", () => {
    expect(getCatMessage({ completed: 0, total: 3, ratio: 0 })).toContain("一件小事");
    expect(getCatMessage({ completed: 1, total: 3, ratio: 1 / 3 })).toContain("已经开始");
    expect(getCatMessage({ completed: 3, total: 3, ratio: 1 })).toContain("已经足够");
  });
});
