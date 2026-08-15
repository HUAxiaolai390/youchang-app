import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import { getWeekDates, getWeekPlan } from "./week";

describe("weekly planning", () => {
  const wednesday = new Date(2026, 7, 5, 9);

  it("returns Monday through Sunday for the anchor week", () => {
    expect(getWeekDates(wednesday)).toEqual([
      "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06",
      "2026-08-07", "2026-08-08", "2026-08-09"
    ]);
  });

  it("combines fixed and scheduled work, sorts timed work first, and totals actual time", () => {
    const state = createInitialState(wednesday);
    state.fixedTasks.push({
      id: "fixed", title: "晨间拉伸", categoryId: "exercise", categoryNameSnapshot: "运动",
      activeFrom: "2026-08-03", plannedStartTime: "08:00",
      order: 0, createdAt: wednesday.toISOString()
    });
    state.fixedRecords.push({
      id: "record", templateId: "fixed", date: "2026-08-05", titleSnapshot: "晨间拉伸",
      categoryId: "exercise", categoryNameSnapshot: "运动", plannedStartTime: "08:00",
      actualMinutes: 15, completedAt: wednesday.toISOString()
    });
    state.scheduledTasks.push(
      {
        id: "later", title: "写作业", categoryId: "study", categoryNameSnapshot: "学习",
        scheduledDate: "2026-08-05", status: "pending", plannedStartTime: "19:00",
        actualMinutes: 75, createdAt: wednesday.toISOString()
      },
      {
        id: "flexible", title: "整理书桌", categoryId: "life", categoryNameSnapshot: "生活",
        scheduledDate: "2026-08-05", status: "pending",
        createdAt: wednesday.toISOString()
      }
    );

    const day = getWeekPlan(state, wednesday).find((item) => item.date === "2026-08-05")!;

    expect(day.tasks.map((task) => task.title)).toEqual(["晨间拉伸", "写作业", "整理书桌"]);
    expect(day).toMatchObject({ completed: 1, actualMinutes: 90 });
  });
});
