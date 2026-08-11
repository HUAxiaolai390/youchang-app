import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppStateProvider } from "../../app/AppStateProvider";
import { createInitialState } from "../../domain/defaults";
import type { AppState } from "../../domain/types";
import type { AppRepository } from "../../storage/repository";
import { HabitDetailDialog } from "./HabitDetailDialog";

class MemoryRepository implements AppRepository {
  private state: AppState;
  constructor(state: AppState) { this.state = state; }
  load() { return this.state; }
  save(state: AppState) { this.state = state; }
  clear() { return this.state; }
}

describe("HabitDetailDialog", () => {
  it("shows an individual habit's streak, completion rate, and calendar", async () => {
    const now = new Date(2026, 7, 11, 9);
    const state = createInitialState(now);
    state.fixedTasks.push({
      id: "habit", title: "英语单词", categoryId: "study", categoryNameSnapshot: "学习",
      activeFrom: "2026-08-09", order: 0, createdAt: now.toISOString()
    });
    for (const date of ["2026-08-09", "2026-08-10", "2026-08-11"] as const) {
      state.fixedRecords.push({
        id: date, templateId: "habit", date, titleSnapshot: "英语单词", categoryId: "study",
        categoryNameSnapshot: "学习", completedAt: date === "2026-08-10" ? undefined : now.toISOString(),
        actualMinutes: date === "2026-08-11" ? 25 : undefined
      });
    }
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AppStateProvider repository={new MemoryRepository(state)}>
      <HabitDetailDialog templateId="habit" now={now} onClose={onClose} />
    </AppStateProvider>);

    expect(screen.getByRole("dialog", { name: "英语单词" })).toBeVisible();
    expect(screen.getByLabelText("英语单词习惯统计")).toHaveTextContent("当前连续1 次");
    expect(screen.getByLabelText("英语单词习惯统计")).toHaveTextContent("最长连续1 次");
    expect(screen.getByText("67", { selector: "strong" })).toBeVisible();
    expect(screen.getByLabelText("8月11日，已完成，实际 25 分钟")).toBeVisible();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
