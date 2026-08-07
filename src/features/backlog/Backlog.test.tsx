import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppStateProvider } from "../../app/AppStateProvider";
import { createInitialState } from "../../domain/defaults";
import type { AppState, TaskStatus } from "../../domain/types";
import type { AppRepository } from "../../storage/repository";
import { Backlog } from "./Backlog";

class MemoryRepository implements AppRepository {
  private value: AppState;

  constructor(value: AppState) {
    this.value = value;
  }

  load() {
    return this.value;
  }

  save(state: AppState) {
    this.value = state;
  }

  clear() {
    this.value = createInitialState(new Date());
    return this.value;
  }
}

const now = new Date("2026-07-31T09:00:00");

function addTask(state: AppState, id: string, title: string, scheduledDate: `${number}-${number}-${number}`, status: TaskStatus) {
  state.scheduledTasks.push({
    id,
    title,
    categoryId: "study",
    categoryNameSnapshot: "学习",
    scheduledDate,
    status,
    createdAt: "2026-07-30T09:00:00.000Z"
  });
}

function renderBacklogWithTask(status: TaskStatus = "backlog", scheduledDate = "2026-07-30" as `${number}-${number}-${number}`) {
  const state = createInitialState(now);
  addTask(state, "task-1", "完成实验报告", scheduledDate, status);
  const repository = new MemoryRepository(state);
  const user = userEvent.setup();

  render(<AppStateProvider repository={repository}><Backlog now={now} /></AppStateProvider>);

  return { repository, user };
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }).setSystemTime(now));
afterEach(() => vi.useRealTimers());

describe("Backlog", () => {
  it("moves a backlog task to another day in the current week", async () => {
    const { repository, user } = renderBacklogWithTask();

    await user.click(screen.getByRole("button", { name: "改期：完成实验报告" }));
    await user.click(screen.getByRole("button", { name: "星期六 8月1日" }));

    expect(screen.queryByText("完成实验报告")).not.toBeInTheDocument();
    expect(repository.load().scheduledTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scheduledDate: "2026-08-01",
        status: "pending",
        sourceTaskId: "task-1"
      })
    ]));
  });

  it("shows the original date and category, and only enables today onward this week", async () => {
    const { user } = renderBacklogWithTask();

    expect(screen.getByText(/原定：7月30日/)).toBeInTheDocument();
    expect(screen.getByText(/· 学习/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "改期：完成实验报告" }));

    expect(screen.getByRole("button", { name: "星期一 7月27日" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "星期四 7月30日" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "星期五 7月31日" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "星期日 8月2日" })).toBeEnabled();
  });

  it("shows a current live category label instead of a historical snapshot", () => {
    const state = createInitialState(now);
    state.scheduledTasks.push({
      id: "task-reading",
      title: "完成阅读笔记",
      categoryId: "other",
      categoryNameSnapshot: "阅读",
      scheduledDate: "2026-07-30",
      status: "backlog",
      createdAt: "2026-07-30T09:00:00.000Z"
    });

    render(<AppStateProvider repository={new MemoryRepository(state)}><Backlog now={now} /></AppStateProvider>);

    expect(screen.getByText(/原定：7月30日 · 其他/)).toBeVisible();
    expect(screen.queryByText(/原定：7月30日 · 阅读/)).not.toBeInTheDocument();
  });

  it("keeps an out-of-week backlog task out of this week's panel", () => {
    renderBacklogWithTask("backlog", "2026-07-20");

    expect(screen.queryByText("完成实验报告")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "本周待安排" }).parentElement).toHaveTextContent("0 项");
  });

  it("moves an archived task from the collapsed history into the current week", async () => {
    const { repository, user } = renderBacklogWithTask("archived");

    await user.click(screen.getByText(/^上周未处理/));
    await user.click(screen.getByRole("button", { name: "移入本周：完成实验报告" }));
    await user.click(screen.getByRole("button", { name: "星期五 7月31日" }));

    expect(repository.load().scheduledTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ scheduledDate: "2026-07-31", status: "pending", sourceTaskId: "task-1" })
    ]));
    expect(screen.queryByRole("button", { name: "移入本周：完成实验报告" })).not.toBeInTheDocument();
  });

  it("cancels and confirms deletion of a weekly backlog task", async () => {
    const { repository, user } = renderBacklogWithTask();

    await user.click(screen.getByRole("button", { name: "删除：完成实验报告" }));
    expect(screen.getByRole("dialog", { name: "删除待安排任务？" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(repository.load().scheduledTasks).toHaveLength(1);
    expect(screen.getByText("完成实验报告")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "删除：完成实验报告" }));
    await user.click(screen.getByRole("button", { name: "删除任务" }));
    expect(repository.load().scheduledTasks).toEqual([]);
    expect(screen.queryByText("完成实验报告")).not.toBeInTheDocument();
  });

  it("cancels and confirms deletion of an archived backlog task", async () => {
    const { repository, user } = renderBacklogWithTask("archived");

    await user.click(screen.getByText(/^上周未处理/));
    await user.click(screen.getByRole("button", { name: "删除：完成实验报告" }));
    expect(screen.getByRole("dialog", { name: "删除历史任务？" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(repository.load().scheduledTasks).toHaveLength(1);
    expect(screen.getByText("完成实验报告")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "删除：完成实验报告" }));
    await user.click(screen.getByRole("button", { name: "删除任务" }));
    expect(repository.load().scheduledTasks).toEqual([]);
    expect(screen.queryByText("完成实验报告")).not.toBeInTheDocument();
  });

  it("also retroactively completes a task from an earlier week", async () => {
    const { repository, user } = renderBacklogWithTask("archived", "2026-07-20");

    await user.click(screen.getByText(/^上周未处理/));
    await user.click(screen.getByRole("button", { name: "补记完成：完成实验报告" }));

    expect(repository.load().scheduledTasks[0]).toMatchObject({ status: "completed" });
    expect(screen.getByRole("status")).toHaveTextContent(/已按原定 7月20日\s+补记/);

    await user.click(screen.getByRole("button", { name: "撤销补记：完成实验报告" }));
    expect(repository.load().scheduledTasks[0]).toMatchObject({ status: "archived", completedAt: undefined });
  });

  it("marks a forgotten backlog task complete on its original date and lets the user undo", async () => {
    const { repository, user } = renderBacklogWithTask();

    await user.click(screen.getByRole("button", { name: "补记完成：完成实验报告" }));

    expect(repository.load().scheduledTasks[0]).toMatchObject({ status: "completed", completedAt: expect.any(String) });
    expect(screen.getByRole("status")).toHaveTextContent(/已按原定 7月30日\s+补记“完成实验报告”完成/);
    expect(screen.queryByRole("button", { name: "补记完成：完成实验报告" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "撤销补记：完成实验报告" }));

    expect(repository.load().scheduledTasks[0]).toMatchObject({ status: "backlog", completedAt: undefined });
    expect(screen.getByRole("button", { name: "补记完成：完成实验报告" })).toBeVisible();
  });

  it("records and edits the actual time of a backlog task", async () => {
    const { repository, user } = renderBacklogWithTask();

    await user.click(screen.getByRole("button", { name: "记录用时：完成实验报告" }));
    await user.clear(screen.getByLabelText("实际用时（分钟）"));
    await user.type(screen.getByLabelText("实际用时（分钟）"), "75");
    await user.click(screen.getByRole("button", { name: "保存用时" }));

    expect(screen.getByText(/实际 75 分钟/)).toBeVisible();
    expect(repository.load().scheduledTasks[0].actualMinutes).toBe(75);
  });
});
