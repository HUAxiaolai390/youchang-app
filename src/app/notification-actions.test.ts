import { describe, expect, it } from "vitest";
import { createInitialState } from "../domain/defaults";
import { reduceAppState } from "./AppStateProvider";

const clickedAt = new Date(2026, 8, 13, 23, 50);
const reopenedAt = new Date(2026, 8, 14, 8);

function fixture() {
  const state = createInitialState(clickedAt);
  state.scheduledTasks.push({
    id: "review", title: "复习", categoryId: "study", categoryNameSnapshot: "学习",
    scheduledDate: "2026-09-13", status: "pending", createdAt: clickedAt.toISOString()
  });
  state.fixedTasks.push({
    id: "english", title: "英语", categoryId: "study", categoryNameSnapshot: "学习",
    activeFrom: "2026-09-13", order: 0, createdAt: clickedAt.toISOString()
  });
  state.fixedRecords.push({
    id: "record-uuid", templateId: "english", date: "2026-09-13",
    titleSnapshot: "英语", categoryId: "study", categoryNameSnapshot: "学习"
  });
  return state;
}

describe("notification actions across retries and days", () => {
  it("uses the day of the notification click when postponing, even after reopening tomorrow", () => {
    const action = { type: "scheduled/postpone-from-notification" as const,
      id: "review", date: "2026-09-13" as const, at: clickedAt.getTime() };
    const next = reduceAppState(fixture(), action, reopenedAt);
    expect(next.scheduledTasks).toContainEqual(expect.objectContaining({
      sourceTaskId: "review", scheduledDate: "2026-09-14", status: "pending"
    }));
    expect(next.reschedules[0].changedAt).toBe(clickedAt.toISOString());
  });

  it("ignores a repeated postpone instead of failing or creating another task", () => {
    const action = { type: "scheduled/postpone-from-notification" as const, id: "review" };
    const once = reduceAppState(fixture(), action, clickedAt);
    expect(reduceAppState(once, action, clickedAt)).toBe(once);
  });

  it("does not bring a rescheduled source back into today's completed list", () => {
    const state = reduceAppState(fixture(), {
      type: "scheduled/postpone-tomorrow", id: "review"
    }, clickedAt);
    const next = reduceAppState(state, {
      type: "scheduled/complete-from-notification", id: "review", completedAt: clickedAt.getTime()
    }, clickedAt);
    expect(next).toBe(state);
    expect(next.scheduledTasks[0].status).toBe("rescheduled");
  });

  it("ignores the old notification after the task date has been edited", () => {
    const state = fixture();
    state.scheduledTasks[0].scheduledDate = "2026-09-16";
    const action = { type: "scheduled/postpone-from-notification" as const,
      id: "review", date: "2026-09-13" as const, at: clickedAt.getTime() };
    expect(reduceAppState(state, action, reopenedAt)).toBe(state);
  });

  it("keeps a fixed task completed when a pre-scheduled notification is replayed", () => {
    const action = { type: "fixed/complete-from-notification" as const,
      recordId: "english:2026-09-13", date: "2026-09-13" as const, completedAt: clickedAt.getTime() };
    const once = reduceAppState(fixture(), action, clickedAt);
    const twice = reduceAppState(once, action, clickedAt);
    expect(twice.fixedRecords).toHaveLength(1);
    expect(twice.fixedRecords[0].completedAt).toBe(clickedAt.toISOString());
  });

  it("keeps today skipped when the notification is replayed", () => {
    const action = { type: "fixed/skip-from-notification" as const,
      recordId: "english:2026-09-13", date: "2026-09-13" as const };
    const once = reduceAppState(fixture(), action, clickedAt);
    const twice = reduceAppState(once, action, clickedAt);
    expect(twice.fixedTasks[0].skippedDates).toEqual(["2026-09-13"]);
    expect(twice.fixedRecords).toHaveLength(0);
  });
});
