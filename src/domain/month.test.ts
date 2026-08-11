import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import { getMonthGridDates, getMonthPlan } from "./month";

describe("monthly planning", () => {
  const augustEleventh = new Date(2026, 7, 11, 9);

  it("returns a six-week Monday-first calendar grid", () => {
    const dates = getMonthGridDates(augustEleventh);

    expect(dates).toHaveLength(42);
    expect(dates[0]).toBe("2026-07-27");
    expect(dates[41]).toBe("2026-09-06");
  });

  it("summarizes completed, pending, and overdue work in the month", () => {
    const state = createInitialState(augustEleventh);
    state.scheduledTasks.push(
      {
        id: "overdue", title: "补交材料", categoryId: "study", categoryNameSnapshot: "学习",
        scheduledDate: "2026-08-03", status: "archived", createdAt: augustEleventh.toISOString()
      },
      {
        id: "done", title: "完成复习", categoryId: "study", categoryNameSnapshot: "学习",
        scheduledDate: "2026-08-10", status: "completed", completedAt: augustEleventh.toISOString(),
        createdAt: augustEleventh.toISOString()
      }
    );

    const plan = getMonthPlan(state, augustEleventh, augustEleventh);

    expect(plan.find((day) => day.date === "2026-08-03")).toMatchObject({ overdue: 1, completed: 0 });
    expect(plan.find((day) => day.date === "2026-08-10")).toMatchObject({ overdue: 0, completed: 1 });
    expect(plan.find((day) => day.date === "2026-07-31")?.inCurrentMonth).toBe(false);
  });
});
