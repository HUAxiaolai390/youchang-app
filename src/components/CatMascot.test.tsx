import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatMascot, mascotAutoSwitchInterval, mascotIdleVariants } from "./CatMascot";

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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("cycles through all 18 extracted idle animations and wraps", () => {
    render(<CatMascot baseState="idle" celebrationKey={0} />);
    const button = screen.getByRole("button", { name: "和小猫互动" });
    const expectedCycle = ["20", ...mascotIdleVariants.slice(0, -1)];

    expect(mascotIdleVariants).toHaveLength(18);
    expect(button).toHaveAttribute("data-mascot-state", "idle");
    expect(button).toHaveAttribute("data-mascot-idle-variant", "19");
    expect(screen.getByRole("presentation")).toHaveAttribute("src", "/mascot/idle.gif");

    for (const variant of expectedCycle) {
      fireEvent.click(button);
      expect(button).toHaveAttribute("data-mascot-state", "idle");
      expect(button).toHaveAttribute("data-mascot-idle-variant", variant);
      expect(screen.getByRole("presentation")).toHaveAttribute("src", `/mascot/idle/${variant}.gif`);
    }
  });

  it("switches from sleep to the next idle action when clicked", () => {
    render(<CatMascot baseState="sleep" celebrationKey={0} />);
    const button = screen.getByRole("button", { name: "和小猫互动" });

    expect(button).toHaveAttribute("data-mascot-state", "sleep");
    fireEvent.click(button);
    expect(button).toHaveAttribute("data-mascot-state", "idle");
    expect(button).toHaveAttribute("data-mascot-idle-variant", "20");
    expect(screen.getByRole("presentation")).toHaveAttribute("src", "/mascot/idle/20.gif");
  });

  it("automatically switches to a different idle action", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<CatMascot baseState="idle" celebrationKey={0} />);
    const button = screen.getByRole("button", { name: "和小猫互动" });

    act(() => vi.advanceTimersByTime(mascotAutoSwitchInterval));

    expect(button).toHaveAttribute("data-mascot-idle-variant", "02");
    expect(screen.getByRole("presentation")).toHaveAttribute("src", "/mascot/idle/02.gif");
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

    expect(button).toHaveAttribute("data-mascot-state", "idle");
    expect(button).toHaveAttribute("data-mascot-idle-variant", "20");
    expect(screen.getByRole("presentation")).toHaveAttribute("src", "/mascot/idle/20.gif");
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
    const fallbackImage = screen.getByRole("presentation");
    expect(fallbackImage).toHaveAttribute("src", "/mascot/idle.gif");

    act(() => fallbackImage.dispatchEvent(new Event("error", { bubbles: true })));
    expect(screen.getByRole("presentation")).toHaveAttribute("src", "/mascot/idle.gif");
  });

  it("falls back to the idle PNG in reduced-motion mode", () => {
    mockMatchMedia(true);
    render(<CatMascot baseState="sleep" celebrationKey={0} />);
    const image = screen.getByRole("presentation");

    act(() => image.dispatchEvent(new Event("error", { bubbles: true })));

    expect(screen.getByRole("presentation")).toHaveAttribute("src", "/mascot/idle.png");
  });

  it("uses each idle variant's static frame in reduced-motion mode", () => {
    mockMatchMedia(true);
    render(<CatMascot baseState="idle" celebrationKey={0} />);
    const button = screen.getByRole("button", { name: "和小猫互动" });

    fireEvent.click(button);

    expect(screen.getByRole("presentation")).toHaveAttribute("src", "/mascot/idle/20.png");
  });

  it("falls back from a broken idle variant and continues cycling", () => {
    render(<CatMascot baseState="idle" celebrationKey={0} />);
    const button = screen.getByRole("button", { name: "和小猫互动" });

    fireEvent.click(button);
    const brokenImage = screen.getByRole("presentation");
    expect(brokenImage).toHaveAttribute("src", "/mascot/idle/20.gif");
    act(() => brokenImage.dispatchEvent(new Event("error", { bubbles: true })));
    expect(screen.getByRole("presentation")).toHaveAttribute("src", "/mascot/idle.gif");

    fireEvent.click(button);
    expect(screen.getByRole("presentation")).toHaveAttribute("src", "/mascot/idle/02.gif");
  });
});
