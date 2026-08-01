import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "../../domain/defaults";
import { TaskForm } from "./TaskForm";

describe("TaskForm", () => {
  it("defaults a new task to a temporary study task on today", () => {
    const state = createInitialState(new Date(2026, 6, 31, 9));

    render(<TaskForm categories={state.categories} today="2026-07-31" onCancel={() => {}} onSubmit={() => {}} />);

    expect(screen.getByRole("radio", { name: "临时任务" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "学习" })).toBeChecked();
    expect(screen.getByLabelText("执行日期")).toHaveValue("2026-07-31");
  });

  it("keeps an invalid empty title open and explains the error", async () => {
    const user = userEvent.setup();
    const state = createInitialState(new Date(2026, 6, 31, 9));
    const onSubmit = vi.fn();

    render(<TaskForm categories={state.categories} today="2026-07-31" onCancel={() => {}} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "保存任务" }));

    expect(screen.getByRole("alert")).toHaveTextContent("请输入任务名称");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a save error supplied by the state layer beside the form", () => {
    const state = createInitialState(new Date(2026, 6, 31, 9));

    render(<TaskForm categories={state.categories} today="2026-07-31" error="保存失败，请立即导出备份" onCancel={() => {}} onSubmit={() => {}} />);

    expect(screen.getByRole("alert")).toHaveTextContent("保存失败，请立即导出备份");
  });
});
