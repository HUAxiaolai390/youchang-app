import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppStateProvider } from "../../app/AppStateProvider";
import { toDateKey } from "../../domain/date";
import { createInitialState } from "../../domain/defaults";
import type { AppState } from "../../domain/types";
import type { AppRepository } from "../../storage/repository";
import { TodayPage } from "./TodayPage";

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

function renderToday(state = createInitialState(new Date())) {
  const repository = new MemoryRepository(state);

  render(<AppStateProvider repository={repository}><TodayPage /></AppStateProvider>);
  const user = userEvent.setup();

  return { repository, user };
}

function addTask(state: AppState, id: string, title: string, categoryId: string, status: "pending" | "completed" = "pending") {
  const category = state.categories.find((item) => item.id === categoryId)!;
  state.scheduledTasks.push({
    id,
    title,
    categoryId,
    categoryNameSnapshot: category.name,
    scheduledDate: toDateKey(new Date()),
    status,
    createdAt: "2026-07-31T01:00:00.000Z",
    ...(status === "completed" ? { completedAt: "2026-07-31T01:00:00.000Z" } : {})
  });
}

afterEach(() => vi.useRealTimers());

describe("TodayPage", () => {
  it("adds a temporary study task for today", async () => {
    const { user, repository } = renderToday();

    await user.click(screen.getByRole("button", { name: "添加任务" }));
    await user.type(screen.getByLabelText("任务名称"), "背 20 个英语单词");
    await user.click(screen.getByRole("radio", { name: "临时任务" }));
    await user.click(screen.getByRole("radio", { name: "学习" }));
    await user.click(screen.getByRole("button", { name: "保存任务" }));

    expect(screen.getByText("背 20 个英语单词")).toBeInTheDocument();
    expect(repository.load().scheduledTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ categoryId: "study", scheduledDate: toDateKey(new Date()), status: "pending" })
    ]));
  });

  it("filters visible tasks without changing stored tasks", async () => {
    const state = createInitialState(new Date());
    addTask(state, "study-1", "背单词", "study");
    addTask(state, "exercise-1", "慢跑", "exercise");
    const { user, repository } = renderToday(state);

    await user.click(screen.getByRole("button", { name: "只看运动" }));

    expect(screen.getByText("慢跑")).toBeVisible();
    expect(screen.queryByText("背单词")).not.toBeInTheDocument();
    expect(repository.load().scheduledTasks).toHaveLength(2);
  });

  it("edits a pending task", async () => {
    const state = createInitialState(new Date());
    addTask(state, "study-1", "背单词", "study");
    const { user, repository } = renderToday(state);

    await user.click(screen.getByRole("button", { name: "编辑：背单词" }));
    await user.clear(screen.getByLabelText("任务名称"));
    await user.type(screen.getByLabelText("任务名称"), "背 30 个英语单词");
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(screen.getByText("背 30 个英语单词")).toBeVisible();
    expect(repository.load().scheduledTasks[0].title).toBe("背 30 个英语单词");
  });

  it("confirms before deleting a task", async () => {
    const state = createInitialState(new Date());
    addTask(state, "study-1", "背单词", "study");
    const { user, repository } = renderToday(state);

    await user.click(screen.getByRole("button", { name: "删除：背单词" }));
    expect(screen.getByRole("dialog", { name: "删除任务？" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.getByText("背单词")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "删除：背单词" }));
    await user.click(screen.getByRole("button", { name: "删除" }));
    expect(screen.queryByText("背单词")).not.toBeInTheDocument();
    expect(repository.load().scheduledTasks).toEqual([]);
  });

  it("updates cat feedback as today progresses", async () => {
    const state = createInitialState(new Date());
    addTask(state, "study-1", "背单词", "study");
    addTask(state, "exercise-1", "慢跑", "exercise");
    const { user } = renderToday(state);

    expect(screen.getByText("先完成一件小事，小猫会为你加油。")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "完成：背单词" }));
    expect(screen.getByText("你已经开始了，小猫在陪着你。")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "完成：慢跑" }));
    expect(screen.getByText("今天已经足够，和小猫一起休息吧。")).toBeInTheDocument();
  });
});
