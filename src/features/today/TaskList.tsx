import { useState } from "react";
import { assignTaskCatVariants, TaskCatAnimation } from "../../components/TaskCatAnimation";
import { formatReminderMinutes } from "../../domain/reminders";
import { formatTaskPriority } from "../../domain/priorities";
import { getTaskStepProgress } from "../../domain/steps";
import type { FixedRepeatRule, ReminderMinutesBefore, TaskPriority, TaskStep, TimeKey } from "../../domain/types";

export type TodayTask = {
  id: string;
  taskId: string;
  kind: "fixed" | "scheduled";
  title: string;
  categoryId: string;
  categoryName: string;
  goalId?: string;
  goalTitle?: string;
  completed: boolean;
  editable: boolean;
  plannedStartTime?: TimeKey;
  reminderMinutesBefore?: ReminderMinutesBefore;
  actualMinutes?: number;
  priority?: TaskPriority;
  steps?: TaskStep[];
  repeatRule?: FixedRepeatRule;
  repeatLabel?: string;
};

type TaskListProps = {
  title: string;
  tasks: TodayTask[];
  assignedCatVariants?: ReadonlyMap<string, string>;
  onToggle(task: TodayTask): void;
  onStepToggle(task: TodayTask, stepId: string): void;
  onEdit(task: TodayTask): void;
  onDelete(task: TodayTask): void;
  onTime(task: TodayTask): void;
  onHabit?(task: TodayTask): void;
};

export function TaskList({ title, tasks, assignedCatVariants, onToggle, onStepToggle, onEdit, onDelete, onTime, onHabit }: TaskListProps) {
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());
  const fallbackCatVariants = assignTaskCatVariants(tasks.map((task) => ({
    taskKey: `${task.kind}:${task.taskId}`,
    title: task.title,
    categoryId: task.categoryId,
    categoryName: task.categoryName
  })));

  function toggleExpanded(taskId: string) {
    setExpandedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  return (
    <section className="task-list" aria-labelledby={`${title}-title`}>
      <div className="task-list__header">
        <h2 id={`${title}-title`}>{title}</h2>
        <span>{tasks.length} 项</span>
      </div>
      {tasks.length === 0 ? <p className="task-list__empty">暂时没有任务</p> : (
        <ul className="task-list__items">
          {tasks.map((task, index) => {
            const stepProgress = getTaskStepProgress(task.steps);
            const stepsExpanded = expandedTaskIds.has(task.id);
            return <li id={`today-task-${task.kind}-${task.id}`} tabIndex={-1} className={`task-item${task.completed ? " task-item--completed" : ""}`} key={task.id}>
              <label className="task-item__check">
                <input type="checkbox" checked={task.completed} onChange={() => onToggle(task)} aria-label={`完成：${task.title}`} />
                <span aria-hidden="true" />
              </label>
              <div className="task-item__copy">
                <p>
                  <span className={`task-source-tag task-source-tag--${task.kind}`}>{task.kind === "fixed" ? "固定" : "今日"}</span>
                  <span className={`task-priority-tag task-priority-tag--${task.priority ?? "medium"}`}>{formatTaskPriority(task.priority)}</span>
                  {task.title}
                </p>
                <span>
                  {task.categoryName}
                  {task.goalTitle ? ` · 目标：${task.goalTitle}` : ""}
                  {task.repeatLabel ? ` · ${task.repeatLabel}` : ""}
                  {task.plannedStartTime ? ` · ${task.plannedStartTime}` : ""}
                  {task.reminderMinutesBefore !== undefined ? ` · ${formatReminderMinutes(task.reminderMinutesBefore)}` : ""}
                  {task.actualMinutes ? ` · 实际 ${task.actualMinutes} 分钟` : ""}
                </span>
              </div>
              <div className="task-item__actions">
                {task.kind === "fixed" && onHabit && <button type="button" className="task-item__habit" onClick={() => onHabit(task)} aria-label={`习惯详情：${task.title}`}>趋势</button>}
                {stepProgress.total > 0 && <button
                  type="button"
                  className="task-item__step-toggle"
                  aria-expanded={stepsExpanded}
                  aria-label={`${stepsExpanded ? "收起" : "展开"}步骤：${task.title}`}
                  onClick={() => toggleExpanded(task.id)}
                >步骤 {stepProgress.completed}/{stepProgress.total}</button>}
                <button type="button" onClick={() => onTime(task)} aria-label={`记录用时：${task.title}`}>用时</button>
                {task.editable && <button type="button" onClick={() => onEdit(task)} aria-label={`编辑：${task.title}`}>编辑</button>}
                <button type="button" onClick={() => onDelete(task)} aria-label={`删除：${task.title}`}>删除</button>
              </div>
              <TaskCatAnimation
                className="task-item__cat"
                taskKey={`${task.kind}:${task.taskId}`}
                title={task.title}
                categoryId={task.categoryId}
                categoryName={task.categoryName}
                completed={task.completed}
                variant={assignedCatVariants?.get(`${task.kind}:${task.taskId}`) ?? fallbackCatVariants[index]}
              />
              {stepProgress.total > 0 && <div className="task-item__step-progress" aria-label={`${task.title}步骤进度：${stepProgress.completed}/${stepProgress.total}`}>
                <span style={{ width: `${stepProgress.ratio * 100}%` }} />
              </div>}
              {stepsExpanded && task.steps && <ol className="task-item__steps">
                {task.steps.map((step, index) => (
                  <li key={step.id} className={step.completed ? "task-item__step--completed" : undefined}>
                    <label>
                      <input
                        type="checkbox"
                        checked={step.completed}
                        onChange={() => onStepToggle(task, step.id)}
                        aria-label={`完成步骤：${task.title} - ${step.title}`}
                      />
                      <span aria-hidden="true" />
                      <small>{index + 1}</small>
                      <strong>{step.title}</strong>
                    </label>
                  </li>
                ))}
              </ol>}
            </li>;
          })}
        </ul>
      )}
    </section>
  );
}
