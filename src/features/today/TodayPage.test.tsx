import { act, fireEvent, render, screen, within } from "@testing-library/react";
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

function renderToday(state = createInitialState(new Date()), user = userEvent.setup()) {
  const repository = new MemoryRepository(state);

  render(<AppStateProvider repository={repository}><TodayPage /></AppStateProvider>);

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
  it("edits the display name from the home greeting", async () => {
    const state = createInitialState(new Date());
    state.settings.displayName = "小来";
    const { user, repository } = renderToday(state);

    await user.click(screen.getByRole("button", { name: /小来/ }));
    expect(screen.getByRole("dialog", { name: "修改我的称呼" })).toBeVisible();
    await user.clear(screen.getByLabelText("我的称呼"));
    await user.type(screen.getByLabelText("我的称呼"), "小伍");
    await user.click(screen.getByRole("button", { name: "保存称呼" }));

    expect(screen.getByRole("heading", { name: /小伍/ })).toBeVisible();
    expect(repository.load().settings.displayName).toBe("小伍");
  });

  it("uses the phone's local time for the greeting", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 5, 15));

    renderToday(createInitialState(new Date()));

    expect(screen.getByRole("heading", { name: /下午好/ })).toBeVisible();
  });

  it("groups fixed and temporary tasks in one collapsed today layout", () => {
    const state = createInitialState(new Date());
    addFixedRecord(state, "固定任务");
    addTask(state, "temporary", "临时任务", "study");

    renderToday(state);

    const taskRegion = screen.getByRole("region", { name: "今日任务" });
    expect(taskRegion).toBeVisible();
    expect(within(taskRegion).getByText("固定任务")).toBeVisible();
    expect(within(taskRegion).getByText("临时任务")).toBeVisible();
    expect(screen.getByRole("link", { name: /我的勋章.*查看全部/ })).toBeVisible();
    expect(screen.getByRole("region", { name: "待办清单" })).toHaveClass("today-todo");
    expect(screen.getByRole("button", { name: /待办清单.*2 项未完成/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /专注计时/ })).toHaveAttribute("aria-expanded", "false");
    expect(within(taskRegion).getByText("固定", { selector: ".task-source-tag" })).toBeVisible();
    expect(within(taskRegion).getByText("今日", { selector: ".task-source-tag" })).toBeVisible();
    expect(screen.getByText("时间分配", { selector: "summary" }).closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("时间分配", { selector: "summary" })).toHaveTextContent("时间分配");
    expect(screen.getByText("历史记录", { selector: "summary" })).toHaveTextContent("历史记录");
    expect(screen.queryByRole("heading", { name: "今日安排" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "管理" })).not.toBeInTheDocument();
    expect(screen.getByText("时间分配", { selector: "summary" }).querySelector("button")).toBeNull();
  });

  it("opens the pending-task list and jumps to the selected unfinished task", async () => {
    const state = createInitialState(new Date());
    addTask(state, "study-1", "背单词", "study");
    const { user } = renderToday(state);
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });

    const drawerToggle = screen.getByRole("button", { name: /专注计时/ });
    expect(drawerToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("region", { name: "待办清单" })).toHaveTextContent("1 项未完成");

    await user.click(screen.getByRole("button", { name: /待办清单.*1 项未完成/ }));
    await user.click(screen.getByRole("button", { name: /背单词.*查看任务/ }));

    const taskItem = screen.getByRole("checkbox", { name: "完成：背单词" }).closest("li");
    expect(drawerToggle).toHaveAttribute("aria-expanded", "false");
    expect(taskItem).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("offers to add the first task from the empty overview", async () => {
    const { user } = renderToday();

    expect(screen.getByRole("region", { name: "待办清单" })).toHaveTextContent("今天还没有安排");
    await user.click(screen.getByRole("button", { name: /待办清单.*今天还没有安排/ }));
    await user.click(screen.getByRole("button", { name: "添加第一项" }));

    expect(screen.getByRole("dialog", { name: "添加任务" })).toBeInTheDocument();
  });

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
    await user.click(screen.getByRole("radio", { name: "固定任务" }));
    await user.click(screen.getByRole("button", { name: "保存任务" }));

    expect(screen.getByText("晨间拉伸")).toBeInTheDocument();
    expect(repository.load().fixedRecords).toHaveLength(1);
    await user.click(screen.getByRole("checkbox", { name: "完成：晨间拉伸" }));
    expect(repository.load().fixedRecords[0]?.completedAt).toBeTruthy();
  });

  it("opens habit details from a fixed task without showing the action on temporary tasks", async () => {
    const state = createInitialState(new Date());
    addFixedRecord(state, "晨间拉伸", "exercise");
    addTask(state, "temporary", "临时复习", "study");
    const { user } = renderToday(state);

    expect(screen.queryByRole("button", { name: "习惯详情：临时复习" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "习惯详情：晨间拉伸" }));
    expect(screen.getByRole("dialog", { name: "晨间拉伸" })).toBeVisible();
    expect(screen.getByText("近 30 天记录")).toBeVisible();
  });

  it("lets the user fill and revise a task's actual time", async () => {
    const state = createInitialState(new Date());
    addTask(state, "study-1", "背单词", "study");
    const { user, repository } = renderToday(state);

    await user.click(screen.getByRole("button", { name: "记录用时：背单词" }));
    await user.clear(screen.getByLabelText("实际用时（分钟）"));
    await user.type(screen.getByLabelText("实际用时（分钟）"), "45");
    await user.click(screen.getByRole("button", { name: "保存用时" }));

    expect(screen.getByText(/实际 45 分钟/)).toBeVisible();
    expect(repository.load().scheduledTasks[0].actualMinutes).toBe(45);

    await user.click(screen.getByRole("button", { name: "记录用时：背单词" }));
    await user.clear(screen.getByLabelText("实际用时（分钟）"));
    await user.type(screen.getByLabelText("实际用时（分钟）"), "0");
    await user.click(screen.getByRole("button", { name: "保存用时" }));
    expect(screen.queryByText(/实际 45 分钟/)).not.toBeInTheDocument();
    expect(repository.load().scheduledTasks[0].actualMinutes).toBeUndefined();
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

  it("uses live category labels for current fixed and temporary tasks while preserving snapshots", async () => {
    const state = createInitialState(new Date());
    addFixedRecord(state, "晨间阅读", "other");
    state.fixedRecords[0]!.categoryNameSnapshot = "阅读";
    state.fixedTasks[0]!.categoryNameSnapshot = "阅读";
    addTask(state, "reading-1", "整理读书笔记", "other");
    state.scheduledTasks[0]!.categoryNameSnapshot = "阅读";
    const { user, repository } = renderToday(state);

    const fixedCategory = screen.getByText("晨间阅读").parentElement?.querySelector(":scope > span");
    const scheduledCategory = screen.getByText("整理读书笔记").parentElement?.querySelector(":scope > span");
    expect(fixedCategory).toHaveTextContent("其他");
    expect(scheduledCategory).toHaveTextContent("其他");
    expect(fixedCategory).not.toHaveTextContent("阅读");
    expect(scheduledCategory).not.toHaveTextContent("阅读");

    await user.click(screen.getByRole("button", { name: "只看其他" }));
    expect(screen.getByText("晨间阅读")).toBeVisible();
    expect(screen.getByText("整理读书笔记")).toBeVisible();
    expect(repository.load().fixedRecords[0]?.categoryNameSnapshot).toBe("阅读");
    expect(repository.load().scheduledTasks[0]?.categoryNameSnapshot).toBe("阅读");
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

  it("edits a completed scheduled task while keeping its completion date locked", async () => {
    const state = createInitialState(new Date());
    addTask(state, "completed-study", "考研高数", "study", "completed");
    const originalCompletedAt = state.scheduledTasks[0]!.completedAt;
    const { user, repository } = renderToday(state);

    await user.click(screen.getByRole("button", { name: "编辑：考研高数" }));
    expect(screen.getByLabelText("完成日期")).toBeDisabled();
    expect(screen.getByText(/不能改期/)).toBeVisible();
    await user.clear(screen.getByLabelText("任务名称"));
    await user.type(screen.getByLabelText("任务名称"), "考研高数复盘");
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(repository.load().scheduledTasks[0]).toMatchObject({
      title: "考研高数复盘",
      status: "completed",
      completedAt: originalCompletedAt
    });
  });

  it("puts a high-priority task first in the pending-task list", async () => {
    const state = createInitialState(new Date());
    addTask(state, "task-1", "收拾书桌", "life");
    addTask(state, "task-2", "准备考试", "study");
    state.scheduledTasks[0]!.priority = "low";
    state.scheduledTasks[1]!.priority = "high";
    const { user } = renderToday(state);

    await user.click(screen.getByRole("button", { name: /待办清单.*2 项未完成/ }));
    const taskButtons = screen.getAllByRole("button", { name: /查看任务/ });
    expect(taskButtons[0]).toHaveTextContent("准备考试");
    expect(taskButtons[1]).toHaveTextContent("收拾书桌");
  });

  it("expands task steps, toggles one, and updates progress", async () => {
    const state = createInitialState(new Date());
    addTask(state, "paper", "完成论文", "study");
    state.scheduledTasks[0]!.steps = [
      { id: "research", title: "查资料", completed: true },
      { id: "draft", title: "写正文", completed: false },
      { id: "edit", title: "修改", completed: false }
    ];
    const { user, repository } = renderToday(state);

    expect(screen.getByLabelText("完成论文步骤进度：1/3")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "展开步骤：完成论文" }));
    await user.click(screen.getByRole("checkbox", { name: "完成步骤：完成论文 - 写正文" }));

    expect(screen.getByLabelText("完成论文步骤进度：2/3")).toBeVisible();
    expect(repository.load().scheduledTasks[0]?.steps?.[1]?.completed).toBe(true);
  });

  it("moves a pending task to another date from the edit form", async () => {
    const state = createInitialState(new Date());
    addTask(state, "study-1", "整理课堂笔记", "study");
    const today = toDateKey(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = toDateKey(tomorrowDate);
    const { user, repository } = renderToday(state);

    await user.click(screen.getByRole("button", { name: "编辑：整理课堂笔记" }));
    expect(screen.getByLabelText("改到哪一天")).toHaveValue(today);
    await user.click(screen.getByRole("button", { name: "明天" }));
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(screen.queryByText("整理课堂笔记")).not.toBeInTheDocument();
    expect(repository.load().scheduledTasks[0]?.scheduledDate).toBe(tomorrow);
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

  it("idles for a pending task and celebrates only its persisted completion", async () => {
    vi.useFakeTimers();
    const state = createInitialState(new Date());
    addTask(state, "study-1", "背单词", "study");
    renderToday(state);

    expect(screen.getByRole("button", { name: "和小猫互动" }))
      .toHaveAttribute("data-mascot-state", "idle");

    fireEvent.click(screen.getByRole("checkbox", { name: "完成：背单词" }));
    expect(screen.getByRole("button", { name: "和小猫互动" }))
      .toHaveAttribute("data-mascot-state", "celebrate");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "完成：背单词" }));
    act(() => {
      vi.advanceTimersByTime(1079);
    });

    expect(screen.getByRole("button", { name: "和小猫互动" }))
      .toHaveAttribute("data-mascot-state", "celebrate");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("button", { name: "和小猫互动" }))
      .toHaveAttribute("data-mascot-state", "idle");
  });

  it("sleeps when today has no tasks and idles after adding a pending task", async () => {
    const { user } = renderToday();

    expect(screen.getByRole("button", { name: "和小猫互动" }))
      .toHaveAttribute("data-mascot-state", "sleep");

    await user.click(screen.getByRole("button", { name: "添加任务" }));
    await user.type(screen.getByLabelText("任务名称"), "背单词");
    await user.click(screen.getByRole("button", { name: "保存任务" }));

    expect(screen.getByRole("button", { name: "和小猫互动" }))
      .toHaveAttribute("data-mascot-state", "idle");
  });

  it("does not celebrate when completing a task fails to persist", async () => {
    const state = createInitialState(new Date());
    addTask(state, "study-1", "背单词", "study");
    const repository = new MemoryRepository(state);
    repository.saveError = new Error("保存失败，请立即导出备份");
    const user = userEvent.setup();
    render(<AppStateProvider repository={repository}><TodayPage /></AppStateProvider>);

    await user.click(screen.getByRole("checkbox", { name: "完成：背单词" }));

    expect(screen.getByRole("button", { name: "和小猫互动" }))
      .toHaveAttribute("data-mascot-state", "idle");
    expect(repository.load().scheduledTasks[0]).toMatchObject({ status: "pending" });
  });
});
