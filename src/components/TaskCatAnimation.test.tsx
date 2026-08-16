import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assignTaskCatVariants, getTaskCatVariant, TaskCatAnimation } from "./TaskCatAnimation";

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  } as MediaQueryList)));
}

describe("TaskCatAnimation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("matches clear task names to their corresponding cat action", () => {
    expect(getTaskCatVariant({ taskKey: "1", title: "乒乓球训练" })).toBe("14");
    expect(getTaskCatVariant({ taskKey: "2", title: "洗澡" })).toBe("12");
    expect(getTaskCatVariant({ taskKey: "3", title: "拍照练习" })).toBe("09");
    expect(getTaskCatVariant({ taskKey: "4", title: "午休一会" })).toBe("05");
  });

  it("keeps the same task stable and uses its category when the title is ambiguous", () => {
    const input = { taskKey: "fixed:daily", title: "每日打卡", categoryId: "exercise" };
    const variant = getTaskCatVariant(input);

    expect(getTaskCatVariant(input)).toBe(variant);
    expect(["18", "14", "10", "08", "06"]).toContain(variant);
  });

  it("avoids repeating cats for tasks shown on the same day", () => {
    const variants = assignTaskCatVariants(Array.from({ length: 10 }, (_, index) => ({
      taskKey: `study:${index}`,
      title: `学习任务 ${index + 1}`,
      categoryId: "study"
    })));

    expect(new Set(variants).size).toBe(variants.length);
  });

  it("renders the animated asset by default", () => {
    mockMatchMedia(false);
    const { container } = render(<TaskCatAnimation taskKey="study:1" title="学习英语" categoryId="study" />);

    expect(container.querySelector("[data-task-cat-variant]")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", expect.stringMatching(/^\/mascot\/idle\/(02|11|20)\.gif$/));
  });

  it("uses a static frame for people who reduce motion", () => {
    mockMatchMedia(true);
    const { container } = render(<TaskCatAnimation taskKey="rest:1" title="午休" categoryId="rest" />);

    expect(container.querySelector("img")).toHaveAttribute("src", "/mascot/idle/05.png");
  });
});
