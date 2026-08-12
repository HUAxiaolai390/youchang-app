import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../domain/defaults";
import type { AppState } from "../domain/types";
import type { AppRepository } from "../storage/repository";
import { AppStateProvider, reduceAppState, useAppState } from "./AppStateProvider";

class InMemoryRepository implements AppRepository {
  state: AppState;
  saveCount = 0;
  loadCount = 0;
  saveError?: Error;

  constructor(state: AppState) {
    this.state = state;
  }

  load() {
    this.loadCount += 1;
    return this.state;
  }

  save(state: AppState) {
    if (this.saveError) throw this.saveError;
    this.saveCount += 1;
    this.state = state;
  }

  clear() {
    this.state = createInitialState(new Date(2026, 6, 31, 9));
    return this.state;
  }
}

function Harness({ repository, children }: { repository: AppRepository; children?: ReactNode }) {
  return <AppStateProvider repository={repository}>{children ?? <AddTaskButton />}</AppStateProvider>;
}

function AddTaskButton() {
  const { dispatch } = useAppState();

  return (
    <button
      onClick={() => dispatch({
        type: "scheduled/add",
        input: { title: "完成数学练习", categoryId: "study", scheduledDate: "2026-07-31" }
      })}
    >
      添加测试任务
    </button>
  );
}

function ClearDataButton() {
  const { dispatch } = useAppState();

  return <button onClick={() => dispatch({ type: "data/clear" })}>清除测试数据</button>;
}

function ErrorMessage() {
  const { dispatch, error } = useAppState();

  return error
    ? <button onClick={() => dispatch({ type: "error/dismiss" })}>{error}</button>
    : <p>没有错误</p>;
}

function DispatchResultButton() {
  const { dispatch } = useAppState();
  const [result, setResult] = useState("未提交");

  function submit() {
    const outcome = dispatch({
      type: "scheduled/add",
      input: { title: "结果任务", categoryId: "study", scheduledDate: "2026-07-31" }
    });
    setResult(String(outcome));
  }

  return <><button onClick={submit}>提交并显示结果</button><p>{result}</p></>;
}

