import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toDateKey } from "../domain/date";
import { createInitialState } from "../domain/defaults";
import type { AppState } from "../domain/types";
import type { AppRepository } from "../storage/repository";
import { App } from "./App";

describe("App", () => {
  it("shows the product name and slogan", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "有常" })).toBeInTheDocument();
    expect(screen.getByText("日日有常，步步有长。")).toBeInTheDocument();
  });

  it("shows a provider error in an alert and lets the user dismiss it", async () => {
    const repository: AppRepository = {
      load() {
        throw new Error("保存失败，请立即导出备份");
      },
      save() {},
      clear() {
        return createInitialState(new Date(2026, 6, 31, 9));
      }
    };
    const user = userEvent.setup();

    render(<App repository={repository} />);

    expect(screen.getByRole("alert")).toHaveTextContent("保存失败，请立即导出备份");
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens the growth summary from the main navigation", async () => {
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "成长" }));

    expect(screen.getByText("每日一句 · Daily Quote")).toBeInTheDocument();
    expect(screen.getAllByText(/^“.+”$/)).toHaveLength(2);
    expect(document.querySelector('.daily-quote__en[lang="en"]')).toHaveTextContent(/^“.+”$/);
    expect(document.querySelector('.daily-quote footer [lang="en"]')).not.toBeEmptyDOMElement();
    expect(screen.getByText("累计完成 0 项")).toBeInTheDocument();
  });

  it("shows the daily quote at the top of every page", async () => {
    const user = userEvent.setup();
    render(<App />);

    for (const page of ["今日", "计划", "成长", "设置"]) {
      await user.click(screen.getByRole("button", { name: new RegExp(`^${page}$`) }));
      expect(screen.getByText("每日一句 · Daily Quote")).toBeVisible();
      if (page !== "今日") expect(screen.getByRole("heading", { name: new RegExp(`^${page}$`) })).toBeVisible();
    }
  });

  it("keeps detailed growth sections collapsed until requested", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /^成长$/ }));

    const more = screen.getByText("更多成长数据").closest("details");
    expect(more).not.toHaveAttribute("open");
    await user.click(screen.getByText("更多成长数据"));
    expect(more).toHaveAttribute("open");
  });

  it("keeps long-term goal management easy to find from the growth header", async () => {
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "成长" }));
    await user.click(screen.getByRole("button", { name: "管理长期目标" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "长期目标" })).toHaveFocus());
    expect(screen.getByRole("button", { name: "新增目标" })).toBeVisible();
  });

  it("recalculates the heatmap from the latest record after a past task is completed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 18, 9));
    const state = createInitialState(new Date(2026, 7, 18, 9));
    state.scheduledTasks.push({
      id: "forgotten-yesterday",
      title: "昨晚完成的复习",
      categoryId: "study",
      categoryNameSnapshot: "学习",
      scheduledDate: "2026-08-17",
      status: "backlog",
      createdAt: "2026-08-17T10:00:00.000Z"
    });
    const repository = memoryRepository(state);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    try {
      render(<App repository={repository} />);
      await user.click(screen.getByRole("button", { name: "计划" }));
      await user.click(screen.getByRole("button", { name: /星期一 8月17日/ }));
      await user.click(screen.getByRole("button", { name: "补记完成：昨晚完成的复习" }));
      await user.click(screen.getByRole("button", { name: "成长" }));
      await user.click(screen.getByText("更多成长数据"));

      expect(screen.getByLabelText(/8月17日，完成 1\/1 项/)).toBeVisible();
      expect(screen.getByText("1 天活跃")).toBeVisible();
      expect(screen.getByText(/补记往日完成后立即更新/)).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens medal management from the home page", async () => {
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("link", { name: /我的勋章.*查看全部/ }));

    expect(screen.getByRole("heading", { name: "成就勋章" })).toBeInTheDocument();
  });

  it("opens the weekly planner from the main navigation", async () => {
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "计划" }));

    expect(screen.getByRole("heading", { name: "本周安排" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "选择本周日期" })).toBeInTheDocument();
  });

  it("opens the settings controls from the main navigation", async () => {
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "设置" }));

    expect(screen.getByRole("heading", { name: "通知权限" })).toBeInTheDocument();
  });

  it("keeps one background audio element when settings owns the music controls", async () => {
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "设置" }));

    expect(screen.getAllByTestId("background-music-audio")).toHaveLength(1);
  });

  it("shows other as the live label across pages after deleting a custom category", async () => {
    const now = new Date();
    const today = toDateKey(now);
    const state = createInitialState(now);
    state.categories.push({ id: "reading", name: "阅读", icon: "读", builtIn: false, order: 6, createdAt: now.toISOString() });
    state.fixedTasks.push({
      id: "fixed-reading", title: "晨读", categoryId: "reading", categoryNameSnapshot: "阅读",
      activeFrom: today, order: 0, createdAt: now.toISOString()
    });
    state.fixedRecords.push({
      id: "record-reading", templateId: "fixed-reading", date: today, titleSnapshot: "晨读",
      categoryId: "reading", categoryNameSnapshot: "阅读"
    });
    state.scheduledTasks.push({
      id: "scheduled-reading", title: "整理读书笔记", categoryId: "reading", categoryNameSnapshot: "阅读",
      scheduledDate: today, status: "pending", createdAt: now.toISOString()
    });
    const repository = memoryRepository(state);
    const user = userEvent.setup();

    render(<App repository={repository} />);
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "删除分类：阅读" }));
    await user.click(screen.getByRole("button", { name: "删除分类" }));
    await user.click(screen.getByRole("button", { name: "今日" }));

    expect(screen.getByText("晨读").parentElement).toHaveTextContent("其他");
    expect(screen.getByText("整理读书笔记").parentElement).toHaveTextContent("其他");
    expect(repository.state.fixedRecords[0]).toMatchObject({ categoryId: "other", categoryNameSnapshot: "阅读" });
    expect(repository.state.scheduledTasks[0]).toMatchObject({ categoryId: "other", categoryNameSnapshot: "阅读" });
  });

  it("shows normalized live labels across pages after importing a backup with stale category IDs", async () => {
    const now = new Date();
    const today = toDateKey(now);
    const imported = createInitialState(now);
    imported.scheduledTasks.push({
      id: "imported-reading", title: "导入的阅读笔记", categoryId: "removed-reading", categoryNameSnapshot: "阅读",
      scheduledDate: today, status: "pending", createdAt: now.toISOString()
    });
    const repository = memoryRepository(createInitialState(now));
    const user = userEvent.setup();
    const file = new File([JSON.stringify(imported)], "backup.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => JSON.stringify(imported) });

    render(<App repository={repository} />);
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.upload(screen.getByLabelText("导入备份"), file);
    await user.click(screen.getByRole("button", { name: "确认导入" }));
    await user.click(screen.getByRole("button", { name: "今日" }));

    expect(screen.getByText("导入的阅读笔记").parentElement).toHaveTextContent("其他");
    expect(repository.state.scheduledTasks[0]).toMatchObject({ categoryId: "other", categoryNameSnapshot: "阅读" });
  });
});

function memoryRepository(initial: AppState): AppRepository & { state: AppState } {
  return {
    state: initial,
    load() { return this.state; },
    save(state) { this.state = state; },
    clear() {
      this.state = createInitialState(new Date());
      return this.state;
    }
  };
}
