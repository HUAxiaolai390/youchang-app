import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppStateProvider } from "../../app/AppStateProvider";
import { createInitialState } from "../../domain/defaults";
import type { AppState } from "../../domain/types";
import type { AppRepository } from "../../storage/repository";
import { GrowthPage } from "./GrowthPage";

class MemoryRepository implements AppRepository {
  value: AppState;

  constructor(value: AppState) {
    this.value = value;
  }

  load() { return this.value; }
  save(state: AppState) { this.value = state; }
  clear() { return this.value; }
}

function stateWithHistory(): AppState {
  const state = createInitialState(new Date(2026, 6, 31, 8));
  state.scheduledTasks = Array.from({ length: 18 }, (_, index) => ({
    id: `task-${index}`,
    title: `任务 ${index + 1}`,
    categoryId: "study",
    categoryNameSnapshot: "学习",
    scheduledDate: index < 2 ? "2026-07-31" as const : index === 2 ? "2026-07-30" as const : "2026-07-29" as const,
    status: "completed" as const,
    completedAt: "2026-07-31T00:00:00.000Z",
    createdAt: "2026-07-31T00:00:00.000Z"
  }));
  state.scheduledTasks.push({
    id: "unfinished",
    title: "未完成任务",
    categoryId: "study",
    categoryNameSnapshot: "学习",
    scheduledDate: "2026-07-31",
    status: "pending",
    createdAt: "2026-07-31T00:00:00.000Z"
  });
  return state;
}

function renderGrowth(state: AppState) {
  const repository = new MemoryRepository(state);
  render(
    <AppStateProvider repository={repository}>
      <GrowthPage />
    </AppStateProvider>
  );
  return repository;
}

describe("GrowthPage", () => {
  it("shows streak, seven days, and completed total", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 31, 8));

    renderGrowth(stateWithHistory());

    expect(screen.getByText("连续 3 天")).toBeInTheDocument();
    expect(screen.getByLabelText("7月31日，完成 2/3")).toBeInTheDocument();
    expect(screen.getByText("累计完成 18 项")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "坚持热力图" })).toBeInTheDocument();
    expect(screen.getByLabelText("近十二周任务完成热力图").children).toHaveLength(84);
    vi.useRealTimers();
  });

  it("uses a dash for days without data and exposes the status in its accessible name", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 31, 8));

    renderGrowth(createInitialState(new Date(2026, 6, 31, 8)));

    expect(screen.getByLabelText("7月31日，无数据")).toHaveTextContent("—");
    vi.useRealTimers();
  });

  it("shows twelve graded medals and lets unlocked medals be selected for the home page", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 31, 8));
    const state = stateWithHistory();
    renderGrowth(state);

    expect(screen.getByRole("heading", { name: "成就勋章" })).toBeInTheDocument();
    expect(screen.getByText("初见有常")).toBeInTheDocument();
    expect(screen.getAllByText("铜章")).toHaveLength(4);
    expect(screen.getAllByText("银章")).toHaveLength(4);
    expect(screen.getAllByText("金章")).toHaveLength(4);

    const firstTaskCard = screen.getByText("初见有常").closest("article")!;
    fireEvent.click(firstTaskCard.querySelector("button")!);
    expect(firstTaskCard).toHaveTextContent("首页展示");
    expect(firstTaskCard.querySelector("button")).toHaveTextContent("取消展示");
    vi.useRealTimers();
  });

  it("shows focus level, sessions, time, and experience", () => {
    const state = createInitialState(new Date(2026, 6, 31, 8));
    state.focus = {
      focusMinutes: 50,
      breakMinutes: 10,
      completedSessions: 3,
      totalFocusMinutes: 125,
      experience: 125
    };

    renderGrowth(state);

    expect(screen.getByText("等级 2")).toBeInTheDocument();
    expect(screen.getByText("3 次")).toBeInTheDocument();
    expect(screen.getByText("2 小时 5 分")).toBeInTheDocument();
    expect(screen.getByText("125 EXP")).toBeInTheDocument();
    expect(screen.getByLabelText("本级经验 25/100")).toBeInTheDocument();
  });

  it("switches between today's and seven-day time allocation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 31, 8));
    const state = createInitialState(new Date());
    state.scheduledTasks.push({
      id: "study", title: "阅读", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-07-31", status: "completed", createdAt: new Date().toISOString(), actualMinutes: 30
    });
    state.fixedRecords.push({
      id: "exercise", templateId: "exercise-template", titleSnapshot: "跑步", categoryId: "exercise",
      categoryNameSnapshot: "运动", date: "2026-07-30", actualMinutes: 60
    });
    state.timeEntries = [{
      id: "work", title: "查资料", categoryId: "work", categoryNameSnapshot: "工作",
      date: "2026-07-31", minutes: 15, createdAt: new Date().toISOString()
    }];

    renderGrowth(state);

    expect(screen.getByLabelText("学习 30 分钟，占 67%")).toBeVisible();
    expect(screen.getByLabelText("分类时间饼图，共 45 分钟")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "近 7 天" }));
    expect(screen.getByLabelText("运动 1 小时，占 57%")).toBeVisible();
    expect(screen.getByLabelText("分类时间饼图，共 1 小时 45 分")).toBeVisible();
    vi.useRealTimers();
  });

  it("summarizes and saves the current weekly review", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12, 9));
    const state = createInitialState(new Date());
    state.scheduledTasks.push({
      id: "done", title: "复习数学", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-11", status: "completed", createdAt: new Date().toISOString(),
      estimatedMinutes: 60, actualMinutes: 80
    }, {
      id: "pending", title: "跑步", categoryId: "exercise", categoryNameSnapshot: "运动",
      scheduledDate: "2026-08-12", status: "pending", createdAt: new Date().toISOString(),
      estimatedMinutes: 30
    });
    const repository = renderGrowth(state);

    const metrics = screen.getByLabelText("本周复盘摘要");
    expect(metrics).toHaveTextContent("1/2");
    expect(metrics).toHaveTextContent("50% 已完成");
    expect(metrics).toHaveTextContent("1 小时 30 分");
    expect(metrics).toHaveTextContent("学习");

    fireEvent.change(screen.getByLabelText("本周总结"), { target: { value: "数学复习完成得不错" } });
    fireEvent.change(screen.getByLabelText("下周调整"), { target: { value: "减少任务数量" } });
    fireEvent.click(screen.getByRole("button", { name: "保存本周复盘" }));

    expect(screen.getByRole("status")).toHaveTextContent("本周复盘已保存");
    expect(repository.value.weeklyReviews).toEqual([
      expect.objectContaining({
        weekStart: "2026-08-10",
        summary: "数学复习完成得不错",
        adjustment: "减少任务数量"
      })
    ]);
    vi.useRealTimers();
  });
});
