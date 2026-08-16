import { useState, type FormEvent } from "react";
import { useAppState } from "../../app/AppStateProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { TaskCatAnimation } from "../../components/TaskCatAnimation";
import { fromDateKey, toDateKey } from "../../domain/date";
import { getGoalsProgress, maximumGoals, maximumGoalTitleLength } from "../../domain/goals";
import { formatTrackedTime } from "../../domain/time";
import type { DateKey, Goal } from "../../domain/types";

function defaultDeadline(now: Date): DateKey {
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + 30);
  return toDateKey(deadline);
}

function formatDeadline(deadline: DateKey): string {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" })
    .format(fromDateKey(deadline));
}

function deadlineStatus(daysRemaining: number, completed: number, total: number): string {
  if (total > 0 && completed === total) return "当前任务已完成";
  if (daysRemaining < 0) return `已截止 ${Math.abs(daysRemaining)} 天`;
  if (daysRemaining === 0) return "今天截止";
  return `还剩 ${daysRemaining} 天`;
}

export function GoalSection({ now = new Date() }: { now?: Date }) {
  const { state, dispatch } = useAppState();
  const goals = state.goals ?? [];
  const progressItems = getGoalsProgress(state, now);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal>();
  const [deleting, setDeleting] = useState<Goal>();
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState<DateKey>(() => defaultDeadline(now));

  function openCreate() {
    setEditing(undefined);
    setTitle("");
    setDeadline(defaultDeadline(now));
    setFormOpen(true);
  }

  function openEdit(goal: Goal) {
    setEditing(goal);
    setTitle(goal.title);
    setDeadline(goal.deadline);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(undefined);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = editing
      ? dispatch({ type: "goal/update", id: editing.id, title, deadline })
      : dispatch({ type: "goal/add", title, deadline });
    if (saved) closeForm();
  }

  function confirmDelete() {
    if (!deleting) return;
    if (dispatch({ type: "goal/delete", id: deleting.id })) setDeleting(undefined);
  }

  return (
    <section className="surface-card goal-section" aria-labelledby="goal-section-title">
      <div className="goal-section__heading">
        <div>
          <p>LONG-TERM GOALS</p>
          <h2 id="goal-section-title">长期目标</h2>
          <span>把每天的任务，连接到真正想完成的事。</span>
        </div>
        <button type="button" className="button button--primary" onClick={openCreate} disabled={goals.length >= maximumGoals}>新增目标</button>
      </div>

      {formOpen && <form className="goal-form" onSubmit={save} aria-label={editing ? `编辑目标：${editing.title}` : "新增长期目标"}>
        <label>
          <span>目标名称</span>
          <input className="field-control" aria-label="目标名称" value={title} maxLength={maximumGoalTitleLength} placeholder="例如：通过英语六级" onChange={(event) => setTitle(event.target.value)} autoFocus />
          <small>{title.length}/{maximumGoalTitleLength}</small>
        </label>
        <label>
          <span>截止日期</span>
          <input className="field-control" aria-label="目标截止日期" type="date" min={editing && editing.deadline < toDateKey(now) ? editing.deadline : toDateKey(now)} value={deadline} onChange={(event) => setDeadline(event.target.value as DateKey)} />
        </label>
        <div className="goal-form__actions">
          <button type="button" className="button" onClick={closeForm}>取消</button>
          <button type="submit" className="button button--primary">{editing ? "保存目标" : "创建目标"}</button>
        </div>
      </form>}

      {progressItems.length === 0 ? (
        <div className="goal-section__empty">
          <strong>还没有长期目标</strong>
          <p>先写下一个真正想完成的结果，再把每天的任务关联过去。</p>
        </div>
      ) : (
        <div className="goal-grid">
          {progressItems.map(({ goal, completedTasks, totalTasks, ratio, actualMinutes, daysRemaining }) => (
            <article className="goal-card" key={goal.id}>
              <div className="goal-card__topline">
                <span>{deadlineStatus(daysRemaining, completedTasks, totalTasks)}</span>
                <div>
                  <button type="button" onClick={() => openEdit(goal)} aria-label={`编辑目标：${goal.title}`}>编辑</button>
                  <button type="button" onClick={() => setDeleting(goal)} aria-label={`删除目标：${goal.title}`}>删除</button>
                </div>
              </div>
              <h3>{goal.title}</h3>
              <p>{formatDeadline(goal.deadline)} 截止</p>
              <TaskCatAnimation
                className="goal-card__cat"
                taskKey={`goal:${goal.id}`}
                title={goal.title}
                completed={totalTasks > 0 && completedTasks === totalTasks}
              />
              <div className="goal-card__progress" aria-label={`${goal.title}进度：${completedTasks}/${totalTasks}`}>
                <span style={{ width: `${ratio * 100}%` }} />
              </div>
              <div className="goal-card__metrics">
                <span><strong>{completedTasks}/{totalTasks}</strong>{totalTasks ? "关联任务已完成" : "尚未关联任务"}</span>
                <span><strong>{formatTrackedTime(actualMinutes)}</strong>累计投入</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {deleting && <ConfirmDialog
        title="删除长期目标？"
        message={`删除“${deleting.title}”后，已有任务会保留，但不再关联这个目标。`}
        confirmLabel="删除目标"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(undefined)}
      />}
    </section>
  );
}
