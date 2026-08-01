import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { PwaUpdatePrompt } from "./PwaUpdatePrompt";

const pwaMock = vi.hoisted(() => ({
  options: undefined as { onNeedReload?: () => void } | undefined
}));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (options: { onNeedReload?: () => void }) => {
    pwaMock.options = options;
    return {
      needRefresh: [false, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: vi.fn()
    };
  }
}));

test("offers a user-controlled refresh when an updated service worker activates", async () => {
  const reloadPage = vi.fn();
  render(<PwaUpdatePrompt reloadPage={reloadPage} />);

  act(() => pwaMock.options?.onNeedReload?.());

  expect(screen.getByRole("status")).toHaveTextContent("新版本已准备好，点击刷新");
  await userEvent.click(screen.getByRole("button", { name: "刷新应用" }));
  expect(reloadPage).toHaveBeenCalledOnce();
});
