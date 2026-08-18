import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppStateProvider } from "../../app/AppStateProvider";
import { createInitialState } from "../../domain/defaults";
import type { AppState } from "../../domain/types";
import type { AppRepository } from "../../storage/repository";
import { GoalSection } from "./GoalSection";

class MemoryRepository implements AppRepository {
  value: AppState;
  constructor(value: AppState) { this.value = value; }
  load() { return this.value; }
  save(state: AppState) { this.value = state; }
  clear() { return this.value; }
}

function renderGoals(state: AppState, now = new Date(2026, 7, 11, 9)) {
  const repository = new MemoryRepository(state);
  const user = userEvent.setup();
  render(<AppStateProvider repository={repository} now={() => now}><GoalSection now={now} /></AppStateProvider>);
  return { repository, user };
}

describe("GoalSection", () => {
  it("creates a long-term goal", async () => {
    const state = createInitialState(new Date(2026, 7, 11, 9));
    const { repository, user } = renderGoals(state);

    await user.click(screen.getByRole("button", { name: "新增目标" }));
    await user.type(screen.getByLabelText("目标名称"), "通过英语六级");
    await user.clear(screen.getByLabelText("目标截止日期"));
    await user.type(screen.getByLabelText("目标截止日期"), "2026-12-20");
    await user.click(screen.getByRole("button", { name: "创建目标" }));

    expect(repository.value.goals).toEqual([
      expect.objectContaining({ title: "通过英语六级", deadline: "2026-12-20" })
    ]);
    expect(screen.getByRole("heading", { name: "通过英语六级" })).toBeVisible();
  });

  it("shows linked task progress and invested time", () => {
    const state = createInitialState(new Date(2026, 7, 11, 9));
    state.goals = [{ id: "exam", title: "通过英语六级", deadline: "2026-12-20", createdAt: "2026-08-11T01:00:00.000Z" }];
    state.scheduledTasks.push({
      id: "listening", title: "英语听力", categoryId: "study", categoryNameSnapshot: "学习",
      goalId: "exam", scheduledDate: "2026-08-11", status: "completed", actualMinutes: 45,
      completedAt: "2026-08-11T02:00:00.000Z", createdAt: "2026-08-11T01:00:00.000Z"
    }, {
      id: "words", title: "背单词", categoryId: "study", categoryNameSnapshot: "学习",
      goalId: "exam", scheduledDate: "2026-08-11", status: "pending", actualMinutes: 15,
      createdAt: "2026-08-11T01:00:00.000Z"
    });

    renderGoals(state);

    expect(screen.getByLabelText("通过英语六级目标投入记录")).toHaveTextContent("已完成行动");
    expect(screen.getByLabelText("通过英语六级目标投入记录")).toHaveTextContent("最近推进");
    expect(screen.getByText("1 项")).toBeVisible();
    expect(screen.getByText("今天")).toBeVisible();
    expect(screen.getByText("1 小时")).toBeVisible();
  });
});
