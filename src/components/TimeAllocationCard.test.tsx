import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppStateProvider } from "../app/AppStateProvider";
import { createInitialState } from "../domain/defaults";
import type { AppState } from "../domain/types";
import type { AppRepository } from "../storage/repository";
import { allocationPalette, TimeAllocationCard } from "./TimeAllocationCard";

class MemoryRepository implements AppRepository {
  value: AppState;
  constructor(value: AppState) { this.value = value; }
  load() { return this.value; }
  save(state: AppState) { this.value = state; }
  clear() { return this.value; }
}

describe("TimeAllocationCard", () => {
  it("keeps today's tasks separate and merges a week's differently named tasks by goal", () => {
    const now = new Date(2026, 7, 18, 12);
    const state = createInitialState(now);
    state.goals = [{ id: "computer-goal", title: "通过计算机三级", deadline: "2026-12-01", createdAt: now.toISOString() }];
    state.scheduledTasks.push(
      { id: "computer", title: "数据库刷题", categoryId: "study", categoryNameSnapshot: "学习", goalId: "computer-goal", scheduledDate: "2026-08-18", status: "pending", actualMinutes: 20, createdAt: now.toISOString() },
      { id: "network", title: "网络技术复习", categoryId: "study", categoryNameSnapshot: "学习", goalId: "computer-goal", scheduledDate: "2026-08-17", status: "pending", actualMinutes: 30, createdAt: now.toISOString() },
      { id: "computer-history", title: "计算机三级错题", categoryId: "study", categoryNameSnapshot: "学习", scheduledDate: "2026-08-16", status: "pending", actualMinutes: 10, createdAt: now.toISOString() },
      { id: "cmc", title: "备战 CMC", categoryId: "study", categoryNameSnapshot: "学习", scheduledDate: "2026-08-18", status: "pending", actualMinutes: 40, createdAt: now.toISOString() },
      { id: "tidy", title: "整理桌面", categoryId: "life", categoryNameSnapshot: "生活", scheduledDate: "2026-08-15", status: "pending", actualMinutes: 5, createdAt: now.toISOString() }
    );
    state.fixedRecords.push({ id: "run", templateId: "run-template", titleSnapshot: "跑步", categoryId: "exercise", categoryNameSnapshot: "运动", date: "2026-08-17", actualMinutes: 60 });
    render(<AppStateProvider repository={new MemoryRepository(state)} now={() => now}><TimeAllocationCard now={now} /></AppStateProvider>);

    const cmc = screen.getByLabelText("备战 CMC 40 分钟，占 67%");
    const computer = screen.getByLabelText("数据库刷题 20 分钟，占 33%");
    expect(cmc).toBeVisible();
    expect(computer).toBeVisible();
    expect(cmc.style.getPropertyValue("--allocation-color")).not.toBe(computer.style.getPropertyValue("--allocation-color"));
    expect(allocationPalette).toContain(cmc.style.getPropertyValue("--allocation-color") as typeof allocationPalette[number]);
    expect(screen.getByLabelText("任务时间饼图，共 1 小时")).toBeVisible();
    expect(screen.getByLabelText("图例：备战 CMC，40 分钟")).toBeVisible();
    expect(screen.getByLabelText("图例：数据库刷题，20 分钟")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "近 7 天" }));
    expect(screen.getByLabelText("跑步 1 小时，占 36%")).toBeVisible();
    expect(screen.getByLabelText("通过计算机三级 1 小时，占 36%")).toHaveTextContent("合并 3 项任务");
    expect(screen.getByLabelText("通过计算机三级 1 小时，占 36%")).toHaveTextContent("智能归入 1 项");
    expect(screen.queryByText("数据库刷题")).not.toBeInTheDocument();
    expect(screen.queryByText("网络技术复习")).not.toBeInTheDocument();
    expect(screen.getByLabelText("任务时间饼图，共 2 小时 45 分")).toBeVisible();
    expect(screen.getByLabelText("图例：通过计算机三级，1 小时")).toBeVisible();
    const positions = [...document.querySelectorAll("[data-callout-position]")].map((node) => node.getAttribute("data-callout-position"));
    expect(positions).toContain("top");
    expect(positions).toContain("bottom");
    expect(positions).toContain("right");
    expect(screen.getByText("已按长期目标智能合并，并尝试识别过去未关联目标的记录。")).toBeVisible();
  });
});
