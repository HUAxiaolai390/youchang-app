import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppStateProvider } from "../app/AppStateProvider";
import { createInitialState } from "../domain/defaults";
import type { AppState } from "../domain/types";
import type { AppRepository } from "../storage/repository";
import { TodayPage } from "../features/today/TodayPage";
import { NativeTaskNotificationSync } from "./NativeTaskNotificationSync";

const nativeMock = vi.hoisted(() => ({
  build: vi.fn(() => []),
  cancelFocus: vi.fn(() => Promise.resolve()),
  consume: vi.fn(),
  read: vi.fn(),
  acknowledge: vi.fn(),
  isNativeAndroid: vi.fn(() => true),
  scheduleFocus: vi.fn(() => Promise.resolve(true)),
  sync: vi.fn(() => Promise.resolve())
}));

vi.mock("../native/task-notifications", () => ({
  buildNativeTaskNotifications: nativeMock.build,
  cancelFocusPhaseNotification: nativeMock.cancelFocus,
  consumeNativeReminderActions: nativeMock.consume,
  readNativeReminderActions: nativeMock.read,
  acknowledgeNativeReminderActions: nativeMock.acknowledge,
  isNativeAndroid: nativeMock.isNativeAndroid,
  scheduleFocusPhaseNotification: nativeMock.scheduleFocus,
  syncNativeTaskNotifications: nativeMock.sync
}));

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

describe("NativeTaskNotificationSync", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    nativeMock.build.mockClear();
    nativeMock.cancelFocus.mockClear();
    nativeMock.consume.mockReset();
    nativeMock.consume.mockResolvedValue([]);
    nativeMock.read.mockReset().mockImplementation(() => nativeMock.consume());
    nativeMock.acknowledge.mockReset().mockResolvedValue(undefined);
    nativeMock.isNativeAndroid.mockReturnValue(true);
    nativeMock.scheduleFocus.mockClear();
    nativeMock.sync.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it("applies a notification postpone action that arrives while the app stays open", async () => {
    const now = new Date(2026, 7, 13, 10);
    vi.setSystemTime(now);
    const state = createInitialState(now);
    state.scheduledTasks.push({
      id: "notification-postpone",
      title: "通知改期任务",
      categoryId: "study",
      categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-13",
      status: "pending",
      createdAt: now.toISOString()
    });
    const repository = new MemoryRepository(state);
    nativeMock.consume
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "postpone-event",
        action: "postpone",
        kind: "scheduled",
        taskId: "notification-postpone",
        date: "2026-08-13",
        at: now.getTime()
      }]);

    render(
      <AppStateProvider repository={repository} now={() => now}>
        <NativeTaskNotificationSync />
        <TodayPage />
      </AppStateProvider>
    );

    expect(screen.getByRole("heading", { name: "今日任务" }).closest("section")).toHaveTextContent("通知改期任务");
    await waitFor(() => expect(nativeMock.consume).toHaveBeenCalledTimes(1));

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    await waitFor(() => expect(nativeMock.consume).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "今日任务" }).closest("section")).not.toHaveTextContent("通知改期任务");
    });
    expect(repository.load().scheduledTasks.find((task) => task.id === "notification-postpone")?.status).toBe("rescheduled");
  });

  it("keeps a failed save in the native queue and applies it after the app is reopened", async () => {
    const now = new Date(2026, 8, 14, 8);
    const state = createInitialState(now);
    state.scheduledTasks.push({ id: "review", title: "复习", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-09-14", status: "pending", createdAt: now.toISOString() });
    const repository = new MemoryRepository(state);
    repository.saveError = new Error("保存失败，请立即导出备份");
    const queue = [{ id: "event-1", action: "postpone", kind: "scheduled", taskId: "review", date: "2026-09-14", at: now.getTime() }];
    nativeMock.consume.mockImplementation(async () => queue.splice(0));
    nativeMock.read.mockImplementation(async () => [...queue]);
    nativeMock.acknowledge.mockImplementation(async (ids: string[]) => {
      for (let index = queue.length - 1; index >= 0; index--) {
        if (ids.includes(queue[index].id)) queue.splice(index, 1);
      }
    });
    const view = render(<AppStateProvider repository={repository} now={() => now}><NativeTaskNotificationSync /></AppStateProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(repository.load().scheduledTasks[0].status).toBe("pending");
    expect(queue).toHaveLength(1);
    view.unmount();
    repository.saveError = undefined;

    render(<AppStateProvider repository={repository} now={() => now}><NativeTaskNotificationSync /></AppStateProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(queue).toHaveLength(0);
    expect(repository.load().scheduledTasks).toHaveLength(2);
    expect(repository.load().scheduledTasks[1]).toMatchObject({ status: "pending", scheduledDate: "2026-09-15" });
  });

  it("waits for pending actions before replacing alarms from the saved task list", async () => {
    let finishRead!: (actions: []) => void;
    const pending = new Promise<[]>((resolve) => { finishRead = resolve; });
    nativeMock.consume.mockReturnValue(pending);
    nativeMock.read.mockReturnValue(pending);
    const repository = new MemoryRepository(createInitialState(new Date()));
    render(<AppStateProvider repository={repository}><NativeTaskNotificationSync /></AppStateProvider>);
    expect(nativeMock.sync).not.toHaveBeenCalled();
    await act(async () => { finishRead([]); await Promise.resolve(); });
    expect(nativeMock.sync).toHaveBeenCalled();
  });
});
