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
