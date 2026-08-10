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

  it("submits a reminder after a start time is entered", async () => {
    const state = createInitialState(new Date(2026, 6, 31, 9));
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<TaskForm categories={state.categories} today="2026-07-31" onCancel={() => {}} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("任务名称"), "晚上复习");
    await user.type(screen.getByLabelText("开始时间（选填）"), "20:00");
    await user.selectOptions(screen.getByLabelText("任务提醒"), "10");
    await user.click(screen.getByRole("button", { name: "保存任务" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      plannedStartTime: "20:00",
      reminderMinutesBefore: 10
    }));
  });

  it("offers clear date shortcuts when editing a temporary task", async () => {
    const state = createInitialState(new Date(2026, 6, 31, 9));
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<TaskForm
      categories={state.categories}
      today="2026-07-31"
      initialValues={{ title: "整理笔记", kind: "scheduled", categoryId: "study", date: "2026-07-31", priority: "medium" }}
      onCancel={() => {}}
      onSubmit={onSubmit}
    />);

    expect(screen.getByLabelText("改到哪一天")).toHaveValue("2026-07-31");
    await user.click(screen.getByRole("button", { name: "明天" }));
    expect(screen.getByText(/将从 7月31日周五 改到 8月1日周六/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ date: "2026-08-01" }));
  });

  it("explains that reminders require a start time", async () => {
    const state = createInitialState(new Date(2026, 6, 31, 9));
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<TaskForm categories={state.categories} today="2026-07-31" onCancel={() => {}} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("任务名称"), "未定时间的任务");
    await user.selectOptions(screen.getByLabelText("任务提醒"), "10");
    await user.click(screen.getByRole("button", { name: "保存任务" }));

    expect(screen.getByRole("alert")).toHaveTextContent("设置提醒前，请先填写开始时间");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("configures a custom repeat rule for a fixed task", async () => {
    const state = createInitialState(new Date(2026, 6, 31, 9));
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<TaskForm categories={state.categories} today="2026-07-31" onCancel={() => {}} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("任务名称"), "周一周五跑步");
    await user.click(screen.getByRole("radio", { name: "固定任务" }));
    await user.selectOptions(screen.getByLabelText("重复方式"), "custom-weekdays");
    await user.click(screen.getByText("三", { selector: ".repeat-weekdays span" }));
    await user.click(screen.getByRole("button", { name: "保存任务" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      kind: "fixed",
      repeatRule: { type: "custom-weekdays", weekdays: [1, 5] }
    }));
  });

  it("explains and submits high, medium, and low priority", async () => {
    const state = createInitialState(new Date(2026, 6, 31, 9));
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<TaskForm categories={state.categories} today="2026-07-31" onCancel={() => {}} onSubmit={onSubmit} />);

    expect(screen.getByText("重要且紧急")).toBeVisible();
    expect(screen.getByText("重要或紧急")).toBeVisible();
    expect(screen.getByText("日常且可灵活安排")).toBeVisible();
    await user.type(screen.getByLabelText("任务名称"), "准备明天考试");
    await user.click(screen.getByRole("radio", { name: /高.*重要且紧急/ }));
    await user.click(screen.getByRole("button", { name: "保存任务" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ priority: "high" }));
  });

  it("adds, removes, and submits task steps", async () => {
    const state = createInitialState(new Date(2026, 6, 31, 9));
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<TaskForm categories={state.categories} today="2026-07-31" onCancel={() => {}} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("任务名称"), "完成论文");
    await user.click(screen.getByRole("button", { name: /添加步骤/ }));
    await user.type(screen.getByLabelText("步骤 1"), "查资料");
    await user.click(screen.getByRole("button", { name: /添加步骤/ }));
    await user.type(screen.getByLabelText("步骤 2"), "写正文");
    await user.click(screen.getByRole("button", { name: "保存任务" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      steps: [
        expect.objectContaining({ title: "查资料", completed: false }),
        expect.objectContaining({ title: "写正文", completed: false })
      ]
    }));
  });

  it.each([
    { kind: "fixed" as const, title: "晨间拉伸", checkedName: "固定任务" },
    { kind: "scheduled" as const, title: "整理书桌", checkedName: "临时任务" }
  ])("locks both plan-mode choices when editing a $kind task", ({ kind, title, checkedName }) => {
    const state = createInitialState(new Date(2026, 6, 31, 9));

    render(<TaskForm
      categories={state.categories}
      today="2026-07-31"
      initialValues={{ title, kind, categoryId: "study", date: "2026-07-31", priority: "medium" }}
      onCancel={() => {}}
      onSubmit={() => {}}
    />);

    expect(screen.getByRole("radio", { name: "固定任务" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "临时任务" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: checkedName })).toBeChecked();
    expect(screen.getByText("编辑时不能更改计划方式。")).toBeVisible();
  });
});
