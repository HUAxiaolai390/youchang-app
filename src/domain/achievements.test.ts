import { describe, expect, it } from "vitest";
import { achievementDefinitions, getAchievements, getFeaturedAchievements, normalizeFeaturedAchievementIds } from "./achievements";
import { createInitialState } from "./defaults";
import type { AppState, DateKey } from "./types";

function addTask(state: AppState, id: string, date: DateKey, categoryId = "study", completed = true) {
  const category = state.categories.find((item) => item.id === categoryId)!;
  state.scheduledTasks.push({
    id,
    title: `任务 ${id}`,
    categoryId,
    categoryNameSnapshot: category.name,
    scheduledDate: date,
    status: completed ? "completed" : "pending",
    createdAt: `${date}T01:00:00.000Z`,
    ...(completed ? { completedAt: `${date}T02:00:00.000Z` } : {})
  });
}

describe("achievements", () => {
  it("defines twelve medals split evenly into bronze, silver, and gold", () => {
    expect(achievementDefinitions).toHaveLength(12);
    expect(achievementDefinitions.filter((item) => item.tier === "bronze")).toHaveLength(4);
    expect(achievementDefinitions.filter((item) => item.tier === "silver")).toHaveLength(4);
    expect(achievementDefinitions.filter((item) => item.tier === "gold")).toHaveLength(4);
  });

  it("automatically unlocks task, streak, focus, perfect-day, weekly, and balanced medals from history", () => {
    const today = new Date(2026, 7, 7, 9);
    const state = createInitialState(today);
    for (let day = 1; day <= 10; day += 1) {
      const date = `2026-08-${String(day).padStart(2, "0")}` as DateKey;
      addTask(state, `study-${day}`, date, "study");
      addTask(state, `exercise-${day}`, date, "exercise");
    }
    state.focus = { focusMinutes: 25, breakMinutes: 5, completedSessions: 2, totalFocusMinutes: 600, experience: 40 };

    const achievements = new Map(getAchievements(state, today).map((item) => [item.id, item]));

    expect(achievements.get("first-task")?.unlocked).toBe(true);
    expect(achievements.get("ten-tasks")?.unlocked).toBe(true);
    expect(achievements.get("seven-day-streak")?.unlocked).toBe(true);
    expect(achievements.get("first-focus")?.unlocked).toBe(true);
    expect(achievements.get("ten-focus-hours")?.unlocked).toBe(true);
    expect(achievements.get("perfect-day")?.unlocked).toBe(true);
    expect(achievements.get("weekly-eighty")?.unlocked).toBe(true);
    expect(achievements.get("balanced-study-exercise")?.unlocked).toBe(true);
    expect(achievements.get("hundred-tasks")?.unlocked).toBe(false);
  });

  it("uses the longest truly consecutive run and does not bridge a missing day", () => {
    const today = new Date(2026, 7, 7, 9);
    const state = createInitialState(today);
    addTask(state, "one", "2026-08-01");
    addTask(state, "two", "2026-08-03");
    addTask(state, "three", "2026-08-04");

    const streak = getAchievements(state, today).find((item) => item.id === "three-day-streak")!;
    expect(streak.current).toBe(2);
    expect(streak.unlocked).toBe(false);
  });

  it("keeps only three known unique featured medals and hides locked selections", () => {
    const today = new Date(2026, 7, 7, 9);
    const state = createInitialState(today);
    addTask(state, "one", "2026-08-07");
    state.settings.featuredAchievementIds = ["first-task", "first-task", "ten-tasks", "unknown"];

    expect(normalizeFeaturedAchievementIds(state.settings.featuredAchievementIds)).toEqual(["first-task", "ten-tasks"]);
    expect(getFeaturedAchievements(state, today).map((item) => item.id)).toEqual(["first-task"]);
  });
});
