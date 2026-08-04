import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatMascot } from "./CatMascot";

const temporaryActionDuration = 1800;

function mockMatchMedia(matches = false) {
  const changeListeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (type === "change") changeListeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (type === "change") changeListeners.delete(listener);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  } as MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));

  return {
    mediaQueryList,
    change(matches: boolean) {
      Object.defineProperty(mediaQueryList, "matches", { configurable: true, value: matches });
      for (const listener of changeListeners) listener({ matches } as MediaQueryListEvent);
    }
  };
}

describe("CatMascot", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockMatchMedia();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reacts to a click, then returns to its base state", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CatMascot baseState="sleep" celebrationKey={0} />);
    const button = screen.getByRole("button", { name: "和小猫互动" });

    expect(button).toHaveAttribute("data-mascot-state", "sleep");

    await user.click(button);
    expect(button).toHaveAttribute("data-mascot-state", "react");

    act(() => vi.advanceTimersByTime(temporaryActionDuration));
    expect(button).toHaveAttribute("data-mascot-state", "sleep");
  });

  it("shows celebration when the celebration key changes", () => {
    const view = render(<CatMascot baseState="idle" celebrationKey={0} />);

    view.rerender(<CatMascot baseState="idle" celebrationKey={1} />);

    expect(screen.getByRole("button", { name: "和小猫互动" }))
      .toHaveAttribute("data-mascot-state", "celebrate");
  });

  it("does not replace a celebration when clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const view = render(<CatMascot baseState="idle" celebrationKey={0} />);
    view.rerender(<CatMascot baseState="idle" celebrationKey={1} />);
    const button = screen.getByRole("button", { name: "和小猫互动" });

    await user.click(button);

    expect(button).toHaveAttribute("data-mascot-state", "celebrate");
  });

  it("restarts celebration when a newer key arrives", () => {
    const view = render(<CatMascot baseState="idle" celebrationKey={0} />);
    view.rerender(<CatMascot baseState="idle" celebrationKey={1} />);

    act(() => vi.advanceTimersByTime(temporaryActionDuration - 1));
    view.rerender(<CatMascot baseState="idle" celebrationKey={2} />);
    act(() => vi.advanceTimersByTime(1));

    expect(screen.getByRole("button", { name: "和小猫互动" }))
      .toHaveAttribute("data-mascot-state", "celebrate");

    act(() => vi.advanceTimersByTime(temporaryActionDuration - 1));
    expect(screen.getByRole("button", { name: "和小猫互动" }))
      .toHaveAttribute("data-mascot-state", "idle");
  });

  it("uses the button's native keyboard activation", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CatMascot baseState="idle" celebrationKey={0} />);
    const button = screen.getByRole("button", { name: "和小猫互动" });

    button.focus();
    await user.keyboard("{Enter}");

    expect(button).toHaveAttribute("data-mascot-state", "react");
  });

  it("uses static PNGs for reduced motion and responds to preference changes", () => {
    const media = mockMatchMedia(true);
    render(<CatMascot baseState="sleep" celebrationKey={0} />);

    expect(screen.getByRole("presentation")).toHaveAttribute("src", "/mascot/sleep.png");

    act(() => media.change(false));
    expect(screen.getByRole("presentation")).toHaveAttribute("src", "/mascot/sleep.gif");
  });

  it("cleans up its reduced-motion listener on unmount", () => {
    const media = mockMatchMedia();
    const view = render(<CatMascot baseState="idle" celebrationKey={0} />);

    view.unmount();

    expect(media.mediaQueryList.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
