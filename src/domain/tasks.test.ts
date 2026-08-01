import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import {
  addCategory,
  addFixedTask,
  addScheduledTask,
  deleteCategory,
  deleteTask,
  setFixedTaskActive,
  toggleFixedRecord,
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

    const result = deleteCategory(withTask, category.id);

    expect(result.categories.some((item) => item.id === category.id)).toBe(false);
    expect(result.fixedTasks[0]).toMatchObject({
      categoryId: "other",
      categoryNameSnapshot: "阅读"
    });
    expect(result.scheduledTasks[0]).toMatchObject({
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

  it("sets a fixed template inactive from today and can reactivate it", () => {
    const withTemplate = addFixedTask(state(), {
      title: "拉伸",
      categoryId: "exercise",
      activeFrom: "2026-07-31"
    }, now);
    const templateId = withTemplate.fixedTasks[0]!.id;

    const inactive = setFixedTaskActive(withTemplate, templateId, false, "2026-08-01");
    const active = setFixedTaskActive(inactive, templateId, true, "2026-08-02");

    expect(inactive.fixedTasks[0]?.inactiveFrom).toBe("2026-08-01");
    expect(active.fixedTasks[0]?.inactiveFrom).toBeUndefined();
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
