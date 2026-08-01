import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppStateProvider } from "../../app/AppStateProvider";
import { createInitialState } from "../../domain/defaults";
import type { AppState } from "../../domain/types";
import type { AppRepository } from "../../storage/repository";
import { GrowthPage } from "./GrowthPage";

class MemoryRepository implements AppRepository {
  private readonly value: AppState;

  constructor(value: AppState) {
    this.value = value;
  }

  load() { return this.value; }
  save() {}
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
  render(
    <AppStateProvider repository={new MemoryRepository(state)}>
      <GrowthPage />
    </AppStateProvider>
  );
}

describe("GrowthPage", () => {
  it("shows streak, seven days, and completed total", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 31, 8));

    renderGrowth(stateWithHistory());

    expect(screen.getByText("连续 3 天")).toBeInTheDocument();
    expect(screen.getByLabelText("7月31日，完成 2/3")).toBeInTheDocument();
    expect(screen.getByText("累计完成 18 项")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("uses a dash for days without data and exposes the status in its accessible name", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 31, 8));

    renderGrowth(createInitialState(new Date(2026, 6, 31, 8)));

    expect(screen.getByLabelText("7月31日，无数据")).toHaveTextContent("—");
    vi.useRealTimers();
  });
});
