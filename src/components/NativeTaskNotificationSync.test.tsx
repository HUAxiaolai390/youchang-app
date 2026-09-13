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
  isNativeAndroid: vi.fn(() => true),
  scheduleFocus: vi.fn(() => Promise.resolve(true)),
  sync: vi.fn(() => Promise.resolve())
}));

vi.mock("../native/task-notifications", () => ({
  buildNativeTaskNotifications: nativeMock.build,
  cancelFocusPhaseNotification: nativeMock.cancelFocus,
  consumeNativeReminderActions: nativeMock.consume,
  isNativeAndroid: nativeMock.isNativeAndroid,
  scheduleFocusPhaseNotification: nativeMock.scheduleFocus,
  syncNativeTaskNotifications: nativeMock.sync
}));

class MemoryRepository implements AppRepository {
  private value: AppState;

  constructor(value: AppState) {
    this.value = value;
  }

  load() {
    return this.value;
  }

  save(state: AppState) {
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

    expect(screen.getByRole("heading", { name: "今日安排" }).closest("section")).toHaveTextContent("通知改期任务");
    await waitFor(() => expect(nativeMock.consume).toHaveBeenCalledTimes(1));

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    await waitFor(() => expect(nativeMock.consume).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "今日安排" }).closest("section")).not.toHaveTextContent("通知改期任务");
    });
    expect(repository.load().scheduledTasks.find((task) => task.id === "notification-postpone")?.status).toBe("rescheduled");
  });
});
