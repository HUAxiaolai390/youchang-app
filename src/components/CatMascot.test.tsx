import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatMascot } from "./CatMascot";

const reactDuration = 1120;
const celebrateDuration = 2080;

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
    vi.useFakeTimers();
    mockMatchMedia();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("plays one complete reaction loop, then returns to its base state", () => {
    render(<CatMascot baseState="sleep" celebrationKey={0} />);
    const button = screen.getByRole("button", { name: "和小猫互动" });

    expect(button).toHaveAttribute("data-mascot-state", "sleep");

    fireEvent.click(button);
    expect(button).toHaveAttribute("data-mascot-state", "react");

    act(() => vi.advanceTimersByTime(reactDuration - 1));
    expect(button).toHaveAttribute("data-mascot-state", "react");

    act(() => vi.advanceTimersByTime(1));
    expect(button).toHaveAttribute("data-mascot-state", "sleep");
  });

  it("plays one complete celebration loop, then returns to its base state", () => {
    const view = render(<CatMascot baseState="idle" celebrationKey={0} />);

    view.rerender(<CatMascot baseState="idle" celebrationKey={1} />);

    const button = screen.getByRole("button", { name: "和小猫互动" });
    expect(button).toHaveAttribute("data-mascot-state", "celebrate");

    act(() => vi.advanceTimersByTime(celebrateDuration - 1));
    expect(button).toHaveAttribute("data-mascot-state", "celebrate");

    act(() => vi.advanceTimersByTime(1));
    expect(button).toHaveAttribute("data-mascot-state", "idle");
  });

  it("does not replace a celebration when clicked", () => {
    const view = render(<CatMascot baseState="idle" celebrationKey={0} />);
    view.rerender(<CatMascot baseState="idle" celebrationKey={1} />);
    const button = screen.getByRole("button", { name: "和小猫互动" });

    fireEvent.click(button);

    expect(button).toHaveAttribute("data-mascot-state", "celebrate");
  });

  it("restarts celebration when a newer key arrives", () => {
    const view = render(<CatMascot baseState="idle" celebrationKey={0} />);
    view.rerender(<CatMascot baseState="idle" celebrationKey={1} />);

    act(() => vi.advanceTimersByTime(celebrateDuration - 1));
    view.rerender(<CatMascot baseState="idle" celebrationKey={2} />);
    act(() => vi.advanceTimersByTime(1));

    expect(screen.getByRole("button", { name: "和小猫互动" }))
      .toHaveAttribute("data-mascot-state", "celebrate");

    act(() => vi.advanceTimersByTime(celebrateDuration - 2));
    expect(screen.getByRole("button", { name: "和小猫互动" }))
      .toHaveAttribute("data-mascot-state", "celebrate");

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("button", { name: "和小猫互动" }))
      .toHaveAttribute("data-mascot-state", "idle");
  });

  it("uses the button's native keyboard activation", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const view = render(<CatMascot baseState="idle" celebrationKey={0} />);
    const button = screen.getByRole("button", { name: "和小猫互动" });

    button.focus();
    await user.keyboard("{Enter}");

    expect(button).toHaveAttribute("data-mascot-state", "react");
    view.unmount();
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

  it("falls back from a broken animation to the idle GIF without retrying it", () => {
    render(<CatMascot baseState="sleep" celebrationKey={0} />);
    const image = screen.getByRole("presentation");

    expect(image).toHaveAttribute("src", "/mascot/sleep.gif");
    act(() => image.dispatchEvent(new Event("error", { bubbles: true })));
    expect(image).toHaveAttribute("src", "/mascot/idle.gif");

    act(() => image.dispatchEvent(new Event("error", { bubbles: true })));
    expect(image).toHaveAttribute("src", "/mascot/idle.gif");
  });

  it("falls back to the idle PNG in reduced-motion mode", () => {
    mockMatchMedia(true);
    render(<CatMascot baseState="sleep" celebrationKey={0} />);
    const image = screen.getByRole("presentation");

    act(() => image.dispatchEvent(new Event("error", { bubbles: true })));

    expect(image).toHaveAttribute("src", "/mascot/idle.png");
  });
});
