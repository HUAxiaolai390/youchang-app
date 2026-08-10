import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import { addScheduledTask } from "./tasks";
import { getTodayFocusCount, toggleTodayFocus } from "./today-focus";

const now = new Date(2026, 7, 10, 9);

function stateWithTasks(count: number) {
  let state = createInitialState(now);
  for (let index = 1; index <= count; index += 1) {
    state = addScheduledTask(state, {
      title: `任务 ${index}`,
      categoryId: "study",
      scheduledDate: "2026-08-10",
      priority: index === 1 ? "high" : "medium"
    }, now);
  }
  return state;
}

describe("today focus tasks", () => {
  it("adds and removes one of today's tasks", () => {
    const state = stateWithTasks(1);
    const id = state.scheduledTasks[0]!.id;
    const added = toggleTodayFocus(state, "scheduled", id, now);
    const removed = toggleTodayFocus(added, "scheduled", id, now);

    expect(added.scheduledTasks[0]?.isTodayFocus).toBe(true);
    expect(getTodayFocusCount(added, now)).toBe(1);
    expect(removed.scheduledTasks[0]?.isTodayFocus).toBe(false);
  });

  it("allows at most three focus tasks", () => {
    let state = stateWithTasks(4);
    for (const task of state.scheduledTasks.slice(0, 3)) {
      state = toggleTodayFocus(state, "scheduled", task.id, now);
    }

    expect(() => toggleTodayFocus(state, "scheduled", state.scheduledTasks[3]!.id, now))
      .toThrow("今日重点最多设置 3 项");
  });

  it("does not change a task outside today", () => {
    const state = stateWithTasks(1);
    state.scheduledTasks[0]!.scheduledDate = "2026-08-11";

    expect(toggleTodayFocus(state, "scheduled", state.scheduledTasks[0]!.id, now)).toBe(state);
  });
});
