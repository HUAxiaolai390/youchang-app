import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import {
  completeFocusSession,
  configureFocus,
  getFocusExperience,
  getFocusLevel,
  getFocusProgress,
  getLevelExperience
} from "./focus";

describe("focus progress", () => {
  it("uses 25/5 defaults and clamps custom durations", () => {
    const state = createInitialState(new Date(2026, 7, 5, 9));
    expect(getFocusProgress(state)).toMatchObject({ focusMinutes: 25, breakMinutes: 5 });

    expect(configureFocus(state, 999, 0).focus).toMatchObject({
      focusMinutes: 180,
      breakMinutes: 1
    });
  });

  it("awards focus experience and calculates levels", () => {
    const state = createInitialState(new Date(2026, 7, 5, 9));
    const afterTwoSessions = completeFocusSession(completeFocusSession(state, 50), 50);

    expect(afterTwoSessions.focus).toMatchObject({
      completedSessions: 2,
      totalFocusMinutes: 100,
      experience: 100
    });
    expect(getFocusExperience(25)).toBe(25);
    expect(getFocusLevel(100)).toBe(2);
    expect(getLevelExperience(125)).toBe(25);
  });

  it("reads sensible defaults from older states without focus data", () => {
    const state = createInitialState(new Date(2026, 7, 5, 9));
    delete state.focus;

    expect(getFocusProgress(state)).toMatchObject({
      focusMinutes: 25,
      breakMinutes: 5,
      completedSessions: 0
    });
  });
});
