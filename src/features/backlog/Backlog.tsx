import { useMemo, useState } from "react";
import { useAppState } from "../../app/AppStateProvider";
import { fromDateKey, getWeek, isWithinWeek, toDateKey } from "../../domain/date";
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

function TaskCard({ task, actionLabel, onReschedule, onDelete }: {
  task: ScheduledTask;
  actionLabel: string;
  onReschedule(): void;
  onDelete(): void;
}) {
  return (
    <li className="backlog-card">
      <div className="backlog-card__copy">
        <p>{task.title}</p>
        <span>原定：{formatDate(task.scheduledDate)} · {task.categoryNameSnapshot}</span>
      </div>
      <div className="backlog-card__actions">
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
  const weekDates = useMemo(() => getWeekDates(now), [now]);
  const backlogTasks = state.scheduledTasks.filter((task) => task.status === "backlog" && isWithinWeek(task.scheduledDate, now));
  const archivedTasks = state.scheduledTasks.filter((task) => task.status === "archived");

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

  return (
    <section className="backlog-panel" aria-labelledby="backlog-title">
      <div className="backlog-panel__header">
        <h2 id="backlog-title">本周待安排</h2>
        <span>{backlogTasks.length} 项</span>
      </div>
      {backlogTasks.length === 0 ? <p className="backlog-panel__empty">本周没有待安排任务</p> : (
        <ul className="backlog-list">
          {backlogTasks.map((task) => <TaskCard key={task.id} task={task} actionLabel="改期" onReschedule={() => openReschedule(task, false)} onDelete={() => dispatch({ type: "scheduled/delete", id: task.id })} />)}
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
            {archivedTasks.map((task) => <TaskCard key={task.id} task={task} actionLabel="移入本周" onReschedule={() => openReschedule(task, true)} onDelete={() => dispatch({ type: "scheduled/delete", id: task.id })} />)}
          </ul>
        )}
      </details>
    </section>
  );
}
