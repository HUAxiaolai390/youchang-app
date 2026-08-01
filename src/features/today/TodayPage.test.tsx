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
  saveError?: Error;

  constructor(value: AppState) {
    this.value = value;
  }

  load() {
    return this.value;
  }

  save(state: AppState) {
    if (this.saveError) throw this.saveError;
    this.value = state;
  }

  clear() {
    this.value = createInitialState(new Date());
    return this.value;
  }
}

function addFixedRecord(state: AppState, title = "晨间拉伸", categoryId = "study") {
  const category = state.categories.find((item) => item.id === categoryId)!;
  const templateId = "fixed-1";
  const today = toDateKey(new Date());
  state.fixedTasks.push({
    id: templateId,
    title,
    categoryId,
    categoryNameSnapshot: category.name,
    activeFrom: today,
    order: 0,
    createdAt: new Date().toISOString()
  });
  state.fixedRecords.push({
    id: "fixed-record-today",
    templateId,
    date: today,
    titleSnapshot: title,
    categoryId,
    categoryNameSnapshot: category.name
  });
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

  it("creates exactly one immediately completable record for a newly added fixed task", async () => {
    const { user, repository } = renderToday();

    await user.click(screen.getByRole("button", { name: "添加任务" }));
    await user.type(screen.getByLabelText("任务名称"), "晨间拉伸");
    await user.click(screen.getByRole("radio", { name: "每日固定" }));
    await user.click(screen.getByRole("button", { name: "保存任务" }));

    expect(screen.getByText("晨间拉伸")).toBeInTheDocument();
    expect(repository.load().fixedRecords).toHaveLength(1);
    await user.click(screen.getByRole("checkbox", { name: "完成：晨间拉伸" }));
    expect(repository.load().fixedRecords[0]?.completedAt).toBeTruthy();
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

  it("hides a deleted fixed task today while retaining its historical record", async () => {
    const state = createInitialState(new Date());
    addFixedRecord(state);
    const { user, repository } = renderToday(state);

    await user.click(screen.getByRole("button", { name: "删除：晨间拉伸" }));
    await user.click(screen.getByRole("button", { name: "删除" }));

    expect(screen.queryByText("晨间拉伸")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "完成：晨间拉伸" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "今日完成进度" })).toHaveTextContent("0 / 0");
    expect(repository.load().fixedRecords).toHaveLength(1);
  });

  it("keeps the task form open with a save error", async () => {
    const state = createInitialState(new Date());
    const repository = new MemoryRepository(state);
    repository.saveError = new Error("保存失败，请立即导出备份");
    const user = userEvent.setup();
    render(<AppStateProvider repository={repository}><TodayPage /></AppStateProvider>);

    await user.click(screen.getByRole("button", { name: "添加任务" }));
    await user.type(screen.getByLabelText("任务名称"), "背单词");
    await user.click(screen.getByRole("button", { name: "保存任务" }));

    expect(screen.getByRole("dialog", { name: "添加任务" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("保存失败，请立即导出备份");
  });

  it("updates the current fixed record without rewriting a past snapshot", async () => {
    const state = createInitialState(new Date());
    addFixedRecord(state, "晨间拉伸", "study");
    state.fixedRecords.push({
      id: "fixed-record-yesterday",
      templateId: "fixed-1",
      date: "2026-07-31",
      titleSnapshot: "晨间拉伸",
      categoryId: "study",
      categoryNameSnapshot: "学习"
    });
    const { user, repository } = renderToday(state);

    await user.click(screen.getByRole("button", { name: "编辑：晨间拉伸" }));
    await user.clear(screen.getByLabelText("任务名称"));
    await user.type(screen.getByLabelText("任务名称"), "晨间瑜伽");
    await user.click(screen.getByRole("radio", { name: "运动" }));
    await user.click(screen.getByRole("button", { name: "保存修改" }));
    await user.click(screen.getByRole("button", { name: "只看运动" }));

    expect(screen.getByText("晨间瑜伽")).toBeVisible();
    expect(repository.load().fixedRecords.find((record) => record.id === "fixed-record-yesterday")).toMatchObject({
      titleSnapshot: "晨间拉伸", categoryId: "study", categoryNameSnapshot: "学习"
    });
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
