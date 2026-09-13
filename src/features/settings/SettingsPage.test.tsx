import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppStateProvider } from "../../app/AppStateProvider";
import { createInitialState } from "../../domain/defaults";
import type { AppState, FixedTaskTemplate } from "../../domain/types";
import type { AppRepository } from "../../storage/repository";
import { SettingsPage } from "./SettingsPage";

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
  render(<AppStateProvider repository={repository}><SettingsPage /></AppStateProvider>);
  return repository;
}

function backupFile(text: string, name = "backup.json") {
  const file = new File([text], name, { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => text });
  return file;
}

function addManagedFixedTask(state: AppState, overrides: Partial<FixedTaskTemplate> = {}) {
  const task: FixedTaskTemplate = {
    id: "fixed-managed",
    title: "晨读",
    categoryId: "study",
    categoryNameSnapshot: "学习",
    activeFrom: "2026-08-01",
    order: 0,
    createdAt: "2026-08-01T04:00:00.000Z",
    ...overrides
  };
  state.fixedTasks.push(task);
  return task;
}

describe("SettingsPage", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps display-name editing out of the settings page", () => {
    renderSettings();

    expect(screen.queryByRole("heading", { name: "个人设置" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("我的称呼")).not.toBeInTheDocument();
  });

  it("shows the system-notification capability without blocking in-app reminders", () => {
    renderSettings();

    expect(screen.getByRole("heading", { name: "通知权限" })).toBeVisible();
    expect(screen.getByText(/统一管理任务、专注完成和休息结束/)).toBeVisible();
    expect(screen.getByText(/专注或休息倒计时开始后/)).toBeVisible();
  });

  it("saves a do-not-disturb window for ordinary reminders", async () => {
    const repository = renderSettings();
    const user = userEvent.setup();

    const toggle = screen.getByRole("checkbox", { name: "免打扰时间" });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    await user.clear(screen.getByLabelText("免打扰开始"));
    await user.type(screen.getByLabelText("免打扰开始"), "22:30");
    await user.clear(screen.getByLabelText("免打扰结束"));
    await user.type(screen.getByLabelText("免打扰结束"), "07:30");

    expect(repository.load().settings).toMatchObject({
      quietHoursEnabled: true,
      quietHoursStart: "22:30",
      quietHoursEnd: "07:30"
    });
    expect(screen.getByText(/普通任务提醒会在这段时间静默/)).toBeVisible();
  });

  it("shows compact notification diagnostics on demand", async () => {
    renderSettings();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "检查通知状态" }));

    expect(screen.getByRole("status", { name: "通知状态检查结果" })).toHaveTextContent("通知栏权限");
  });

  it("shows the last backup status and a weekly reminder", () => {
    const state = createInitialState(new Date(2026, 7, 15, 9));
    state.settings.lastBackupAt = "2026-08-01T01:00:00.000Z";

    renderSettings(state);

    expect(screen.getByText("建议备份")).toBeVisible();
    expect(screen.getByText(/已超过 7 天/)).toBeVisible();
  });

  it("opens a concise help center without lengthening the settings page", async () => {
    renderSettings();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "打开帮助中心" }));
    const dialog = screen.getByRole("dialog", { name: "使用说明与帮助中心" });

    expect(dialog).toBeVisible();
    expect(within(dialog).getByText("固定任务", { selector: "strong" })).toBeVisible();
    expect(within(dialog).getByText(/适合英语单词、锻炼等重复习惯/)).toBeVisible();
    expect(within(dialog).getByText(/以后再单独制作完整使用手册/)).toBeVisible();

    await user.click(within(dialog).getByRole("button", { name: "知道了" }));
    expect(screen.queryByRole("dialog", { name: "使用说明与帮助中心" })).not.toBeInTheDocument();
  });

  it("offers a safe way to remove an abnormal-data recovery copy", async () => {
    window.localStorage.setItem("youchang:recovery:2026-08-15T01:00:00.000Z", "{");
    renderSettings();
    const user = userEvent.setup();

    expect(screen.getByRole("heading", { name: "发现异常数据恢复副本" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "删除副本" }));
    const dialog = screen.getByRole("dialog", { name: "删除异常数据副本" });
    expect(dialog).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "删除副本" }));

    expect(screen.queryByRole("heading", { name: "发现异常数据恢复副本" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem("youchang:recovery:2026-08-15T01:00:00.000Z")).toBeNull();
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

  it("keeps fixed-task creation out of settings", () => {
    renderSettings();

    expect(screen.queryByLabelText("固定任务名称")).not.toBeInTheDocument();
    expect(screen.getByText(/新建固定任务请回到“今日”/)).toBeVisible();
  });

  it("shows the current package version instead of a hardcoded version", () => {
    renderSettings();

    expect(screen.getByText("有常 v2.9.0")).toBeVisible();
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

    const categoryManagement = screen.getByText("分类管理").closest("details");
    expect(categoryManagement).not.toHaveAttribute("open");
    await user.click(screen.getByText("分类管理"));
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
    const state = createInitialState(new Date(2026, 7, 1, 12));
    addManagedFixedTask(state);
    const repository = renderSettings(state);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    try {
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
    addManagedFixedTask(state, { title: "晨跑" });
    const repository = renderSettings(state);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    try {
      await user.click(screen.getByRole("button", { name: "编辑固定任务：晨跑" }));
      const editDialog = screen.getByRole("dialog", { name: "编辑固定任务" });
      expect(editDialog).toBeVisible();
      expect(editDialog.closest(".settings-section")).toBeNull();
      await user.selectOptions(screen.getByLabelText("编辑用于推进的长期目标（选填）"), "health");
      await user.click(screen.getByRole("button", { name: "保存固定任务" }));

      expect(repository.load().fixedTasks[0]).toMatchObject({ goalId: "health" });
      expect(screen.getByText(/目标：完成三个月体能训练/)).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it("saves a reminder for a fixed task with a start time", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 1, 12));
    const state = createInitialState(new Date(2026, 7, 1, 12));
    addManagedFixedTask(state, { title: "晚间复盘" });
    const repository = renderSettings(state);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    try {
      await user.click(screen.getByRole("button", { name: "编辑固定任务：晚间复盘" }));
      await user.type(screen.getByLabelText("编辑开始时间（选填）"), "21:00");
      await user.selectOptions(screen.getByRole("combobox", { name: "编辑任务提醒" }), "30");
      await user.click(screen.getByRole("button", { name: "保存固定任务" }));

      expect(repository.load().fixedTasks[0]).toMatchObject({
        plannedStartTime: "21:00",
        reminderMinutesBefore: 30
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("deletes a managed fixed task after confirmation while keeping its history", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 1, 12));
    const state = createInitialState(new Date(2026, 7, 1, 12));
    const task = addManagedFixedTask(state, { title: "晨读" });
    state.fixedRecords.push({
      id: "fixed-history",
      templateId: task.id,
      titleSnapshot: task.title,
      categoryId: task.categoryId,
      categoryNameSnapshot: task.categoryNameSnapshot,
      date: "2026-07-31",
      completedAt: "2026-07-31T01:30:00.000Z"
    });
    const repository = renderSettings(state);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    try {
      await user.click(screen.getByRole("button", { name: "删除固定任务：晨读" }));
      const dialog = screen.getByRole("dialog", { name: "删除固定任务" });
      expect(dialog).toHaveTextContent("已有的完成记录和成长统计会保留");
      await user.click(within(dialog).getByRole("button", { name: "删除固定任务" }));

      expect(repository.load().fixedTasks).toHaveLength(0);
      expect(repository.load().fixedRecords).toHaveLength(1);
      expect(screen.queryByText("晨读")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("adds a weekly target and supports one-day leave and temporary pause", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 3, 12));
    const state = createInitialState(new Date(2026, 7, 3, 12));
    addManagedFixedTask(state, {
      title: "每周跑步",
      repeatRule: { type: "weekly-count", timesPerWeek: 2 }
    });
    const repository = renderSettings(state);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    try {
      expect(repository.load().fixedTasks[0].repeatRule).toEqual({ type: "weekly-count", timesPerWeek: 2 });
      await user.click(screen.getByRole("button", { name: "请假或暂停：每周跑步" }));
      expect(screen.getByRole("dialog", { name: "请假或暂停" }).closest(".settings-section")).toBeNull();
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