function ImportOlderBackupButton({ imported }: { imported: AppState }) {
  const { dispatch, state } = useAppState();
  const todayRecord = state.fixedRecords.find((record) => record.date === "2026-08-01");

  return <>
    <button onClick={() => dispatch({ type: "backup/import", state: imported })}>导入旧备份</button>
    <p>今日固定：{todayRecord?.titleSnapshot ?? "无"}</p>
    <p>逾期状态：{state.scheduledTasks.find((task) => task.id === "overdue")?.status ?? "无"}</p>
  </>;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AppStateProvider", () => {
  it("stores whether reminders should light the locked screen", () => {
    const state = createInitialState(new Date(2026, 7, 12, 9));
    const next = reduceAppState(
      state,
      { type: "settings/wake-screen-reminders", enabled: false },
      new Date(2026, 7, 12, 9)
    );

    expect(next.settings.wakeScreenForReminders).toBe(false);
    expect(state.settings.wakeScreenForReminders).toBe(true);
  });

  it("persists a task added through dispatch", async () => {
    const repository = new InMemoryRepository(createInitialState(new Date(2026, 6, 31, 9)));
    const user = userEvent.setup();

    render(<Harness repository={repository} />);
    await user.click(screen.getByRole("button", { name: "添加测试任务" }));

    expect(repository.load().scheduledTasks[0].title).toBe("完成数学练习");
  });

  it("clears data through the repository without an extra save", async () => {
    const state = createInitialState(new Date(2026, 6, 31, 9));
    state.scheduledTasks.push({
      id: "task-1",
      title: "已有任务",
      categoryId: "study",
      categoryNameSnapshot: "学习",
      scheduledDate: "2026-07-31",
      status: "pending",
      createdAt: "2026-07-31T01:00:00.000Z"
    });
    const repository = new InMemoryRepository(state);
    const user = userEvent.setup();

    render(<Harness repository={repository}><ClearDataButton /></Harness>);
    await user.click(screen.getByRole("button", { name: "清除测试数据" }));

    expect(repository.load().scheduledTasks).toEqual([]);
    expect(repository.saveCount).toBe(0);
  });

  it("reports a domain error and dismisses it through dispatch", async () => {
    const repository = new InMemoryRepository(createInitialState(new Date(2026, 6, 31, 9)));
    const user = userEvent.setup();

    render(<Harness repository={repository}><><AddInvalidTaskButton /><ErrorMessage /></></Harness>);
    await user.click(screen.getByRole("button", { name: "添加无效任务" }));

    await user.click(screen.getByRole("button", { name: "请输入任务名称" }));
    expect(screen.getByText("没有错误")).toBeInTheDocument();
  });

  it("reports a repository save error without applying the action", async () => {
    const repository = new InMemoryRepository(createInitialState(new Date(2026, 6, 31, 9)));
    repository.saveError = new Error("保存失败，请立即导出备份");
    const user = userEvent.setup();

    render(<Harness repository={repository}><><AddTaskButton /><ErrorMessage /></></Harness>);
    await user.click(screen.getByRole("button", { name: "添加测试任务" }));

    expect(screen.getByRole("button", { name: "保存失败，请立即导出备份" })).toBeInTheDocument();
    expect(repository.load().scheduledTasks).toEqual([]);
  });

  it("returns whether a dispatched action was persisted", async () => {
    const repository = new InMemoryRepository(createInitialState(new Date(2026, 6, 31, 9)));
    const user = userEvent.setup();

    render(<Harness repository={repository}><DispatchResultButton /></Harness>);
    await user.click(screen.getByRole("button", { name: "提交并显示结果" }));

    expect(screen.getByText("true")).toBeInTheDocument();
  });

  it("replaces an unknown repository error with a safe message", async () => {
    const repository = new InMemoryRepository(createInitialState(new Date(2026, 6, 31, 9)));
    repository.saveError = new Error("connection string: postgres://secret");
    const user = userEvent.setup();

    render(<Harness repository={repository}><><AddTaskButton /><ErrorMessage /></></Harness>);
    await user.click(screen.getByRole("button", { name: "添加测试任务" }));

    expect(screen.getByRole("button", { name: "操作失败，请稍后重试" })).toBeInTheDocument();
    expect(screen.queryByText("connection string: postgres://secret")).not.toBeInTheDocument();
  });

  it("loads the repository only once across rerenders", () => {
    const repository = new InMemoryRepository(createInitialState(new Date(2026, 6, 31, 9)));
    const view = render(<Harness repository={repository} />);

    view.rerender(<Harness repository={repository} />);

    expect(repository.loadCount).toBe(1);
  });

  it("creates one new fixed record at midnight even after returning to the foreground", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 31, 23, 59));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    const state = createInitialState(new Date(2026, 6, 31, 9));
    state.fixedTasks.push({
      id: "fixed-1",
      title: "晨间整理",
      categoryId: "life",
      categoryNameSnapshot: "生活",
      activeFrom: "2026-07-31",
      order: 0,
      createdAt: "2026-07-31T01:00:00.000Z"
    });
    const repository = new InMemoryRepository(state);

    render(<Harness repository={repository} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(repository.load().fixedRecords).toHaveLength(1);
    expect(repository.load().fixedRecords[0].date).toBe("2026-08-01");
  });

  it("rolls an older imported backup forward before persisting and displaying it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 1, 9));
    const imported = createInitialState(new Date(2026, 6, 30, 9));
    imported.fixedTasks.push({
      id: "fixed-imported",
      title: "晨间拉伸",
      categoryId: "exercise",
      categoryNameSnapshot: "运动",
      activeFrom: "2026-07-31",
      order: 0,
      createdAt: "2026-07-30T01:00:00.000Z"
    });
    imported.scheduledTasks.push({
      id: "overdue",
      title: "整理旧资料",
      categoryId: "work",
      categoryNameSnapshot: "工作",
      scheduledDate: "2026-07-30",
      status: "pending",
      createdAt: "2026-07-30T01:00:00.000Z"
    });
    const repository = new InMemoryRepository(createInitialState(new Date(2026, 7, 1, 9)));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<Harness repository={repository}><ImportOlderBackupButton imported={imported} /></Harness>);
    await user.click(screen.getByRole("button", { name: "导入旧备份" }));

    expect(screen.getByText("今日固定：晨间拉伸")).toBeVisible();
    expect(screen.getByText("逾期状态：backlog")).toBeVisible();
    expect(repository.state.settings.lastOpenedDate).toBe("2026-08-01");
    expect(repository.state.fixedRecords.map((record) => record.date)).toEqual(["2026-07-31", "2026-08-01"]);
    expect(repository.state.scheduledTasks[0]?.status).toBe("backlog");
  });
});

function AddInvalidTaskButton() {
  const { dispatch } = useAppState();

  return (
    <button
      onClick={() => dispatch({
        type: "scheduled/add",
        input: { title: " ", categoryId: "study", scheduledDate: "2026-07-31" }
      })}
    >
      添加无效任务
    </button>
  );
}
