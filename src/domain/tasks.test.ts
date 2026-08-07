import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import { rollover } from "./rollover";
import { getSevenDayStats } from "./stats";
import {
  addCategory,
  addFixedTask,
  addScheduledTask,
  deleteCategory,
  deleteTask,
  setFixedTaskActive,
  toggleFixedRecord,
  toggleFixedTaskForDate,
  toggleScheduledTask,
  updateFixedTask,
  updateScheduledTask
} from "./tasks";
import type { AppState, FixedTaskRecord } from "./types";

const now = new Date("2026-07-31T08:00:00.000Z");

function state(): AppState {
  return createInitialState(now);
}

describe("task and category rules", () => {
  it("trims task titles and rejects empty titles", () => {
    expect(() => addScheduledTask(state(), {
      title: "   ",
      categoryId: "study",
      scheduledDate: "2026-07-31"
    }, now)).toThrow("请输入任务名称");

    const result = addScheduledTask(state(), {
      title: "  复习数学  ",
      categoryId: "study",
      scheduledDate: "2026-07-31"
    }, now);

    expect(result.scheduledTasks[0]?.title).toBe("复习数学");
  });

  it("normalizes category names and rejects duplicate names", () => {
    const first = addCategory(state(), { name: "  阅读  ", icon: "书" }, now);

    expect(first.categories.at(-1)).toMatchObject({
      name: "阅读",
      icon: "书",
      builtIn: false,
      order: 6,
      createdAt: now.toISOString()
    });
    expect(() => addCategory(first, { name: " 阅读 ", icon: "册" }, now))
      .toThrow("分类名称已存在");
  });

  it("deleting a custom category moves current tasks to other without rewriting snapshots", () => {
    const withCategory = addCategory(state(), { name: "阅读", icon: "书" }, now);
    const category = withCategory.categories.at(-1)!;
    const withFixedTask = addFixedTask(withCategory, {
      title: "读十页书",
      categoryId: category.id,
      activeFrom: "2026-07-31"
    }, now);
    const withTask = addScheduledTask(withFixedTask, {
      title: "读十页书",
      categoryId: category.id,
      scheduledDate: "2026-07-31"
    }, now);
    const withHistoricalRecord = {
      ...withTask,
      fixedRecords: withTask.fixedRecords.map((record) => ({
        ...record,
        date: "2026-07-30" as const
      }))
    };

    const result = deleteCategory(withHistoricalRecord, category.id);

    expect(result.categories.some((item) => item.id === category.id)).toBe(false);
    expect(result.fixedTasks[0]).toMatchObject({
      categoryId: "other",
      categoryNameSnapshot: "阅读"
    });
    expect(result.scheduledTasks[0]).toMatchObject({
      categoryId: "other",
      categoryNameSnapshot: "阅读"
    });
    expect(result.fixedRecords[0]).toMatchObject({
      categoryId: "other",
      categoryNameSnapshot: "阅读"
    });
    expect(withTask.fixedTasks[0]?.categoryId).toBe(category.id);
    expect(withTask.scheduledTasks[0]?.categoryId).toBe(category.id);
  });

  it("does not delete built-in categories", () => {
    const original = state();
    const result = deleteCategory(original, "study");

    expect(result).toBe(original);
  });

  it("creates a fixed task template and one record for its active day", () => {
    const result = addFixedTask(state(), {
      title: "  背英语单词 ",
      categoryId: "study",
      activeFrom: "2026-07-31"
    }, now);

    expect(result.fixedTasks[0]).toMatchObject({
      title: "背英语单词",
      categoryId: "study",
      categoryNameSnapshot: "学习",
      activeFrom: "2026-07-31",
      order: 0,
      createdAt: now.toISOString()
    });
    expect(result.fixedRecords).toMatchObject([{
      templateId: result.fixedTasks[0]?.id,
      date: "2026-07-31",
      titleSnapshot: "背英语单词",
      categoryId: "study",
      categoryNameSnapshot: "学习"
    }]);
  });

  it("editing a fixed task changes its future template but not historical snapshots", () => {
    const withTemplate = addFixedTask(state(), {
      title: "背 20 个英语单词",
      categoryId: "study",
      activeFrom: "2026-07-30"
    }, now);
    const template = withTemplate.fixedTasks[0]!;
    const yesterday: FixedTaskRecord = {
      id: "record-yesterday",
      templateId: template.id,
      date: "2026-07-30",
      titleSnapshot: "背 20 个英语单词",
      categoryId: "study",
      categoryNameSnapshot: "学习"
    };
    const stateWithYesterdayRecord = { ...withTemplate, fixedRecords: [yesterday] };

    const result = updateFixedTask(stateWithYesterdayRecord, template.id, {
      title: "背 30 个英语单词",
      categoryId: "study"
    }, "2026-07-31");

    expect(result.fixedRecords[0]?.titleSnapshot).toBe("背 20 个英语单词");
    expect(result.fixedTasks[0]).toMatchObject({
      title: "背 30 个英语单词",
      categoryId: "study",
      categoryNameSnapshot: "学习"
    });
  });

  it("reactivates a paused fixed task as a new activation period without corrupting paused history", () => {
    const withTemplate = addFixedTask(state(), {
      title: "拉伸",
      categoryId: "exercise",
      activeFrom: "2026-07-31"
    }, now);
    const templateId = withTemplate.fixedTasks[0]!.id;

    const inactive = setFixedTaskActive(withTemplate, templateId, false, new Date(2026, 7, 1, 8));
    const rolled = rollover(inactive, new Date(2026, 7, 2, 8));
    const withPausedRecord = {
      ...rolled,
      fixedRecords: [...rolled.fixedRecords, {
        id: "record-during-pause",
        templateId,
        date: "2026-08-02" as const,
        titleSnapshot: "拉伸",
        categoryId: "exercise",
        categoryNameSnapshot: "运动"
      }]
    };
    const active = setFixedTaskActive(withPausedRecord, templateId, true, new Date(2026, 7, 3, 8));
    const successor = active.fixedTasks.find((task) => task.id !== templateId);
    const stats = getSevenDayStats(active, new Date(2026, 7, 3, 8));

    expect(inactive.fixedTasks[0]?.inactiveFrom).toBe("2026-08-01");
    expect(active.fixedTasks.find((task) => task.id === templateId)?.inactiveFrom).toBe("2026-08-01");
    expect(successor).toMatchObject({
      title: "拉伸",
      categoryId: "exercise",
      categoryNameSnapshot: "运动",
      activeFrom: "2026-08-03"
    });
    expect(active.fixedRecords).toEqual(expect.arrayContaining([
      expect.objectContaining({ templateId: successor?.id, date: "2026-08-03" })
    ]));
    expect(stats.find((day) => day.date === "2026-08-02")).toMatchObject({ total: 0, hasData: false });
    expect(stats.find((day) => day.date === "2026-08-03")).toMatchObject({ total: 1, hasData: true });
  });

  it("updates only pending and backlog scheduled tasks", () => {
    const withPending = addScheduledTask(state(), {
      title: "原任务",
      categoryId: "study",
      scheduledDate: "2026-07-31"
    }, now);
    const pendingId = withPending.scheduledTasks[0]!.id;
    const completed = toggleScheduledTask(withPending, pendingId, now);

    const result = updateScheduledTask(completed, pendingId, {
      title: "不应改名",
      categoryId: "work",
      scheduledDate: "2026-08-01"
    });

    expect(result).toBe(completed);
  });

  it("toggling scheduled completion never duplicates the task", () => {
    const withTask = addScheduledTask(state(), {
      title: "完成练习",
      categoryId: "study",
      scheduledDate: "2026-07-31"
    }, now);
    const taskId = withTask.scheduledTasks[0]!.id;

    const once = toggleScheduledTask(withTask, taskId, now);
    const twice = toggleScheduledTask(once, taskId, now);
    const threeTimes = toggleScheduledTask(twice, taskId, now);

    expect(threeTimes.scheduledTasks[0]).toMatchObject({
      status: "completed",
      completedAt: now.toISOString()
    });
    expect(threeTimes.scheduledTasks).toHaveLength(1);
  });

  it.each([
    ["2026-07-30", "backlog"],
    ["2026-07-20", "archived"]
  ] as const)("restores a retroactively completed %s task to %s when undone", (scheduledDate, originalStatus) => {
    const original = state();
    original.scheduledTasks.push({
      id: "forgotten", title: "忘记打勾", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate, status: originalStatus, createdAt: "2026-07-20T08:00:00.000Z"
    });

    const completed = toggleScheduledTask(original, "forgotten", now);
    const undone = toggleScheduledTask(completed, "forgotten", now);

    expect(completed.scheduledTasks[0]).toMatchObject({ status: "completed", completedAt: now.toISOString() });
    expect(undone.scheduledTasks[0]).toMatchObject({ status: originalStatus, completedAt: undefined });
  });

  it("creates a dated fixed record when a past completion was never recorded", () => {
    const original = state();
    original.fixedTasks.push({
      id: "exercise", title: "跑步 4KM", categoryId: "exercise", categoryNameSnapshot: "运动",
      activeFrom: "2026-07-27", estimatedMinutes: 30, order: 0, createdAt: now.toISOString()
    });

    const completed = toggleFixedTaskForDate(original, "exercise", "2026-07-29", now);

    expect(completed.fixedRecords).toEqual([
      expect.objectContaining({
        templateId: "exercise", date: "2026-07-29", titleSnapshot: "跑步 4KM",
        estimatedMinutes: 30, completedAt: now.toISOString()
      })
    ]);
  });

  it("toggles a fixed record without replacing its snapshots", () => {
    const original = state();
    const record: FixedTaskRecord = {
      id: "record-today",
      templateId: "template-1",
      date: "2026-07-31",
      titleSnapshot: "拉伸",
      categoryId: "exercise",
      categoryNameSnapshot: "运动"
    };
    const withRecord = { ...original, fixedRecords: [record] };

    const completed = toggleFixedRecord(withRecord, record.id, now);
    const pending = toggleFixedRecord(completed, record.id, now);

    expect(completed.fixedRecords[0]).toMatchObject({
      titleSnapshot: "拉伸",
      completedAt: now.toISOString()
    });
    expect(pending.fixedRecords[0]).toMatchObject({
      titleSnapshot: "拉伸",
      completedAt: undefined
    });
    expect(pending.fixedRecords).toHaveLength(1);
  });

  it("deletes task definitions while preserving fixed completion history", () => {
    const withFixedTask = addFixedTask(state(), {
      title: "拉伸",
      categoryId: "exercise",
      activeFrom: "2026-07-31"
    }, now);
    const fixedTaskId = withFixedTask.fixedTasks[0]!.id;
    const withTasks = addScheduledTask(withFixedTask, {
      title: "临时任务",
      categoryId: "work",
      scheduledDate: "2026-07-31"
    }, now);
    const scheduledTaskId = withTasks.scheduledTasks[0]!.id;
    const withHistory = {
      ...withTasks,
      fixedRecords: [{
        id: "record-history",
        templateId: fixedTaskId,
        date: "2026-07-31" as const,
        titleSnapshot: "拉伸",
        categoryId: "exercise",
        categoryNameSnapshot: "运动"
      }]
    };

    const withoutFixed = deleteTask(withHistory, "fixed", fixedTaskId);
    const result = deleteTask(withoutFixed, "scheduled", scheduledTaskId);

    expect(result.fixedTasks).toHaveLength(0);
    expect(result.fixedRecords).toHaveLength(1);
    expect(result.scheduledTasks).toHaveLength(0);
  });
});
