import { useMemo, useState } from "react";
import { useAppState } from "../../app/AppStateProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { TimeEntryDialog } from "../../components/TimeEntryDialog";
import { fromDateKey, getWeek, isWithinWeek, toDateKey } from "../../domain/date";
import { formatTaskPriority } from "../../domain/priorities";
import type { DateKey, ScheduledTask } from "../../domain/types";

type BacklogProps = {
  now?: Date;
};

type ReschedulingTask = {
  id: string;
  archived: boolean;
};

const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

function formatDate(key: DateKey) {
  const date = fromDateKey(key);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatPickerDate(key: DateKey) {
  const date = fromDateKey(key);
  return `${weekdays[date.getDay()]} ${formatDate(key)}`;
}

function getWeekDates(now: Date): DateKey[] {
  const { start, end } = getWeek(now);
  const date = fromDateKey(start);
  const dates: DateKey[] = [];

  while (toDateKey(date) <= end) {
    dates.push(toDateKey(date));
    date.setDate(date.getDate() + 1);
  }

  return dates;
}

function TaskCard({ task, categoryName, actionLabel, onComplete, onReschedule, onDelete, onTime }: {
  task: ScheduledTask;
  categoryName: string;
  actionLabel: string;
  onComplete(): void;
  onReschedule(): void;
  onDelete(): void;
  onTime(): void;
}) {
  return (
    <li className="backlog-card">
      <div className="backlog-card__copy">
        <p><span className={`task-priority-tag task-priority-tag--${task.priority ?? "medium"}`}>{formatTaskPriority(task.priority)}</span>{task.title}</p>
        <span>
          原定：{formatDate(task.scheduledDate)} · {categoryName}
          {task.plannedStartTime ? ` · ${task.plannedStartTime}` : ""}
          {task.estimatedMinutes ? ` · 预计 ${task.estimatedMinutes} 分钟` : ""}
          {task.actualMinutes ? ` · 实际 ${task.actualMinutes} 分钟` : ""}
        </span>
      </div>
      <div className="backlog-card__actions">
        <button type="button" className="backlog-card__complete" onClick={onComplete} aria-label={`补记完成：${task.title}`}>完成</button>
        <button type="button" onClick={onTime} aria-label={`记录用时：${task.title}`}>用时</button>
        <button type="button" onClick={onReschedule} aria-label={`${actionLabel}：${task.title}`}>{actionLabel}</button>
        <button type="button" onClick={onDelete} aria-label={`删除：${task.title}`}>删除</button>
      </div>
    </li>
  );
}

export function Backlog({ now = new Date() }: BacklogProps) {
  const { state, dispatch } = useAppState();
  const today = toDateKey(now);
  const [rescheduling, setRescheduling] = useState<ReschedulingTask>();
  const [pendingDelete, setPendingDelete] = useState<{ task: ScheduledTask; archived: boolean }>();
  const [timing, setTiming] = useState<ScheduledTask>();
  const [recentlyCompleted, setRecentlyCompleted] = useState<ScheduledTask>();
  const weekDates = useMemo(() => getWeekDates(now), [now]);
  const backlogTasks = state.scheduledTasks.filter((task) => task.status === "backlog" && isWithinWeek(task.scheduledDate, now));
  const archivedTasks = state.scheduledTasks.filter((task) => task.status === "archived");
  const categoriesById = new Map(state.categories.map((category) => [category.id, category.name]));
  const liveCategoryName = (categoryId: string) => categoriesById.get(categoryId) ?? categoriesById.get("other") ?? "其他";

  function openReschedule(task: ScheduledTask, archived: boolean) {
    setRescheduling({ id: task.id, archived });
  }

  function chooseDate(targetDate: DateKey) {
    if (!rescheduling) return;
    const saved = dispatch(rescheduling.archived
      ? { type: "scheduled/move-archived", id: rescheduling.id, targetDate }
      : { type: "scheduled/reschedule", id: rescheduling.id, targetDate });
    if (saved) setRescheduling(undefined);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    if (dispatch({ type: "scheduled/delete", id: pendingDelete.task.id })) setPendingDelete(undefined);
  }

  function saveActualTime(minutes: number) {
    if (!timing) return;
    if (dispatch({ type: "scheduled/time-set", id: timing.id, minutes })) setTiming(undefined);
  }

  function completeTask(task: ScheduledTask) {
    if (dispatch({ type: "scheduled/toggle", id: task.id })) setRecentlyCompleted(task);
  }

  function undoCompletion() {
    if (!recentlyCompleted) return;
    if (dispatch({ type: "scheduled/toggle", id: recentlyCompleted.id })) setRecentlyCompleted(undefined);
  }

  return (
    <section className="backlog-panel" aria-labelledby="backlog-title">
      <div className="backlog-panel__header">
        <h2 id="backlog-title">本周待安排</h2>
        <span>{backlogTasks.length} 项</span>
      </div>
      {recentlyCompleted && <div className="backlog-panel__notice" role="status">
        <span>已按原定 {formatDate(recentlyCompleted.scheduledDate)} 补记“{recentlyCompleted.title}”完成</span>
        <button type="button" onClick={undoCompletion} aria-label={`撤销补记：${recentlyCompleted.title}`}>撤销</button>
      </div>}
      {backlogTasks.length === 0 ? <p className="backlog-panel__empty">本周没有待安排任务</p> : (
        <ul className="backlog-list">
          {backlogTasks.map((task) => <TaskCard key={task.id} task={task} categoryName={liveCategoryName(task.categoryId)} actionLabel="改期" onComplete={() => completeTask(task)} onReschedule={() => openReschedule(task, false)} onDelete={() => setPendingDelete({ task, archived: false })} onTime={() => setTiming(task)} />)}
        </ul>
      )}
      {rescheduling && (
        <section className="reschedule-picker" aria-label="选择改期日期">
          <p>选择本周日期</p>
          <div>
            {weekDates.map((date) => <button key={date} type="button" disabled={date < today} onClick={() => chooseDate(date)}>{formatPickerDate(date)}</button>)}
          </div>
          <button type="button" onClick={() => setRescheduling(undefined)}>取消改期</button>
        </section>
      )}
      <details className="archived-tasks">
        <summary>上周未处理{archivedTasks.length > 0 ? `（${archivedTasks.length}）` : ""}</summary>
        {archivedTasks.length === 0 ? <p className="backlog-panel__empty">没有历史未处理任务</p> : (
          <ul className="backlog-list">
            {archivedTasks.map((task) => <TaskCard key={task.id} task={task} categoryName={liveCategoryName(task.categoryId)} actionLabel="移入本周" onComplete={() => completeTask(task)} onReschedule={() => openReschedule(task, true)} onDelete={() => setPendingDelete({ task, archived: true })} onTime={() => setTiming(task)} />)}
          </ul>
        )}
      </details>
      {pendingDelete && <ConfirmDialog
        title={pendingDelete.archived ? "删除历史任务？" : "删除待安排任务？"}
        message={`确定删除“${pendingDelete.task.title}”吗？`}
        confirmLabel="删除任务"
        onCancel={() => setPendingDelete(undefined)}
        onConfirm={confirmDelete}
      />}
      {timing && <TimeEntryDialog taskTitle={timing.title} currentMinutes={timing.actualMinutes} onSave={saveActualTime} onCancel={() => setTiming(undefined)} />}
    </section>
  );
}
