import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "../domain/defaults";
import { downloadBackup, parseBackup, serializeBackup } from "./backup";

describe("versioned backups", () => {
  const state = createInitialState(new Date(2026, 6, 31, 9));

  it("does not overwrite current storage when a backup is invalid", () => {
    const originalText = JSON.stringify(state);
    localStorage.setItem("youchang:state", originalText);

    expect(() => parseBackup('{"schemaVersion":99}')).toThrow("备份文件版本不受支持");
    expect(localStorage.getItem("youchang:state")).toBe(originalText);
  });

  it("round trips a valid version 1 backup", () => {
    expect(parseBackup(serializeBackup(state))).toEqual(state);
  });

  it("accepts backups created before the optional music volume setting existed", () => {
    const legacy = createInitialState(new Date(2026, 6, 31, 9));
    delete legacy.settings.musicVolume;

    expect(parseBackup(JSON.stringify(legacy)).settings.musicVolume).toBeUndefined();
  });

  it("accepts older backups without medal selections", () => {
    const legacy = createInitialState(new Date(2026, 6, 31, 9));
    delete legacy.settings.featuredAchievementIds;

    expect(parseBackup(JSON.stringify(legacy)).settings.featuredAchievementIds).toBeUndefined();
  });

  it("round trips valid medal selections and rejects malformed selections", () => {
    const selected = {
      ...state,
      settings: { ...state.settings, featuredAchievementIds: ["first-task", "first-focus"] }
    };
    expect(parseBackup(JSON.stringify(selected)).settings.featuredAchievementIds).toEqual(["first-task", "first-focus"]);
    expect(() => parseBackup(JSON.stringify({
      ...state,
      settings: { ...state.settings, featuredAchievementIds: ["unknown-medal"] }
    }))).toThrow("备份文件格式无效");
    expect(() => parseBackup(JSON.stringify({
      ...state,
      settings: { ...state.settings, featuredAchievementIds: ["first-task", "first-task"] }
    }))).toThrow("备份文件格式无效");
  });

  it("accepts backups created before focus progress existed", () => {
    const legacy = createInitialState(new Date(2026, 6, 31, 9));
    delete legacy.focus;

    expect(parseBackup(JSON.stringify(legacy)).focus).toBeUndefined();
  });

  it("accepts backups created before time tracking existed", () => {
    const legacy = createInitialState(new Date(2026, 6, 31, 9));
    delete legacy.timeEntries;

    expect(parseBackup(JSON.stringify(legacy)).timeEntries).toEqual([]);
  });

  it("rejects malformed actual time and time entries", () => {
    expect(() => parseBackup(JSON.stringify({
      ...state,
      scheduledTasks: [{
        id: "task", title: "阅读", categoryId: "study", categoryNameSnapshot: "学习",
        scheduledDate: "2026-07-31", status: "pending", createdAt: "2026-07-31T01:00:00.000Z",
        actualMinutes: -1
      }]
    }))).toThrow("备份文件格式无效");

    expect(() => parseBackup(JSON.stringify({
      ...state,
      timeEntries: [{
        id: "entry", title: "阅读", categoryId: "study", categoryNameSnapshot: "学习",
        date: "2026-07-31", minutes: 0, createdAt: "2026-07-31T01:00:00.000Z"
      }]
    }))).toThrow("备份文件格式无效");
  });

  it("round trips optional task planning and rejects malformed planning", () => {
    const planned = {
      ...state,
      scheduledTasks: [{
        id: "task", title: "阅读", categoryId: "study", categoryNameSnapshot: "学习",
        scheduledDate: "2026-07-31" as const, status: "pending" as const,
        plannedStartTime: "19:30" as const, estimatedMinutes: 45,
        createdAt: "2026-07-31T01:00:00.000Z"
      }]
    };

    expect(parseBackup(JSON.stringify(planned)).scheduledTasks[0]).toMatchObject({
      plannedStartTime: "19:30", estimatedMinutes: 45
    });
    expect(() => parseBackup(JSON.stringify({
      ...planned,
      scheduledTasks: [{ ...planned.scheduledTasks[0], plannedStartTime: "28:00" }]
    }))).toThrow("备份文件格式无效");
  });

  it("round trips reminder settings and rejects unsupported lead times", () => {
    const reminded = createInitialState(new Date(2026, 7, 9, 8));
    reminded.settings.systemNotificationsEnabled = true;
    reminded.scheduledTasks.push({
      id: "reminder-task", title: "提醒任务", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "pending", createdAt: "2026-08-09T00:00:00.000Z",
      plannedStartTime: "09:00", reminderMinutesBefore: 10, reminderSentAt: "2026-08-09T00:50:00.000Z"
    });

    const parsed = parseBackup(JSON.stringify(reminded));
    expect(parsed.settings.systemNotificationsEnabled).toBe(true);
    expect(parsed.scheduledTasks[0]).toMatchObject({ reminderMinutesBefore: 10, reminderSentAt: "2026-08-09T00:50:00.000Z" });

    const invalid = JSON.parse(JSON.stringify(reminded));
    invalid.scheduledTasks[0].reminderMinutesBefore = 15;
    expect(() => parseBackup(JSON.stringify(invalid))).toThrow("备份文件格式无效");
  });

  it("round trips task priority and today's focus flag", () => {
    const prioritized = createInitialState(new Date(2026, 7, 10, 8));
    prioritized.scheduledTasks.push({
      id: "priority-task", title: "准备考试", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-10", status: "pending", createdAt: "2026-08-10T00:00:00.000Z",
      priority: "high", isTodayFocus: true
    });

    expect(parseBackup(JSON.stringify(prioritized)).scheduledTasks[0]).toMatchObject({
      priority: "high", isTodayFocus: true
    });
    const invalid = JSON.parse(JSON.stringify(prioritized));
    invalid.scheduledTasks[0].priority = "urgent";
    expect(() => parseBackup(JSON.stringify(invalid))).toThrow("备份文件格式无效");
  });

  it("round trips fixed repeat rules and rejects malformed repeat settings", () => {
    const repeated = {
      ...state,
      fixedTasks: [{
        id: "habit", title: "锻炼", categoryId: "exercise", categoryNameSnapshot: "运动",
        activeFrom: "2026-07-31" as const, repeatRule: { type: "custom-weekdays" as const, weekdays: [1, 3, 5] },
        skippedDates: ["2026-08-03" as const], pausedUntil: "2026-08-05" as const,
        order: 0, createdAt: "2026-07-31T01:00:00.000Z"
      }]
    };
    expect(parseBackup(JSON.stringify(repeated)).fixedTasks[0]).toMatchObject({
      repeatRule: { type: "custom-weekdays", weekdays: [1, 3, 5] },
      skippedDates: ["2026-08-03"], pausedUntil: "2026-08-05"
    });
    expect(() => parseBackup(JSON.stringify({
      ...repeated,
      fixedTasks: [{ ...repeated.fixedTasks[0], repeatRule: { type: "weekly-count", timesPerWeek: 9 } }]
    }))).toThrow("备份文件格式无效");
  });

  it("rejects malformed focus progress", () => {
    expect(() => parseBackup(JSON.stringify({
      ...state,
      focus: { ...state.focus, focusMinutes: 0 }
    }))).toThrow("备份文件格式无效");
  });

  it("rejects an out-of-range music volume", () => {
    expect(() => parseBackup(JSON.stringify({
      ...state,
      settings: { ...state.settings, musicVolume: 1.5 }
    }))).toThrow("备份文件格式无效");
  });

  it("rejects a backup with missing state arrays", () => {
    expect(() => parseBackup(JSON.stringify({
      ...state,
      scheduledTasks: undefined
    }))).toThrow("备份文件格式无效");
  });

  it("rejects a task date that is not a real calendar date", () => {
    expect(() => parseBackup(JSON.stringify({
      ...state,
      scheduledTasks: [{
        id: "task-1",
        title: "阅读",
        categoryId: "study",
        categoryNameSnapshot: "学习",
        scheduledDate: "2026-02-30",
        status: "pending",
        createdAt: "2026-07-31T01:00:00.000Z"
      }]
    }))).toThrow("备份文件格式无效");
  });

  it("falls back invalid live category IDs to other without overwriting historical snapshots", () => {
    const result = parseBackup(JSON.stringify({
      ...state,
      fixedRecords: [{
        id: "fixed-record-1",
        templateId: "fixed-1",
        date: "2026-07-30",
        titleSnapshot: "读完旧书",
        categoryId: "deleted-category",
        categoryNameSnapshot: "阅读"
      }],
      scheduledTasks: [{
        id: "task-1",
        title: "整理桌面",
        categoryId: "deleted-category",
        categoryNameSnapshot: "已删除",
        scheduledDate: "2026-07-31",
        status: "pending",
        createdAt: "2026-07-31T01:00:00.000Z"
      }],
      timeEntries: [{
        id: "time-1",
        title: "旧分类记录",
        categoryId: "deleted-category",
        categoryNameSnapshot: "阅读",
        date: "2026-07-31",
        minutes: 25,
        createdAt: "2026-07-31T01:00:00.000Z"
      }]
    }));

    expect(result.scheduledTasks[0]).toMatchObject({
      categoryId: "other",
      categoryNameSnapshot: "已删除"
    });
    expect(result.fixedRecords[0]).toMatchObject({
      categoryId: "other",
      categoryNameSnapshot: "阅读"
    });
    expect(result.timeEntries?.[0]).toMatchObject({
      categoryId: "other",
      categoryNameSnapshot: "阅读"
    });
  });

  it("downloads a versioned JSON backup with the current date in its name", () => {
    const createObjectUrl = URL.createObjectURL;
    const revokeObjectUrl = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    const url = "blob:youchang-backup";
    let clicked = false;
    URL.createObjectURL = () => url;
    URL.revokeObjectURL = (value) => expect(value).toBe(url);
    HTMLAnchorElement.prototype.click = function click() {
      clicked = true;
      expect(this.download).toBe("有常备份-2026-08-01.json");
    };

    try {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 7, 1, 12));
      downloadBackup(state);
      expect(clicked).toBe(true);
    } finally {
      vi.useRealTimers();
      URL.createObjectURL = createObjectUrl;
      URL.revokeObjectURL = revokeObjectUrl;
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });
});
