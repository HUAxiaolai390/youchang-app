import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import { isFixedTaskDueOnDate, shouldShowFixedTaskOnDate } from "./repeat";
import { rollover } from "./rollover";
import { setFixedTaskPausedUntil, toggleFixedTaskSkipDate } from "./tasks";
import type { AppState, FixedTaskTemplate } from "./types";

const monday = new Date(2026, 7, 3, 9);

function stateWithTask(task: Partial<FixedTaskTemplate>): AppState {
  const state = createInitialState(monday);
  state.fixedTasks = [{
    id: "habit",
    title: "锻炼",
    categoryId: "exercise",
    categoryNameSnapshot: "运动",
    activeFrom: "2026-08-03",
    order: 0,
    createdAt: monday.toISOString(),
    ...task
  }];
  return state;
}

describe("fixed task repeat rules", () => {
  it("supports workdays and custom weekdays", () => {
    const workdays = stateWithTask({ repeatRule: { type: "weekdays" } });
    expect(isFixedTaskDueOnDate(workdays, workdays.fixedTasks[0], "2026-08-07")).toBe(true);
    expect(isFixedTaskDueOnDate(workdays, workdays.fixedTasks[0], "2026-08-08")).toBe(false);

    const custom = stateWithTask({ repeatRule: { type: "custom-weekdays", weekdays: [1, 3, 5] } });
    expect(isFixedTaskDueOnDate(custom, custom.fixedTasks[0], "2026-08-05")).toBe(true);
    expect(isFixedTaskDueOnDate(custom, custom.fixedTasks[0], "2026-08-06")).toBe(false);
  });

  it("supports interval rules anchored to the activation date", () => {
    const state = stateWithTask({ repeatRule: { type: "interval", intervalDays: 3 } });
    expect(isFixedTaskDueOnDate(state, state.fixedTasks[0], "2026-08-03")).toBe(true);
    expect(isFixedTaskDueOnDate(state, state.fixedTasks[0], "2026-08-05")).toBe(false);
    expect(isFixedTaskDueOnDate(state, state.fixedTasks[0], "2026-08-06")).toBe(true);
  });

  it("stops offering a flexible weekly target after its completion goal is reached", () => {
    const state = stateWithTask({ repeatRule: { type: "weekly-count", timesPerWeek: 2 } });
    state.fixedRecords = [
      { id: "one", templateId: "habit", date: "2026-08-03", titleSnapshot: "锻炼", categoryId: "exercise", categoryNameSnapshot: "运动", completedAt: monday.toISOString() },
      { id: "two", templateId: "habit", date: "2026-08-04", titleSnapshot: "锻炼", categoryId: "exercise", categoryNameSnapshot: "运动", completedAt: monday.toISOString() }
    ];
    expect(isFixedTaskDueOnDate(state, state.fixedTasks[0], "2026-08-05")).toBe(false);

    state.fixedRecords.pop();
    expect(isFixedTaskDueOnDate(state, state.fixedTasks[0], "2026-08-05")).toBe(true);
    expect(shouldShowFixedTaskOnDate(state, state.fixedTasks[0], "2026-08-06", "2026-08-05")).toBe(false);
  });

  it("creates workday records but skips the weekend during rollover", () => {
    const state = stateWithTask({ repeatRule: { type: "weekdays" } });
    state.settings.lastOpenedDate = "2026-08-02";

    const result = rollover(state, new Date(2026, 7, 9, 9));
    expect(result.fixedRecords.map((record) => record.date)).toEqual([
      "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"
    ]);
  });

  it("removes an unfinished record on leave or pause and restores today after cancellation", () => {
    const now = new Date(2026, 7, 3, 9);
    const state = stateWithTask({ repeatRule: { type: "daily" } });
    state.fixedRecords = [{
      id: "today", templateId: "habit", date: "2026-08-03", titleSnapshot: "锻炼",
      categoryId: "exercise", categoryNameSnapshot: "运动"
    }];

    const skipped = toggleFixedTaskSkipDate(state, "habit", "2026-08-03", now);
    expect(skipped.fixedRecords).toHaveLength(0);
    expect(isFixedTaskDueOnDate(skipped, skipped.fixedTasks[0], "2026-08-03")).toBe(false);
    const unskipped = toggleFixedTaskSkipDate(skipped, "habit", "2026-08-03", now);
    expect(unskipped.fixedRecords).toHaveLength(1);

    const paused = setFixedTaskPausedUntil(unskipped, "habit", "2026-08-05", now);
    expect(paused.fixedRecords).toHaveLength(0);
    expect(isFixedTaskDueOnDate(paused, paused.fixedTasks[0], "2026-08-05")).toBe(false);
    expect(isFixedTaskDueOnDate(paused, paused.fixedTasks[0], "2026-08-06")).toBe(true);
    expect(setFixedTaskPausedUntil(paused, "habit", undefined, now).fixedRecords).toHaveLength(1);
  });
});
