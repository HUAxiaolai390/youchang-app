import { formatPlanComparison } from "../../domain/planning";
import { formatReminderMinutes } from "../../domain/reminders";
import { formatTaskPriority } from "../../domain/priorities";
import type { FixedRepeatRule, ReminderMinutesBefore, TaskPriority, TimeKey } from "../../domain/types";

export type TodayTask = {
  id: string;
  taskId: string;
  kind: "fixed" | "scheduled";
  title: string;
  categoryId: string;
  categoryName: string;
  completed: boolean;
  editable: boolean;
  plannedStartTime?: TimeKey;
  reminderMinutesBefore?: ReminderMinutesBefore;
  estimatedMinutes?: number;
  actualMinutes?: number;
  priority?: TaskPriority;
  repeatRule?: FixedRepeatRule;
  repeatLabel?: string;
};

type TaskListProps = {
  title: string;
  tasks: TodayTask[];
  onToggle(task: TodayTask): void;
  onEdit(task: TodayTask): void;
  onDelete(task: TodayTask): void;
  onTime(task: TodayTask): void;
};

export function TaskList({ title, tasks, onToggle, onEdit, onDelete, onTime }: TaskListProps) {
  return (
    <section className="task-list" aria-labelledby={`${title}-title`}>
      <div className="task-list__header"><h2 id={`${title}-title`}>{title}</h2><span>{tasks.length} 项</span></div>
      {tasks.length === 0 ? <p className="task-list__empty">暂时没有任务</p> : (
        <ul className="task-list__items">
          {tasks.map((task) => (
            <li className={`task-item${task.completed ? " task-item--completed" : ""}`} key={task.id}>
              <label className="task-item__check">
                <input type="checkbox" checked={task.completed} onChange={() => onToggle(task)} aria-label={`完成：${task.title}`} />
                <span aria-hidden="true" />
              </label>
              <div className="task-item__copy">
                <p><span className={`task-priority-tag task-priority-tag--${task.priority ?? "medium"}`}>{formatTaskPriority(task.priority)}</span>{task.title}</p>
                <span>
                  {task.categoryName}
                  {task.repeatLabel ? ` · ${task.repeatLabel}` : ""}
                  {task.plannedStartTime ? ` · ${task.plannedStartTime}` : ""}
                  {task.reminderMinutesBefore !== undefined ? ` · ${formatReminderMinutes(task.reminderMinutesBefore)}` : ""}
                  {` · ${formatPlanComparison(task.estimatedMinutes, task.actualMinutes)}`}
                </span>
              </div>
              <div className="task-item__actions">
                <button type="button" onClick={() => onTime(task)} aria-label={`记录用时：${task.title}`}>用时</button>
                {task.editable && <button type="button" onClick={() => onEdit(task)} aria-label={`编辑：${task.title}`}>编辑</button>}
                <button type="button" onClick={() => onDelete(task)} aria-label={`删除：${task.title}`}>删除</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
