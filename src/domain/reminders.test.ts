import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import {
  describeTaskReminder,
  getPendingTaskReminders,
  getSchedulableTaskReminders,
  getTaskReminderOverview,
  markTaskReminderSent,
  normalizeReminderMinutesBefore,
  snoozeTaskReminder
} from "./reminders";

describe("task reminders", () => {
  it("prepares future reminders across dates for the phone operating system", () => {
    const state = createInitialState(new Date(2026, 7, 9, 8));
    state.scheduledTasks.push({
      id: "tomorrow", title: "数模学习", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-10", status: "pending", createdAt: "2026-08-09T00:00:00.000Z",
      plannedStartTime: "09:30", reminderMinutesBefore: 10
    }, {
      id: "finished", title: "已完成任务", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-10", status: "completed", createdAt: "2026-08-09T00:00:00.000Z",
      plannedStartTime: "10:00", reminderMinutesBefore: 0
    }, {
      id: "past", title: "过期任务", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "pending", createdAt: "2026-08-09T00:00:00.000Z",
      plannedStartTime: "07:30", reminderMinutesBefore: 0
    });

    const reminders = getSchedulableTaskReminders(state, new Date(2026, 7, 9, 8));
    expect(reminders).toHaveLength(1);
    expect(reminders[0]).toMatchObject({ id: "tomorrow", title: "数模学习" });
    expect(reminders[0].remindAt).toEqual(new Date(2026, 7, 10, 9, 20));
  });

  it("pre-schedules predictable fixed tasks even before tomorrow's record exists", () => {
    const state = createInitialState(new Date(2026, 7, 9, 8));
    state.fixedTasks.push({
      id: "words", title: "英语单词", categoryId: "study", categoryNameSnapshot: "学习",
      activeFrom: "2026-08-09", order: 0, createdAt: "2026-08-09T00:00:00.000Z",
      repeatRule: { type: "daily" }, plannedStartTime: "07:30", reminderMinutesBefore: 0
    });

    const reminders = getSchedulableTaskReminders(state, new Date(2026, 7, 9, 8));
    expect(reminders.some((reminder) => reminder.date === "2026-08-10" && reminder.title === "英语单词")).toBe(true);
    expect(reminders.some((reminder) => reminder.date === "2026-09-08" && reminder.title === "英语单词")).toBe(true);
  });

  it("finds a scheduled reminder when its lead time arrives", () => {
    const state = createInitialState(new Date(2026, 7, 9, 8));
    state.scheduledTasks.push({
      id: "task-1", title: "背单词", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "pending", createdAt: "2026-08-09T00:00:00.000Z",
      plannedStartTime: "09:00", reminderMinutesBefore: 10
    });

    expect(getPendingTaskReminders(state, new Date(2026, 7, 9, 8, 49))).toEqual([]);
    const due = getPendingTaskReminders(state, new Date(2026, 7, 9, 8, 50));
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ title: "背单词", reminderMinutesBefore: 10 });
    expect(describeTaskReminder(due[0], new Date(2026, 7, 9, 8, 50))).toBe("还有 10 分钟开始");
  });

  it("restores a missed reminder later the same day but skips completed and already notified tasks", () => {
    const state = createInitialState(new Date(2026, 7, 9, 10));
    state.scheduledTasks.push({
      id: "sent", title: "已提醒", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "pending", createdAt: "2026-08-09T00:00:00.000Z",
      plannedStartTime: "10:00", reminderMinutesBefore: 10, reminderSentAt: "2026-08-09T01:50:00.000Z"
    }, {
      id: "done", title: "已完成", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "completed", createdAt: "2026-08-09T00:00:00.000Z",
      plannedStartTime: "10:00", reminderMinutesBefore: 10
    }, {
      id: "expired", title: "已过期", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "pending", createdAt: "2026-08-09T00:00:00.000Z",
      plannedStartTime: "08:00", reminderMinutesBefore: 10
    });

    expect(getPendingTaskReminders(state, new Date(2026, 7, 9, 10))).toEqual([
      expect.objectContaining({ id: "expired", title: "已过期" })
    ]);
  });

  it("marks fixed and scheduled reminders without changing other tasks", () => {
    const state = createInitialState(new Date(2026, 7, 9, 8));
    state.fixedRecords.push({
      id: "fixed-record", templateId: "fixed", date: "2026-08-09", titleSnapshot: "晨跑",
      categoryId: "exercise", categoryNameSnapshot: "运动"
    });
    state.scheduledTasks.push({
      id: "scheduled", title: "阅读", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "pending", createdAt: "2026-08-09T00:00:00.000Z"
    });

    const fixedMarked = markTaskReminderSent(state, "fixed", "fixed-record", "sent-fixed");
    const bothMarked = markTaskReminderSent(fixedMarked, "scheduled", "scheduled", "sent-scheduled");
    expect(bothMarked.fixedRecords[0].reminderSentAt).toBe("sent-fixed");
    expect(bothMarked.scheduledTasks[0].reminderSentAt).toBe("sent-scheduled");
  });

  it("accepts only supported reminder lead times", () => {
    expect(normalizeReminderMinutesBefore("0")).toBe(0);
    expect(normalizeReminderMinutesBefore("30")).toBe(30);
    expect(() => normalizeReminderMinutesBefore(15)).toThrow("请选择有效提醒时间");
  });

  it("snoozes and then makes a reminder pending again", () => {
    const state = createInitialState(new Date(2026, 7, 9, 9));
    state.scheduledTasks.push({
      id: "task-1", title: "背单词", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "pending", createdAt: "2026-08-09T00:00:00.000Z",
      plannedStartTime: "09:00", reminderMinutesBefore: 0, reminderSentAt: "sent"
    });
    const snoozed = snoozeTaskReminder(state, "scheduled", "task-1", "2026-08-09T01:10:00.000Z");

    expect(getPendingTaskReminders(snoozed, new Date(2026, 7, 9, 9, 9))).toEqual([]);
    expect(getPendingTaskReminders(snoozed, new Date(2026, 7, 9, 9, 10))).toEqual([
      expect.objectContaining({ id: "task-1", snoozed: true })
    ]);
  });

  it("keeps completed reminders in today's overview", () => {
    const state = createInitialState(new Date(2026, 7, 9, 9));
    state.scheduledTasks.push({
      id: "upcoming", title: "稍后复习", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "pending", createdAt: "2026-08-09T00:00:00.000Z",
      plannedStartTime: "10:00", reminderMinutesBefore: 10
    }, {
      id: "missed", title: "晨间阅读", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "pending", createdAt: "2026-08-09T00:00:00.000Z",
      plannedStartTime: "08:00", reminderMinutesBefore: 0, reminderSentAt: "sent"
    }, {
      id: "snoozed", title: "背单词", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "pending", createdAt: "2026-08-09T00:00:00.000Z",
      plannedStartTime: "08:30", reminderMinutesBefore: 0,
      reminderSnoozedUntil: "2026-08-09T01:30:00.000Z"
    }, {
      id: "done", title: "已经完成", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "completed", createdAt: "2026-08-09T00:00:00.000Z",
      plannedStartTime: "08:00", reminderMinutesBefore: 0
    });

    expect(getTaskReminderOverview(state, new Date(2026, 7, 9, 9))).toEqual([
      expect.objectContaining({ id: "missed", status: "missed" }),
      expect.objectContaining({ id: "done", status: "completed" }),
      expect.objectContaining({ id: "snoozed", status: "snoozed" }),
      expect.objectContaining({ id: "upcoming", status: "upcoming" })
    ]);
  });
});
