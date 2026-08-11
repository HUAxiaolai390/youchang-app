import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppStateProvider } from "../../app/AppStateProvider";
import { createInitialState } from "../../domain/defaults";
import type { AppState } from "../../domain/types";
import type { AppRepository } from "../../storage/repository";
import { SettingsPage } from "./SettingsPage";
import { InstallPromptProvider } from "../../components/InstallPromptProvider";

class InMemoryRepository implements AppRepository {
  state: AppState;

  constructor(state: AppState) {
    this.state = state;
  }

  load() { return this.state; }
  save(state: AppState) { this.state = state; }
  clear() {
    this.state = createInitialState(new Date(2026, 6, 31, 9));
    return this.state;
  }
}

function renderSettings(state = createInitialState(new Date(2026, 6, 31, 9))) {
  const repository = new InMemoryRepository(state);
  render(<InstallPromptProvider><AppStateProvider repository={repository}><SettingsPage /></AppStateProvider></InstallPromptProvider>);
  return repository;
}

function backupFile(text: string, name = "backup.json") {
  const file = new File([text], name, { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => text });
  return file;
}

describe("SettingsPage", () => {
  it("changes the display name", async () => {
    const repository = renderSettings();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("我的称呼"));
    await user.type(screen.getByLabelText("我的称呼"), "小伍");
    await user.click(screen.getByRole("button", { name: "保存称呼" }));

    expect(repository.load().settings.displayName).toBe("小伍");
  });

  it("shows the system-notification capability without blocking in-app reminders", () => {
    renderSettings();

    expect(screen.getByRole("heading", { name: "任务提醒" })).toBeVisible();
    expect(screen.getByText(/有常打开时会显示应用内提醒/)).toBeVisible();
  });

  it("rejects an invalid backup without clearing tasks", async () => {
    const state = createInitialState(new Date(2026, 6, 31, 9));
    state.scheduledTasks.push({
      id: "task-1", title: "已有任务", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-07-31", status: "pending", createdAt: "2026-07-31T01:00:00.000Z"
    });
    const repository = renderSettings(state);
    const user = userEvent.setup();

    await user.upload(screen.getByLabelText("导入备份"), backupFile("bad", "bad.json"));

    expect(await screen.findByText("备份文件格式不正确")).toBeVisible();
    expect(repository.load().scheduledTasks).toHaveLength(1);
  });

  it("shows a backup summary and waits for confirmation before replacing data", async () => {
    const repository = renderSettings();
    const imported = createInitialState(new Date(2026, 6, 30, 9));
    imported.settings.displayName = "备份里的我";
    imported.scheduledTasks.push({
      id: "imported-task", title: "备份任务", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-07-30", status: "pending", createdAt: "2026-07-30T01:00:00.000Z"
    });
    const user = userEvent.setup();

    await user.upload(screen.getByLabelText("导入备份"), backupFile(JSON.stringify(imported)));

    expect(await screen.findByText("将导入 1 个临时任务、0 个固定任务、0 个目标和 6 个分类")).toBeVisible();
    expect(repository.load().settings.displayName).toBe("");
    await user.click(screen.getByRole("button", { name: "确认导入" }));
    expect(repository.load().settings.displayName).toBe("备份里的我");
  });

  it("synchronizes the name draft after importing a new display name", async () => {
    const current = createInitialState(new Date(2026, 6, 31, 9));
    current.settings.displayName = "旧称呼";
    const repository = renderSettings(current);
    const imported = createInitialState(new Date(2026, 6, 30, 9));
    imported.settings.displayName = "新的称呼";
    const user = userEvent.setup();

    await user.upload(screen.getByLabelText("导入备份"), backupFile(JSON.stringify(imported)));
    await user.click(screen.getByRole("button", { name: "确认导入" }));

    expect(screen.getByLabelText("我的称呼")).toHaveValue("新的称呼");
    await user.click(screen.getByRole("button", { name: "保存称呼" }));
    expect(repository.load().settings.displayName).toBe("新的称呼");
  });

  it("falls back to an imported other category before adding a fixed task", async () => {
    const repository = renderSettings();
    const imported = createInitialState(new Date(2026, 6, 30, 9));
    imported.categories = [imported.categories.find((category) => category.id === "other")!];
    const user = userEvent.setup();

    await user.upload(screen.getByLabelText("导入备份"), backupFile(JSON.stringify(imported)));
    await user.click(screen.getByRole("button", { name: "确认导入" }));

    expect(screen.getByLabelText("固定任务分类")).toHaveValue("other");
    await user.type(screen.getByLabelText("固定任务名称"), "备份后的固定任务");
    await user.click(screen.getByRole("button", { name: "新增固定任务" }));
    expect(repository.load().fixedTasks[0]).toMatchObject({ title: "备份后的固定任务", categoryId: "other" });
  });

  it("requires typing 清空 before clearing data", async () => {
    const state = createInitialState(new Date(2026, 6, 31, 9));
    state.scheduledTasks.push({
      id: "task-1", title: "已有任务", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-07-31", status: "pending", createdAt: "2026-07-31T01:00:00.000Z"
    });
    const repository = renderSettings(state);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "清空所有数据" }));
    expect(screen.getByRole("button", { name: "确认清空" })).toBeDisabled();
    await user.type(screen.getByLabelText("确认清空"), "清空");
    await user.click(screen.getByRole("button", { name: "确认清空" }));
    expect(screen.getByRole("dialog", { name: "确认清空所有数据" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "我确认清空" }));

    expect(repository.load().scheduledTasks).toEqual([]);
  });

  it("reassigns current tasks to other while retaining the original category in history", async () => {
    const state = createInitialState(new Date(2026, 6, 31, 9));
    state.categories.push({ id: "reading", name: "阅读", icon: "读", builtIn: false, order: 6, createdAt: "2026-07-31T01:00:00.000Z" });
    state.scheduledTasks.push({
      id: "task-reading", title: "专注阅读", categoryId: "reading", categoryNameSnapshot: "阅读",
      scheduledDate: "2026-07-31", status: "pending", createdAt: "2026-07-31T01:00:00.000Z"
    });
    state.fixedRecords.push({
      id: "record-reading", templateId: "fixed-reading", titleSnapshot: "已读完的书", categoryId: "reading", categoryNameSnapshot: "阅读", date: "2026-07-30"
    });
    const repository = renderSettings(state);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "删除分类：阅读" }));
    await user.click(screen.getByRole("button", { name: "删除分类" }));

    expect(repository.load().scheduledTasks[0]).toMatchObject({ categoryId: "other", categoryNameSnapshot: "阅读" });
    expect(screen.getByText("当前任务：专注阅读（其他）")).toBeVisible();
    expect(screen.getByText("历史任务：已读完的书（其他）")).toBeVisible();
    expect(screen.getAllByText("原分类：阅读")).toHaveLength(2);
  });

  it("adds and can pause a fixed task", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 1, 12));
    const repository = renderSettings();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    try {
      await user.type(screen.getByLabelText("固定任务名称"), "晨读");
      await user.selectOptions(screen.getByLabelText("固定任务分类"), "study");
      await user.click(screen.getByRole("button", { name: "新增固定任务" }));
      await user.click(screen.getByRole("button", { name: "停用：晨读" }));

      expect(repository.load().fixedTasks).toHaveLength(1);
      expect(repository.load().fixedTasks[0].inactiveFrom).toBe("2026-08-01");
    } finally {
      vi.useRealTimers();
    }
  });

  it("associates a managed fixed task with a long-term goal", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 1, 12));
    const state = createInitialState(new Date(2026, 7, 1, 12));
    state.goals = [{ id: "health", title: "完成三个月体能训练", deadline: "2026-11-01", createdAt: "2026-08-01T04:00:00.000Z" }];
    const repository = renderSettings(state);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    try {
      await user.type(screen.getByLabelText("固定任务名称"), "晨跑");
      await user.selectOptions(screen.getByLabelText("关联长期目标（选填）"), "health");
      await user.click(screen.getByRole("button", { name: "新增固定任务" }));

      expect(repository.load().fixedTasks[0]).toMatchObject({ goalId: "health" });
      expect(screen.getByText(/目标：完成三个月体能训练/)).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it("saves a reminder for a fixed task with a start time", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 1, 12));
    const repository = renderSettings();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    try {
      await user.type(screen.getByLabelText("固定任务名称"), "晚间复盘");
      await user.type(screen.getByLabelText("开始时间（选填）"), "21:00");
      await user.selectOptions(screen.getByRole("combobox", { name: "任务提醒" }), "30");
      await user.click(screen.getByRole("button", { name: "新增固定任务" }));

      expect(repository.load().fixedTasks[0]).toMatchObject({
        plannedStartTime: "21:00",
        reminderMinutesBefore: 30
      });
      expect(repository.load().fixedRecords[0]).toMatchObject({ reminderMinutesBefore: 30 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("adds a weekly target and supports one-day leave and temporary pause", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 3, 12));
    const repository = renderSettings();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    try {
      await user.type(screen.getByLabelText("固定任务名称"), "每周跑步");
      await user.selectOptions(screen.getByLabelText("重复方式"), "weekly-count");
      await user.clear(screen.getByLabelText("每周完成次数"));
      await user.type(screen.getByLabelText("每周完成次数"), "2");
      await user.click(screen.getByRole("button", { name: "新增固定任务" }));

      expect(repository.load().fixedTasks[0].repeatRule).toEqual({ type: "weekly-count", timesPerWeek: 2 });
      await user.click(screen.getByRole("button", { name: "请假或暂停：每周跑步" }));
      await user.click(screen.getByRole("button", { name: "仅请假这一天" }));
      expect(repository.load().fixedTasks[0].skippedDates).toEqual(["2026-08-03"]);
      expect(repository.load().fixedRecords).toHaveLength(0);

      await user.click(screen.getByRole("button", { name: "请假或暂停：每周跑步" }));
      await user.clear(screen.getByLabelText("选择日期"));
      await user.type(screen.getByLabelText("选择日期"), "2026-08-05");
      await user.click(screen.getByRole("button", { name: "暂停到这一天" }));
      expect(repository.load().fixedTasks[0].pausedUntil).toBe("2026-08-05");
    } finally {
      vi.useRealTimers();
    }
  });
});
