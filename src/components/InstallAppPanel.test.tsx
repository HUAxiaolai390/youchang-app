import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InstallAppPanel } from "./InstallAppPanel";
import { InstallPromptProvider } from "./InstallPromptProvider";

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
});

describe("InstallAppPanel", () => {
  it("offers the browser installation prompt when available", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false })
    });
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" }>;
    };
    event.prompt = prompt;
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    const user = userEvent.setup();
    render(<InstallPromptProvider><InstallAppPanel /></InstallPromptProvider>);

    window.dispatchEvent(event);
    await user.click(await screen.findByRole("button", { name: "安装有常" }));

    expect(prompt).toHaveBeenCalledOnce();
    expect(await screen.findByText("正在完成安装")).toBeVisible();
  });

  it("recognizes an already installed standalone app", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true })
    });

    render(<InstallPromptProvider><InstallAppPanel /></InstallPromptProvider>);

    expect(screen.getByText("有常已经在这台设备上安装")).toBeVisible();
    expect(screen.getByText("已安装")).toBeVisible();
  });
});
