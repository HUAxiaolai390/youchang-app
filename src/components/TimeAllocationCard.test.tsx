import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppStateProvider } from "../app/AppStateProvider";
import { createInitialState } from "../domain/defaults";
import type { AppState } from "../domain/types";
import type { AppRepository } from "../storage/repository";
import { TimeAllocationCard } from "./TimeAllocationCard";

class MemoryRepository implements AppRepository {
  value: AppState;
  constructor(value: AppState) { this.value = value; }
  load() { return this.value; }
  save(state: AppState) { this.value = state; }
  clear() { return this.value; }
}

describe("TimeAllocationCard", () => {
  it("separates tasks in the same category and gives them different colors", () => {
    const now = new Date(2026, 7, 18, 12);
    const state = createInitialState(now);
    state.scheduledTasks.push(
      { id: "computer", title: "计算机三级", categoryId: "study", categoryNameSnapshot: "学习", scheduledDate: "2026-08-18", status: "pending", actualMinutes: 20, createdAt: now.toISOString() },
      { id: "cmc", title: "备战 CMC", categoryId: "study", categoryNameSnapshot: "学习", scheduledDate: "2026-08-18", status: "pending", actualMinutes: 40, createdAt: now.toISOString() }
    );
    state.fixedRecords.push({ id: "run", templateId: "run-template", titleSnapshot: "跑步", categoryId: "exercise", categoryNameSnapshot: "运动", date: "2026-08-17", actualMinutes: 60 });
    render(<AppStateProvider repository={new MemoryRepository(state)} now={() => now}><TimeAllocationCard now={now} /></AppStateProvider>);

    const cmc = screen.getByLabelText("备战 CMC 40 分钟，占 67%");
    const computer = screen.getByLabelText("计算机三级 20 分钟，占 33%");
    expect(cmc).toBeVisible();
    expect(computer).toBeVisible();
    expect(cmc.style.getPropertyValue("--allocation-color")).not.toBe(computer.style.getPropertyValue("--allocation-color"));
    expect(screen.getByLabelText("任务时间饼图，共 1 小时")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "近 7 天" }));
    expect(screen.getByLabelText("跑步 1 小时，占 50%")).toBeVisible();
    expect(screen.getByLabelText("任务时间饼图，共 2 小时")).toBeVisible();
  });
});
