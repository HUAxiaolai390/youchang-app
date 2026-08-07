import { useMemo, useState } from "react";
import { useAppState } from "../../app/AppStateProvider";
import { fromDateKey, toDateKey } from "../../domain/date";
import { formatPlanComparison } from "../../domain/planning";
import { formatTrackedTime } from "../../domain/time";
import type { DateKey } from "../../domain/types";
import { getWeekPlan, type WeekPlanTask } from "../../domain/week";
import { TaskForm, type TaskFormValues } from "../today/TaskForm";

const shortWeekdays = ["日", "一", "二", "三", "四", "五", "六"];
const longWeekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

function formatMonthDay(key: DateKey): string {
  const date = fromDateKey(key);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatFullDate(key: DateKey): string {
  const date = fromDateKey(key);
  return `${formatMonthDay(key)} ${longWeekdays[date.getDay()]}`;
}

function statusLabel(task: WeekPlanTask): string {
  if (task.status === "completed") return "已完成";
  if (task.status === "backlog") return "待安排";
  return task.kind === "fixed" ? "每日固定" : "当天任务";
}

function WeekTaskCard({ task, canToggle, onMove, onToggle }: {
  task: WeekPlanTask;
  canToggle: boolean;
  onMove(task: WeekPlanTask): void;
  onToggle(task: WeekPlanTask): void;
}) {
  const canMove = task.kind === "scheduled" && task.status !== "completed";
  return (
    <li className={`week-task${task.status === "completed" ? " week-task--completed" : ""}`}>
      <div className="week-task__time">
        <strong>{task.plannedStartTime ?? "灵活"}</strong>
        <span>{task.estimatedMinutes ? `${task.estimatedMinutes} 分` : "未估时"}</span>
      </div>
      <div className="week-task__copy">
        <div>
          <span className={`week-task__status week-task__status--${task.status}`}>{statusLabel(task)}</span>
          <span>{task.categoryName}</span>
        </div>
        <p>{task.title}</p>
        <small>{formatPlanComparison(task.estimatedMinutes, task.actualMinutes)}</small>
      </div>
      {(canToggle || canMove) && <div className="week-task__actions">
        {canToggle && <button
          type="button"
          className="week-task__complete"
          onClick={() => onToggle(task)}
          aria-label={`${task.status === "completed" ? "撤销完成" : "补记完成"}：${task.title}`}
        >{task.status === "completed" ? "撤销" : "完成"}</button>}
        {canMove && <button type="button" className="week-task__move" onClick={() => onMove(task)} aria-label={`改期：${task.title}`}>改到</button>}
      </div>}
    </li>
  );
}

export function WeekPage({ now = new Date() }: { now?: Date }) {
  const { state, dispatch, error } = useAppState();
  const today = toDateKey(now);
  const [selectedDate, setSelectedDate] = useState<DateKey>(today);
  const [movingTask, setMovingTask] = useState<WeekPlanTask>();
  const [formOpen, setFormOpen] = useState(false);
  const days = useMemo(() => getWeekPlan(state, now), [state, now]);
  const selectedDay = days.find((day) => day.date === selectedDate) ?? days[0];
  const totalTasks = days.reduce((sum, day) => sum + day.tasks.length, 0);
  const totalEstimated = days.reduce((sum, day) => sum + day.estimatedMinutes, 0);

  function chooseMoveDate(targetDate: DateKey) {
    if (!movingTask) return;
    const saved = dispatch({ type: "scheduled/reschedule", id: movingTask.taskId, targetDate });
    if (saved) {
      setSelectedDate(targetDate);
      setMovingTask(undefined);
    }
  }

  function toggleTask(task: WeekPlanTask) {
    dispatch(task.kind === "scheduled"
      ? { type: "scheduled/toggle", id: task.taskId }
      : { type: "fixed/toggle-date", templateId: task.taskId, date: task.date });
  }

  function saveTask(values: TaskFormValues) {
    const saved = values.kind === "fixed"
      ? dispatch({ type: "fixed/add", input: {
          title: values.title,
          categoryId: values.categoryId,
          activeFrom: today,
          plannedStartTime: values.plannedStartTime,
          estimatedMinutes: values.estimatedMinutes
        } })
      : dispatch({ type: "scheduled/add", input: {
          title: values.title,
          categoryId: values.categoryId,
          scheduledDate: values.date,
          plannedStartTime: values.plannedStartTime,
          estimatedMinutes: values.estimatedMinutes
        } });

    if (saved) {
      setSelectedDate(values.kind === "scheduled" ? values.date : today);
      setFormOpen(false);
    }
  }

  if (!selectedDay) return null;

  return (
    <section className="week-page" aria-label="一周计划">
      <section className="surface-card week-overview" aria-labelledby="week-overview-title">
        <div>
          <p>WEEKLY PLAN</p>
          <h2 id="week-overview-title">本周安排</h2>
        </div>
        <div className="week-overview__summary">
          <span><strong>{totalTasks}</strong> 项任务</span>
          <span><strong>{formatTrackedTime(totalEstimated)}</strong> 预计</span>
        </div>
      </section>

      <div className="week-day-strip" role="group" aria-label="选择本周日期">
        {days.map((day) => {
          const date = fromDateKey(day.date);
          const selected = day.date === selectedDay.date;
          return (
            <button
              key={day.date}
              type="button"
              aria-pressed={selected}
              aria-label={`${longWeekdays[date.getDay()]} ${formatMonthDay(day.date)}，${day.tasks.length} 项任务`}
              onClick={() => { setSelectedDate(day.date); setMovingTask(undefined); }}
            >
              <span>周{shortWeekdays[date.getDay()]}</span>
              <strong>{date.getDate()}</strong>
              <small>{day.tasks.length} 项</small>
            </button>
          );
        })}
      </div>

      <section className="surface-card week-day-card" aria-labelledby="selected-day-title">
        <div className="week-day-card__heading">
          <div>
            <p>{selectedDay.date === today ? "今天" : selectedDay.date < today ? "本周记录" : "待安排"}</p>
            <h2 id="selected-day-title">{formatFullDate(selectedDay.date)}</h2>
          </div>
          <button
            type="button"
            className="button button--primary"
            disabled={selectedDay.date < today}
            onClick={() => setFormOpen(true)}
          >添加到这天</button>
        </div>

        <div className="week-day-card__metrics" aria-label="当天计划概览">
          <span><strong>{selectedDay.tasks.length}</strong> 项</span>
          <span><strong>{formatTrackedTime(selectedDay.estimatedMinutes)}</strong> 预计</span>
          <span><strong>{formatTrackedTime(selectedDay.actualMinutes)}</strong> 实际</span>
        </div>

        {selectedDay.tasks.length === 0 ? (
          <div className="week-day-card__empty">
            <strong>这一天还很空</strong>
            <p>{selectedDay.date < today ? "当天没有留下任务记录。" : "可以安排一件真正重要的小事。"}</p>
          </div>
        ) : (
          <ol className="week-task-list">
            {selectedDay.tasks.map((task) => (
              <WeekTaskCard
                key={task.id}
                task={task}
                canToggle={task.date <= today}
                onMove={setMovingTask}
                onToggle={toggleTask}
              />
            ))}
          </ol>
        )}
      </section>

      {movingTask && (
        <section className="surface-card week-move-panel" aria-label={`为“${movingTask.title}”选择新日期`}>
          <div>
            <p>把“{movingTask.title}”改到</p>
            <button type="button" onClick={() => setMovingTask(undefined)}>取消</button>
          </div>
          <div className="week-move-panel__dates">
            {days.map((day) => (
              <button
                key={day.date}
                type="button"
                disabled={day.date < today || day.date === movingTask.date}
                onClick={() => chooseMoveDate(day.date)}
              >
                <span>{formatMonthDay(day.date)}</span>
                <small>{day.tasks.length} 项 · {formatTrackedTime(day.estimatedMinutes)}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {formOpen && (
        <TaskForm
          categories={state.categories}
          today={today}
          defaultDate={selectedDay.date}
          error={error}
          onSubmit={saveTask}
          onCancel={() => setFormOpen(false)}
        />
      )}
    </section>
  );
}
