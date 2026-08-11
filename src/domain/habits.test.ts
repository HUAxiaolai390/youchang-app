import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import { getHabitStats } from "./habits";

describe("habit details", () => {
  const now = new Date(2026, 7, 11, 9);

  it("calculates streaks, recent completion, and accumulated time for a daily habit", () => {
    const state = createInitialState(now);
    state.fixedTasks.push({
      id: "english", title: "英语单词", categoryId: "study", categoryNameSnapshot: "学习",
      activeFrom: "2026-08-07", order: 0, createdAt: now.toISOString(), repeatRule: { type: "daily" }
    });
    for (const [date, completed, minutes] of [
      ["2026-08-07", true, 20],
      ["2026-08-08", true, 25],
      ["2026-08-09", false, 0],
      ["2026-08-10", true, 30],
      ["2026-08-11", true, 35]
    ] as const) {
      state.fixedRecords.push({
        id: date, templateId: "english", date, titleSnapshot: "英语单词",
        categoryId: "study", categoryNameSnapshot: "学习", actualMinutes: minutes || undefined,
        completedAt: completed ? `${date}T01:00:00.000Z` : undefined
      });
    }

    expect(getHabitStats(state, "english", now)).toMatchObject({
      currentStreak: 2,
      longestStreak: 2,
      completed30Days: 4,
      due30Days: 5,
      completionRate30Days: 0.8,
      totalActualMinutes: 110,
      totalActualTimeLabel: "1 小时 50 分"
    });
  });

  it("does not break a weekday habit on weekends or count skipped days", () => {
    const state = createInitialState(now);
    state.fixedTasks.push({
      id: "reading", title: "晨读", categoryId: "study", categoryNameSnapshot: "学习",
      activeFrom: "2026-08-06", skippedDates: ["2026-08-10"], order: 0,
      createdAt: now.toISOString(), repeatRule: { type: "weekdays" }
    });
    for (const date of ["2026-08-06", "2026-08-07", "2026-08-11"] as const) {
      state.fixedRecords.push({
        id: date, templateId: "reading", date, titleSnapshot: "晨读", categoryId: "study",
        categoryNameSnapshot: "学习", completedAt: `${date}T01:00:00.000Z`
      });
    }

    const result = getHabitStats(state, "reading", now)!;
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
    expect(result.due30Days).toBe(3);
    expect(result.days.find((day) => day.date === "2026-08-09")?.due).toBe(false);
    expect(result.days.find((day) => day.date === "2026-08-10")?.due).toBe(false);
  });

  it("returns undefined for a missing fixed task", () => {
    expect(getHabitStats(createInitialState(now), "missing", now)).toBeUndefined();
  });
});
