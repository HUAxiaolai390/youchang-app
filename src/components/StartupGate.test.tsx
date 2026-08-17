import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartupGate } from "./StartupGate";

const pwaMock = vi.hoisted(() => ({
  options: undefined as {
    onNeedRefresh?: () => void;
    onNeedReload?: () => void;
  } | undefined,
  updateServiceWorker: vi.fn(() => Promise.resolve())
}));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (options: typeof pwaMock.options) => {
    pwaMock.options = options;
    return {
      needRefresh: [false, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: pwaMock.updateServiceWorker
    };
  }
}));

describe("StartupGate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pwaMock.options = undefined;
    pwaMock.updateServiceWorker.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it("shows the branded cat progress screen before revealing the app", async () => {
    render(<StartupGate minimumVisibleMs={1000}><p>应用首页</p></StartupGate>);

    expect(screen.getByRole("heading", { name: "有常 APP" })).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "应用加载进度" })).toHaveAttribute("aria-valuenow", "8");
    expect(document.querySelector(".startup-progress__cat")).toHaveAttribute("src", "/mascot/idle/18.gif");
    expect(screen.queryByText("应用首页")).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(900);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(screen.getByText("应用首页")).toBeVisible();
    expect(screen.queryByRole("progressbar", { name: "应用加载进度" })).not.toBeInTheDocument();
  });

  it("applies an available update while the startup screen is open", async () => {
    render(<StartupGate><p>应用首页</p></StartupGate>);

    await act(async () => {
      pwaMock.options?.onNeedReload?.();
      await Promise.resolve();
    });

    expect(pwaMock.updateServiceWorker).toHaveBeenCalledWith(true);
    expect(screen.getByRole("status")).toHaveTextContent(/正在更新|准备完成/);
  });

  it("does not interrupt the user with another refresh after entering the app", async () => {
    render(<StartupGate minimumVisibleMs={0}><p>应用首页</p></StartupGate>);

    await act(async () => {
      vi.advanceTimersByTime(900);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(screen.getByText("应用首页")).toBeVisible();

    act(() => pwaMock.options?.onNeedRefresh?.());

    expect(pwaMock.updateServiceWorker).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "刷新应用" })).not.toBeInTheDocument();
  });
});
