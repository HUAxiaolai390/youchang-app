import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppStateProvider } from "../../app/AppStateProvider";
import { createInitialState } from "../../domain/defaults";
import type { AppState } from "../../domain/types";
import type { AppRepository } from "../../storage/repository";
import { WeekPage } from "./WeekPage";

class MemoryRepository implements AppRepository {
  state: AppState;
  constructor(state: AppState) { this.state = state; }
  load() { return this.state; }
  save(state: AppState) { this.state = state; }
  clear() { this.state = createInitialState(new Date()); return this.state; }
}

function renderWeek(state = createInitialState(new Date(2026, 7, 5, 9))) {
  const repository = new MemoryRepository(state);
  const user = userEvent.setup();
  render(<AppStateProvider repository={repository}><WeekPage now={new Date(2026, 7, 5, 9)} /></AppStateProvider>);
  return { repository, user };
}

describe("WeekPage", () => {
  it("shows all seven days and sorts today by planned start time", () => {
    const state = createInitialState(new Date(2026, 7, 5, 9));
    state.scheduledTasks.push(
      {
        id: "evening", title: "晚间复习", categoryId: "study", categoryNameSnapshot: "学习",
        scheduledDate: "2026-08-05", status: "pending", plannedStartTime: "19:00",
        estimatedMinutes: 60, actualMinutes: 75, createdAt: new Date(2026, 7, 5, 9).toISOString()
      },
      {
        id: "morning", title: "晨跑", categoryId: "exercise", categoryNameSnapshot: "运动",
        scheduledDate: "2026-08-05", status: "pending", plannedStartTime: "07:00",
        estimatedMinutes: 30, createdAt: new Date(2026, 7, 5, 9).toISOString()
      }
    );

    renderWeek(state);

    expect(screen.getAllByRole("button", { name: /星期. \d+月\d+日，\d+ 项任务/ })).toHaveLength(7);
    const taskList = screen.getByRole("list");
    expect(within(taskList).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("晨跑"),
      expect.stringContaining("晚间复习")
    ]);
    expect(screen.getByText(/预计 60 分钟 · 实际 75 分钟 · 多 15 分钟/)).toBeVisible();
  });

  it("moves an unfinished task to another available day in the week", async () => {
    const state = createInitialState(new Date(2026, 7, 5, 9));
    state.scheduledTasks.push({
      id: "task", title: "完成报告", categoryId: "work", categoryNameSnapshot: "工作",
      scheduledDate: "2026-08-05", status: "pending", plannedStartTime: "14:00",
      estimatedMinutes: 90, createdAt: new Date(2026, 7, 5, 9).toISOString()
    });
    const { repository, user } = renderWeek(state);

    await user.click(screen.getByRole("button", { name: "改期：完成报告" }));
    await user.click(screen.getByRole("button", { name: /^8月6日/ }));

    expect(screen.getByRole("heading", { name: "8月6日 星期四" })).toBeVisible();
    expect(repository.state.scheduledTasks.find((task) => task.id === "task")?.status).toBe("rescheduled");
    expect(repository.state.scheduledTasks.find((task) => task.sourceTaskId === "task")).toMatchObject({
      scheduledDate: "2026-08-06", plannedStartTime: "14:00", estimatedMinutes: 90, status: "pending"
    });
  });

  it("retroactively completes and restores a forgotten task on its original day", async () => {
    const state = createInitialState(new Date(2026, 7, 5, 9));
    state.scheduledTasks.push({
      id: "forgotten-run", title: "跑步 4KM", categoryId: "exercise", categoryNameSnapshot: "运动",
      scheduledDate: "2026-08-03", status: "backlog", actualMinutes: 30,
      createdAt: new Date(2026, 7, 3, 9).toISOString()
    });
    const { repository, user } = renderWeek(state);

    await user.click(screen.getByRole("button", { name: /星期一 8月3日/ }));
    await user.click(screen.getByRole("button", { name: "补记完成：跑步 4KM" }));

    expect(repository.state.scheduledTasks[0]).toMatchObject({ status: "completed" });
    expect(screen.getByText("已完成")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "撤销完成：跑步 4KM" }));
    expect(repository.state.scheduledTasks[0]).toMatchObject({ status: "backlog", completedAt: undefined });
  });

  it("creates a fixed record when completing an earlier fixed task", async () => {
    const state = createInitialState(new Date(2026, 7, 5, 9));
    state.fixedTasks.push({
      id: "fixed-reading", title: "英语单词", categoryId: "study", categoryNameSnapshot: "学习",
      activeFrom: "2026-08-03", order: 0, createdAt: new Date(2026, 7, 3, 9).toISOString()
    });
    const { repository, user } = renderWeek(state);

    await user.click(screen.getByRole("button", { name: /星期一 8月3日/ }));
    await user.click(screen.getByRole("button", { name: "补记完成：英语单词" }));

    expect(repository.state.fixedRecords).toEqual([
      expect.objectContaining({ templateId: "fixed-reading", date: "2026-08-03", completedAt: expect.any(String) })
    ]);
  });

  it("adds a timed task directly to the selected day", async () => {
    const { repository, user } = renderWeek();

    await user.click(screen.getByRole("button", { name: /星期四 8月6日/ }));
    await user.click(screen.getByRole("button", { name: "添加到这天" }));
    await user.type(screen.getByLabelText("任务名称"), "英语听力");
    await user.type(screen.getByLabelText("开始时间（选填）"), "20:30");
    await user.type(screen.getByLabelText("预计用时（分钟，选填）"), "40");
    await user.click(screen.getByRole("button", { name: "保存任务" }));

    expect(repository.state.scheduledTasks[0]).toMatchObject({
      title: "英语听力", scheduledDate: "2026-08-06", plannedStartTime: "20:30", estimatedMinutes: 40
    });
    expect(screen.getByText("英语听力")).toBeVisible();
  });
});
