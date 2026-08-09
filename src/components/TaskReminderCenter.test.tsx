import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppStateProvider } from "../app/AppStateProvider";
import { createInitialState } from "../domain/defaults";
import type { AppState } from "../domain/types";
import type { AppRepository } from "../storage/repository";
import { TaskReminderCenter } from "./TaskReminderCenter";

class InMemoryRepository implements AppRepository {
  state: AppState;
  constructor(state: AppState) { this.state = state; }
  load() { return this.state; }
  save(state: AppState) { this.state = state; }
  clear() { return this.state; }
}

describe("TaskReminderCenter", () => {
  it("shows a due reminder, persists it once, and can dismiss it", async () => {
    const now = new Date(2026, 7, 9, 8, 50);
    const state = createInitialState(now);
    state.scheduledTasks.push({
      id: "task-1", title: "英语听力", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "pending", createdAt: now.toISOString(),
      plannedStartTime: "09:00", reminderMinutesBefore: 10
    });
    const repository = new InMemoryRepository(state);
    const user = userEvent.setup();

    render(
      <AppStateProvider repository={repository}>
        <TaskReminderCenter now={() => now} />
      </AppStateProvider>
    );

    const reminder = await screen.findByRole("alert", { name: "任务提醒" });
    expect(reminder).toHaveTextContent("英语听力");
    expect(reminder).toHaveTextContent("还有 10 分钟开始");
    expect(repository.state.scheduledTasks[0].reminderSentAt).toBe(now.toISOString());

    await user.click(screen.getByRole("button", { name: "知道了" }));
    expect(screen.queryByRole("alert", { name: "任务提醒" })).not.toBeInTheDocument();
  });
});
