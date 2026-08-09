import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import {
  calculateCatGrowthProgress,
  catExperiencePerLevel,
  catFocusExperience,
  catTaskExperience,
  catTimeBlockExperience,
  equipCatReward,
  getCatLevel,
  getCatLevelExperience
} from "./cat-growth";

const now = new Date(2026, 7, 9, 10);

describe("cat growth", () => {
  it("awards completed tasks, focus sessions, and tracked-time blocks once", () => {
    const state = createInitialState(now);
    state.scheduledTasks.push({
      id: "done", title: "阅读", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "completed", completedAt: now.toISOString(),
      actualMinutes: 65, createdAt: now.toISOString()
    });
    state.focus!.completedSessions = 2;

    const first = calculateCatGrowthProgress(state);
    state.catGrowth = first;
    const second = calculateCatGrowthProgress(state);

    expect(first.experience).toBe(catTaskExperience + catFocusExperience * 2 + catTimeBlockExperience * 2);
    expect(second.experience).toBe(first.experience);
  });

  it("never removes experience when a task is unchecked or time is reduced", () => {
    const state = createInitialState(now);
    state.catGrowth = {
      experience: 120,
      rewardedCompletionIds: ["scheduled:done"],
      rewardedFocusSessions: 1,
      rewardedTimeBlocks: 3
    };

    expect(calculateCatGrowthProgress(state).experience).toBe(120);
  });

  it("uses ten levels and reports progress within the current level", () => {
    expect(getCatLevel(0)).toBe(1);
    expect(getCatLevel(catExperiencePerLevel)).toBe(2);
    expect(getCatLevelExperience(catExperiencePerLevel + 25)).toBe(25);
    expect(getCatLevel(catExperiencePerLevel * 20)).toBe(10);
  });

  it("only equips rewards that have been unlocked and toggles equipped items off", () => {
    const locked = createInitialState(now);
    const unchanged = equipCatReward(locked, { slot: "outfit", value: "scarf", label: "佩戴领巾" });
    expect(unchanged.catGrowth?.outfit).toBeUndefined();

    locked.catGrowth!.experience = catExperiencePerLevel;
    const equipped = equipCatReward(locked, { slot: "outfit", value: "scarf", label: "佩戴领巾" });
    const removed = equipCatReward(equipped, { slot: "outfit", value: "scarf", label: "佩戴领巾" });
    expect(equipped.catGrowth?.outfit).toBe("scarf");
    expect(removed.catGrowth?.outfit).toBeUndefined();
  });
});
