import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppStateProvider } from "../../app/AppStateProvider";
import { createInitialState } from "../../domain/defaults";
import type { AppState } from "../../domain/types";
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

describe("SettingsPage", () => {
  it("changes the display name", async () => {
    const repository = renderSettings();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("我的称呼"));
    await user.type(screen.getByLabelText("我的称呼"), "小伍");
    await user.click(screen.getByRole("button", { name: "保存称呼" }));

    expect(repository.load().settings.displayName).toBe("小伍");
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

    expect(await screen.findByText("将导入 1 个临时任务、0 个固定任务和 6 个分类")).toBeVisible();
    expect(repository.load().settings.displayName).toBe("");
    await user.click(screen.getByRole("button", { name: "确认导入" }));
    expect(repository.load().settings.displayName).toBe("备份里的我");
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
    const repository = renderSettings();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("固定任务名称"), "晨读");
    await user.selectOptions(screen.getByLabelText("固定任务分类"), "study");
    await user.click(screen.getByRole("button", { name: "新增固定任务" }));
    await user.click(screen.getByRole("button", { name: "停用：晨读" }));

    expect(repository.load().fixedTasks).toHaveLength(1);
    expect(repository.load().fixedTasks[0].inactiveFrom).toBe("2026-08-01");
  });
});
