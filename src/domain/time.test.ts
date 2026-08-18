import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import {
  addFixedActualMinutes,
  addScheduledActualMinutes,
  addTimeEntry,
  getTaskTimeAllocation,
  getTimeAllocation,
  setFixedActualMinutes,
  setScheduledActualMinutes,
  stopwatchSecondsToMinutes
} from "./time";

describe("time tracking", () => {
  it("sets, adds, and clears actual task time", () => {
    const state = createInitialState(new Date(2026, 7, 5, 9));
    state.fixedRecords.push({
      id: "fixed-record", templateId: "fixed", date: "2026-08-05", titleSnapshot: "拉伸",
      categoryId: "exercise", categoryNameSnapshot: "运动"
    });
    state.scheduledTasks.push({
      id: "scheduled", title: "背单词", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-05", status: "pending", createdAt: "2026-08-05T01:00:00.000Z"
    });

    const withFixed = addFixedActualMinutes(setFixedActualMinutes(state, "fixed-record", 30), "fixed-record", 15);
    const withScheduled = addScheduledActualMinutes(setScheduledActualMinutes(withFixed, "scheduled", 40), "scheduled", 20);
    const cleared = setFixedActualMinutes(withScheduled, "fixed-record", 0);

    expect(cleared.fixedRecords[0].actualMinutes).toBeUndefined();
    expect(cleared.scheduledTasks[0].actualMinutes).toBe(60);
  });

  it("combines task time and category-only entries into a sorted allocation", () => {
    const state = createInitialState(new Date(2026, 7, 5, 9));
    state.fixedRecords.push({
      id: "fixed-record", templateId: "fixed", date: "2026-08-05", titleSnapshot: "拉伸",
      categoryId: "exercise", categoryNameSnapshot: "运动", actualMinutes: 30
    });
    state.scheduledTasks.push({
      id: "scheduled", title: "背单词", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-05", status: "completed", createdAt: "2026-08-05T01:00:00.000Z", actualMinutes: 45
    });
    const withEntry = addTimeEntry(state, {
      title: "看资料", categoryId: "study", date: "2026-08-05", minutes: 15
    }, new Date(2026, 7, 5, 12));

    expect(getTimeAllocation(withEntry, "2026-08-05", "2026-08-05")).toEqual({
      totalMinutes: 90,
      items: [
        expect.objectContaining({ categoryId: "study", minutes: 60, ratio: 2 / 3 }),
        expect.objectContaining({ categoryId: "exercise", minutes: 30, ratio: 1 / 3 })
      ]
    });
    expect(getTaskTimeAllocation(withEntry, "2026-08-05", "2026-08-05")).toEqual({
      totalMinutes: 90,
      items: [
        expect.objectContaining({ taskTitle: "背单词", categoryId: "study", minutes: 45, ratio: 0.5 }),
        expect.objectContaining({ taskTitle: "拉伸", categoryId: "exercise", minutes: 30, ratio: 1 / 3 }),
        expect.objectContaining({ taskTitle: "看资料", categoryId: "study", minutes: 15, ratio: 1 / 6 })
      ]
    });
  });

  it("rounds a stopwatch up to a whole minute", () => {
    expect(stopwatchSecondsToMinutes(0)).toBe(0);
    expect(stopwatchSecondsToMinutes(1)).toBe(1);
    expect(stopwatchSecondsToMinutes(60)).toBe(1);
    expect(stopwatchSecondsToMinutes(61)).toBe(2);
  });
});
