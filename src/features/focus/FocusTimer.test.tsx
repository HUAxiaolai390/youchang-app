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
  render(
    <AppStateProvider repository={repository}>
      <FocusTimer onFocusComplete={onFocusComplete} />
    </AppStateProvider>
  );
  return { repository, onFocusComplete };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("FocusTimer", () => {
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
    expect(screen.getByRole("status")).toHaveTextContent("获得 5 点经验");
    expect(repository.value.focus).toMatchObject({
      focusMinutes: 1,
      breakMinutes: 2,
      completedSessions: 1,
      totalFocusMinutes: 1,
      experience: 5
    });
    expect(onFocusComplete).toHaveBeenCalledTimes(1);
  });

  it("pauses and resets without awarding experience", () => {
    vi.useFakeTimers();
    const { repository } = renderTimer();

    fireEvent.click(screen.getByRole("button", { name: "开始专注" }));
    act(() => vi.advanceTimersByTime(10_000));
    fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    expect(screen.getByRole("button", { name: "继续" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重置" }));

    expect(screen.getByLabelText("剩余 25:00")).toBeInTheDocument();
    expect(repository.value.focus?.completedSessions).toBe(0);
  });
});
