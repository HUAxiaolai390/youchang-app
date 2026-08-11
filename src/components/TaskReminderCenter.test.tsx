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

    await user.click(screen.getByRole("button", { name: "关闭提醒" }));
    expect(screen.queryByRole("alert", { name: "任务提醒" })).not.toBeInTheDocument();
  });

  it("completes a task directly from its reminder", async () => {
    const now = new Date(2026, 7, 9, 9);
    const state = createInitialState(now);
    state.scheduledTasks.push({
      id: "task-1", title: "英语听力", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "pending", createdAt: now.toISOString(),
      plannedStartTime: "09:00", reminderMinutesBefore: 0
    });
    const repository = new InMemoryRepository(state);
    const user = userEvent.setup();

    render(
      <AppStateProvider repository={repository} now={() => now}>
        <TaskReminderCenter now={() => now} />
      </AppStateProvider>
    );
    await screen.findByRole("alert", { name: "任务提醒" });
    await user.click(screen.getByRole("button", { name: "完成" }));

    expect(repository.state.scheduledTasks[0]).toMatchObject({ status: "completed" });
    expect(screen.queryByRole("alert", { name: "任务提醒" })).not.toBeInTheDocument();
  });

  it("snoozes a reminder for the selected number of minutes", async () => {
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
      <AppStateProvider repository={repository} now={() => now}>
        <TaskReminderCenter now={() => now} />
      </AppStateProvider>
    );
    await screen.findByRole("alert", { name: "任务提醒" });
    await user.selectOptions(screen.getByRole("combobox", { name: "稍后提醒时间" }), "30");
    await user.click(screen.getByRole("button", { name: "稍后提醒" }));

    expect(repository.state.scheduledTasks[0].reminderSentAt).toBeUndefined();
    expect(repository.state.scheduledTasks[0].reminderSnoozedUntil).toBe("2026-08-09T01:20:00.000Z");
  });

  it("moves a scheduled task to tomorrow from its reminder", async () => {
    const now = new Date(2026, 7, 9, 9);
    const state = createInitialState(now);
    state.scheduledTasks.push({
      id: "task-1", title: "英语听力", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-09", status: "pending", createdAt: now.toISOString(),
      plannedStartTime: "09:00", reminderMinutesBefore: 0
    });
    const repository = new InMemoryRepository(state);
    const user = userEvent.setup();

    render(
      <AppStateProvider repository={repository} now={() => now}>
        <TaskReminderCenter now={() => now} />
      </AppStateProvider>
    );
    await screen.findByRole("alert", { name: "任务提醒" });
    await user.click(screen.getByRole("button", { name: "改到明天" }));

    expect(repository.state.scheduledTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "task-1", status: "rescheduled" }),
      expect.objectContaining({ scheduledDate: "2026-08-10", status: "pending", sourceTaskId: "task-1" })
    ]));
    expect(repository.state.reschedules).toHaveLength(1);
  });

  it("skips only today's occurrence of a fixed task", async () => {
    const now = new Date(2026, 7, 9, 9);
    const state = createInitialState(now);
    state.fixedTasks.push({
      id: "fixed-1", title: "晨间拉伸", categoryId: "exercise", categoryNameSnapshot: "运动",
      activeFrom: "2026-08-09", order: 0, createdAt: now.toISOString()
    });
    state.fixedRecords.push({
      id: "record-1", templateId: "fixed-1", date: "2026-08-09", titleSnapshot: "晨间拉伸",
      categoryId: "exercise", categoryNameSnapshot: "运动", plannedStartTime: "09:00", reminderMinutesBefore: 0
    });
    const repository = new InMemoryRepository(state);
    const user = userEvent.setup();

    render(
      <AppStateProvider repository={repository} now={() => now}>
        <TaskReminderCenter now={() => now} />
      </AppStateProvider>
    );
    await screen.findByRole("alert", { name: "任务提醒" });
    await user.click(screen.getByRole("button", { name: "今天跳过" }));

    expect(repository.state.fixedRecords).toEqual([]);
    expect(repository.state.fixedTasks[0].skippedDates).toEqual(["2026-08-09"]);
  });
});
