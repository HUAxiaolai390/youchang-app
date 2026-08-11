import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import { getWeeklyReviewSnapshot, saveWeeklyReview } from "./weekly-review";

describe("weekly review", () => {
  it("summarizes current-week progress, estimates, actual time, and top category", () => {
    const now = new Date(2026, 7, 12, 9);
    const state = createInitialState(now);
    state.scheduledTasks.push({
      id: "study", title: "复习", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-11", status: "completed", createdAt: now.toISOString(),
      estimatedMinutes: 60, actualMinutes: 90
    }, {
      id: "exercise", title: "跑步", categoryId: "exercise", categoryNameSnapshot: "运动",
      scheduledDate: "2026-08-12", status: "pending", createdAt: now.toISOString(),
      estimatedMinutes: 30, actualMinutes: 20
    });

    expect(getWeeklyReviewSnapshot(state, now)).toMatchObject({
      weekStart: "2026-08-10",
      weekEnd: "2026-08-16",
      throughDate: "2026-08-12",
      completed: 1,
      total: 2,
      estimatedMinutes: 90,
      actualMinutes: 110,
      trackedMinutes: 110,
      topCategoryName: "学习"
    });
  });

  it("saves, replaces, and clears one review per week", () => {
    const state = createInitialState(new Date(2026, 7, 12, 9));
    const saved = saveWeeklyReview(state, "2026-08-10", " 完成了复习 ", " 减少拖延 ", new Date(2026, 7, 12, 10));
    expect(saved.weeklyReviews).toEqual([
      expect.objectContaining({ weekStart: "2026-08-10", summary: "完成了复习", adjustment: "减少拖延" })
    ]);

    const replaced = saveWeeklyReview(saved, "2026-08-10", "坚持运动", "", new Date(2026, 7, 13, 10));
    expect(replaced.weeklyReviews).toHaveLength(1);
    expect(replaced.weeklyReviews?.[0]).toMatchObject({ summary: "坚持运动", adjustment: "" });

    expect(saveWeeklyReview(replaced, "2026-08-10", "", "", new Date()).weeklyReviews).toEqual([]);
  });
});
