import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppStateProvider } from "../app/AppStateProvider";
import { createInitialState } from "../domain/defaults";
import type { AppState } from "../domain/types";
import type { AppRepository } from "../storage/repository";
import { TaskReminderOverview } from "./TaskReminderOverview";

class MemoryRepository implements AppRepository {
  state: AppState;
  constructor(state: AppState) { this.state = state; }
  load() { return this.state; }
  save(state: AppState) { this.state = state; }
  clear() { return this.state; }
}

function addReminderTask(state: AppState, id: string, title: string, time: `${number}:${number}`) {
  state.scheduledTasks.push({
    id,
    title,
    categoryId: "study",
    categoryNameSnapshot: "学习",
    scheduledDate: "2026-08-09",
    status: "pending",
    createdAt: "2026-08-09T00:00:00.000Z",
    plannedStartTime: time,
    reminderMinutesBefore: 0
  });
}

describe("TaskReminderOverview", () => {
  it("summarizes reminders and completes a missed task", async () => {
    const now = new Date(2026, 7, 9, 9);
    const state = createInitialState(now);
    addReminderTask(state, "missed", "晨间阅读", "08:00");
    addReminderTask(state, "upcoming", "英语听力", "10:00");
    const repository = new MemoryRepository(state);
    const user = userEvent.setup();

    render(
      <AppStateProvider repository={repository}>
        <TaskReminderOverview now={() => now} tickMilliseconds={60_000} />
      </AppStateProvider>
    );

    const center = screen.getByRole("region", { name: "提醒中心" });
    expect(center).toHaveTextContent("2 项需要留意");
    expect(center).toHaveTextContent("1 错过");
    expect(center).toHaveTextContent("1 即将");

    await user.click(screen.getByRole("button", { name: /提醒中心/ }));
    expect(screen.getByRole("heading", { name: "已错过" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "即将开始" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "完成提醒任务：晨间阅读" }));

    expect(repository.state.scheduledTasks.find((task) => task.id === "missed")?.status).toBe("completed");
    expect(center).not.toHaveTextContent("晨间阅读");
  });

  it("postpones a missed reminder for ten minutes", async () => {
    const now = new Date(2026, 7, 9, 9);
    const state = createInitialState(now);
    addReminderTask(state, "missed", "背单词", "08:00");
    const repository = new MemoryRepository(state);
    const user = userEvent.setup();

    render(
      <AppStateProvider repository={repository}>
        <TaskReminderOverview now={() => now} tickMilliseconds={60_000} />
      </AppStateProvider>
    );

    await user.click(screen.getByRole("button", { name: /提醒中心/ }));
    await user.click(screen.getByRole("button", { name: "10 分钟后提醒：背单词" }));

    expect(repository.state.scheduledTasks[0].reminderSnoozedUntil).toBe("2026-08-09T01:10:00.000Z");
    expect(screen.getByRole("heading", { name: "已推迟" })).toBeVisible();
  });
});
