import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

function renderDialog(onCancel = vi.fn()) {
  return render(
    <ConfirmDialog
      title="删除记录？"
      message="此操作无法撤销。"
      confirmLabel="删除"
      onConfirm={() => {}}
      onCancel={onCancel}
    />
  );
}

describe("ConfirmDialog keyboard access", () => {
  it("moves focus inside, traps tab navigation, and restores the trigger focus on unmount", async () => {
    const user = userEvent.setup();
    const trigger = document.createElement("button");
    trigger.textContent = "打开确认";
    document.body.append(trigger);
    trigger.focus();

    const { unmount } = renderDialog();
    const cancel = screen.getByRole("button", { name: "取消" });
    const confirm = screen.getByRole("button", { name: "删除" });

    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it("cancels when Escape is pressed", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderDialog(onCancel);

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
