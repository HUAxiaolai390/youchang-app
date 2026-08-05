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

  it("submits an optional start time and estimated duration", async () => {
    const state = createInitialState(new Date(2026, 6, 31, 9));
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<TaskForm categories={state.categories} today="2026-07-31" onCancel={() => {}} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("任务名称"), "数学练习");
    await user.type(screen.getByLabelText("开始时间（选填）"), "19:30");
    await user.type(screen.getByLabelText("预计用时（分钟，选填）"), "45");
    await user.click(screen.getByRole("button", { name: "保存任务" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      plannedStartTime: "19:30", estimatedMinutes: 45
    }));
  });

  it.each([
    { kind: "fixed" as const, title: "晨间拉伸", checkedName: "每日固定" },
    { kind: "scheduled" as const, title: "整理书桌", checkedName: "临时任务" }
  ])("locks both plan-mode choices when editing a $kind task", ({ kind, title, checkedName }) => {
    const state = createInitialState(new Date(2026, 6, 31, 9));

    render(<TaskForm
      categories={state.categories}
      today="2026-07-31"
      initialValues={{ title, kind, categoryId: "study", date: "2026-07-31" }}
      onCancel={() => {}}
      onSubmit={() => {}}
    />);

    expect(screen.getByRole("radio", { name: "每日固定" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "临时任务" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: checkedName })).toBeChecked();
    expect(screen.getByText("编辑时不能更改计划方式。")).toBeVisible();
  });
});
