import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppStateProvider } from "../../app/AppStateProvider";
import { createInitialState } from "../../domain/defaults";
import type { AppState } from "../../domain/types";
import type { AppRepository } from "../../storage/repository";
import { FocusTimer } from "./FocusTimer";

class MemoryRepository implements AppRepository {
  value: AppState;
  constructor(value: AppState) { this.value = value; }
  load() { return this.value; }
  save(state: AppState) { this.value = state; }
  clear() {
    this.value = createInitialState(new Date());
    return this.value;
  }
}

function renderTimer(state = createInitialState(new Date())) {
  const repository = new MemoryRepository(state);
  const onFocusComplete = vi.fn();
  const onRunningChange = vi.fn();
  const view = render(
    <AppStateProvider repository={repository}>
      <FocusTimer onFocusComplete={onFocusComplete} onRunningChange={onRunningChange} />
    </AppStateProvider>
  );
  return { repository, onFocusComplete, onRunningChange, view };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("FocusTimer", () => {
  it("reports when timing starts and stops", () => {
    const { onRunningChange } = renderTimer();
    onRunningChange.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "开始专注" }));
    expect(onRunningChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    expect(onRunningChange).toHaveBeenLastCalledWith(false);
  });

  it("switches between the recommended 25/5 and 50/10 presets", () => {
    const { repository } = renderTimer();

    const longPreset = screen.getByRole("button", { name: "50 / 10" });
    fireEvent.click(longPreset);

    expect(longPreset).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("剩余 50:00")).toBeInTheDocument();
    expect(repository.value.focus).toMatchObject({ focusMinutes: 50, breakMinutes: 10 });
  });

  it("accepts a custom duration and records a completed session", () => {
    vi.useFakeTimers();
    const { repository, onFocusComplete } = renderTimer();

    fireEvent.click(screen.getByText("自定义时长"));
    fireEvent.change(screen.getByLabelText("专注分钟"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("休息分钟"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "应用设置" }));
    fireEvent.click(screen.getByRole("button", { name: "开始专注" }));

    act(() => vi.advanceTimersByTime(60_000));

    expect(screen.getByRole("heading", { name: "休息时间" })).toBeInTheDocument();
    expect(screen.getByLabelText("剩余 02:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始休息" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("获得 5 点经验");
    expect(repository.value.focus).toMatchObject({
      focusMinutes: 1,
      breakMinutes: 2,
      completedSessions: 1,
      totalFocusMinutes: 1,
      experience: 5
    });
    expect(onFocusComplete).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "开始休息" }));
    act(() => vi.advanceTimersByTime(1_000));
    fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    expect(screen.getByRole("button", { name: "继续休息" })).toBeInTheDocument();
  });

  it("pauses and resets without awarding experience", () => {
    vi.useFakeTimers();
    const { repository } = renderTimer();

    fireEvent.click(screen.getByRole("button", { name: "开始专注" }));
    act(() => vi.advanceTimersByTime(10_000));
    fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    expect(screen.getByRole("button", { name: "继续专注" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重置" }));

    expect(screen.getByLabelText("剩余 25:00")).toBeInTheDocument();
    expect(repository.value.focus?.completedSessions).toBe(0);
  });

  it("uses the stopwatch and adds its result to a selected task", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 5, 9));
    const state = createInitialState(new Date());
    state.scheduledTasks.push({
      id: "reading", title: "阅读", categoryId: "study", categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-05", status: "pending", createdAt: new Date().toISOString()
    });
    const { repository, onFocusComplete } = renderTimer(state);

    fireEvent.click(screen.getByRole("button", { name: "正计时" }));
    fireEvent.change(screen.getByLabelText("记录到"), { target: { value: "scheduled:reading" } });
    fireEvent.click(screen.getByRole("button", { name: "开始计时" }));
    act(() => vi.advanceTimersByTime(60_000));
    fireEvent.click(screen.getByRole("button", { name: "完成并记录" }));

    expect(repository.value.scheduledTasks[0].actualMinutes).toBe(1);
    expect(screen.getByRole("status")).toHaveTextContent("1 分钟已经记入时间分配");
    expect(screen.getByLabelText("已计时 00:00")).toBeInTheDocument();
    expect(onFocusComplete).toHaveBeenCalledTimes(1);
  });

  it("records a stopwatch without a task into a category", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 5, 9));
    const { repository } = renderTimer(createInitialState(new Date()));

    fireEvent.click(screen.getByRole("button", { name: "正计时" }));
    fireEvent.change(screen.getByLabelText("记录名称"), { target: { value: "查资料" } });
    fireEvent.change(screen.getByLabelText("分类"), { target: { value: "work" } });
    fireEvent.click(screen.getByRole("button", { name: "开始计时" }));
    act(() => vi.advanceTimersByTime(1_000));
    fireEvent.click(screen.getByRole("button", { name: "完成并记录" }));

    expect(repository.value.timeEntries).toEqual([
      expect.objectContaining({ title: "查资料", categoryId: "work", date: "2026-08-05", minutes: 1 })
    ]);
  });

  it("continues a countdown after the app is closed and reopened", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 5, 9));
    const first = renderTimer(createInitialState(new Date()));

    fireEvent.click(screen.getByText("自定义时长"));
    fireEvent.change(screen.getByLabelText("专注分钟"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "应用设置" }));
    fireEvent.click(screen.getByRole("button", { name: "开始专注" }));
    act(() => vi.advanceTimersByTime(30_000));
    first.view.unmount();

    act(() => vi.advanceTimersByTime(45_000));
    render(
      <AppStateProvider repository={first.repository}>
        <FocusTimer onFocusComplete={vi.fn()} />
      </AppStateProvider>
    );

    expect(screen.getByLabelText("剩余 00:45")).toBeInTheDocument();
    expect(screen.getByText("进行中")).toBeInTheDocument();
  });

  it("settles an elapsed focus countdown only once after reopening", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 5, 9));
    const first = renderTimer(createInitialState(new Date()));

    fireEvent.click(screen.getByText("自定义时长"));
    fireEvent.change(screen.getByLabelText("专注分钟"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "应用设置" }));
    fireEvent.click(screen.getByRole("button", { name: "开始专注" }));
    first.view.unmount();
    act(() => vi.advanceTimersByTime(70_000));

    const reopened = render(
      <AppStateProvider repository={first.repository}>
        <FocusTimer onFocusComplete={vi.fn()} />
      </AppStateProvider>
    );
    expect(screen.getByRole("heading", { name: "休息时间" })).toBeInTheDocument();
    expect(first.repository.value.focus?.completedSessions).toBe(1);

    reopened.unmount();
    render(
      <AppStateProvider repository={first.repository}>
        <FocusTimer onFocusComplete={vi.fn()} />
      </AppStateProvider>
    );
    expect(first.repository.value.focus?.completedSessions).toBe(1);
  });

  it("continues a stopwatch after the app is closed and reopened", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 5, 9));
    const first = renderTimer(createInitialState(new Date()));

    fireEvent.click(screen.getByRole("button", { name: "正计时" }));
    fireEvent.change(screen.getByLabelText("记录名称"), { target: { value: "整理笔记" } });
    fireEvent.click(screen.getByRole("button", { name: "开始计时" }));
    act(() => vi.advanceTimersByTime(30_000));
    first.view.unmount();
    act(() => vi.advanceTimersByTime(45_000));

    render(
      <AppStateProvider repository={first.repository}>
        <FocusTimer onFocusComplete={vi.fn()} />
      </AppStateProvider>
    );
    expect(screen.getByRole("heading", { name: "正计时" })).toBeInTheDocument();
    expect(screen.getByLabelText("已计时 01:15")).toBeInTheDocument();
    expect(screen.getByDisplayValue("整理笔记")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "暂停计时" }));
    expect(first.repository.value.focus?.timer?.stopwatch).toMatchObject({ elapsedSeconds: 75 });
    expect(first.repository.value.focus?.timer?.stopwatch.startedAt).toBeUndefined();
  });
});
