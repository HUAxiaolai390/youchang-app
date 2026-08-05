import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";

describe("AppShell", () => {
  it("offers Today, Plan, Growth, and Settings navigation", () => {
    render(
      <AppShell activePage="today" onNavigate={() => {}}>
        <p>内容</p>
      </AppShell>
    );

    expect(screen.getByRole("button", { name: "今日" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "计划" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "成长" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "设置" })).toBeEnabled();
  });

  it("navigates when an inactive page is selected", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(
      <AppShell activePage="today" onNavigate={onNavigate}>
        <p>内容</p>
      </AppShell>
    );

    await user.click(screen.getByRole("button", { name: "成长" }));

    expect(onNavigate).toHaveBeenCalledWith("growth");
  });
});

describe("ConfirmDialog", () => {
  it("confirms or cancels the requested action", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        title="删除记录？"
        message="此操作无法撤销。"
        confirmLabel="删除"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByRole("dialog", { name: "删除记录？" })).toHaveTextContent("此操作无法撤销。");
    await user.click(screen.getByRole("button", { name: "删除" }));
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe("EmptyState", () => {
  it("shows a calm empty-state message", () => {
    render(<EmptyState title="今天还没有安排" description="留一点空间给自己。" />);

    expect(screen.getByRole("heading", { name: "今天还没有安排" })).toBeInTheDocument();
    expect(screen.getByText("留一点空间给自己。")).toBeInTheDocument();
  });
});
