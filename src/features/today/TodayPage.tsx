import { useMemo, useState } from "react";
import { useAppState } from "../../app/AppStateProvider";
import { CatMascot } from "../../components/CatMascot";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { toDateKey } from "../../domain/date";
import { getCatMessage, getTodayProgress } from "../../domain/stats";
import type { DateKey } from "../../domain/types";
import { TaskForm, type TaskFormValues } from "./TaskForm";
import { TaskList, type TodayTask } from "./TaskList";
import { Backlog } from "../backlog/Backlog";
import { FocusTimer } from "../focus/FocusTimer";

type EditingTask = TodayTask & { date: DateKey };

function formatToday(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(date);
}

export function TodayPage() {
  const { state, dispatch, error } = useAppState();
  const now = new Date();
  const today = toDateKey(now);
  const [filter, setFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EditingTask>();
  const [deleting, setDeleting] = useState<TodayTask>();
  const [celebrationKey, setCelebrationKey] = useState(0);
  const progress = getTodayProgress(state, now);

  const { fixedTasks, scheduledTasks } = useMemo(() => {
    const visible = (categoryId: string) => filter === "all" || filter === categoryId;
    const templatesById = new Map(state.fixedTasks.map((task) => [task.id, task]));
    const categoriesById = new Map(state.categories.map((category) => [category.id, category.name]));
    const liveCategoryName = (categoryId: string) => categoriesById.get(categoryId) ?? categoriesById.get("other") ?? "其他";
    return {
      fixedTasks: state.fixedRecords.filter((record) => {
        const template = templatesById.get(record.templateId);
        if (!template) return false;
        return record.date === today
          && visible(record.categoryId)
          && template.activeFrom <= today
          && (!template.inactiveFrom || today < template.inactiveFrom);
      }).map((record): TodayTask => ({
        id: record.id, taskId: record.templateId, kind: "fixed", title: record.titleSnapshot, categoryId: record.categoryId,
        categoryName: liveCategoryName(record.categoryId), completed: Boolean(record.completedAt), editable: true
      })),
      scheduledTasks: state.scheduledTasks.filter((task) => task.scheduledDate === today && visible(task.categoryId)).map((task): TodayTask => ({
        id: task.id, taskId: task.id, kind: "scheduled", title: task.title, categoryId: task.categoryId,
        categoryName: liveCategoryName(task.categoryId), completed: task.status === "completed", editable: task.status === "pending"
      }))
    };
  }, [filter, state.categories, state.fixedRecords, state.fixedTasks, state.scheduledTasks, today]);

  function openEdit(task: TodayTask) {
    setEditing({ ...task, date: task.kind === "scheduled" ? today : today });
    setFormOpen(true);
  }

  function saveTask(values: TaskFormValues) {
    let saved: boolean;
    if (editing) {
      if (editing.kind === "fixed") {
        saved = dispatch({ type: "fixed/update", id: editing.taskId, input: { title: values.title, categoryId: values.categoryId } });
      } else {
        saved = dispatch({ type: "scheduled/update", id: editing.taskId, input: { title: values.title, categoryId: values.categoryId, scheduledDate: values.date } });
      }
    } else if (values.kind === "fixed") {
      saved = dispatch({ type: "fixed/add", input: { title: values.title, categoryId: values.categoryId, activeFrom: today } });
    } else {
      saved = dispatch({ type: "scheduled/add", input: { title: values.title, categoryId: values.categoryId, scheduledDate: values.date } });
    }
    if (saved) {
      setFormOpen(false);
      setEditing(undefined);
    }
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(undefined);
  }

  function toggle(task: TodayTask) {
    const saved = dispatch(task.kind === "fixed" ? { type: "fixed/toggle", recordId: task.id } : { type: "scheduled/toggle", id: task.id });
    if (!task.completed && saved) setCelebrationKey((current) => current + 1);
  }

  function confirmDelete() {
    if (!deleting) return;
    dispatch(deleting.kind === "fixed" ? { type: "fixed/set-active", id: deleting.taskId, active: false } : { type: "scheduled/delete", id: deleting.taskId });
    setDeleting(undefined);
  }

  const formValues = editing ? {
    title: editing.title,
    kind: editing.kind,
    categoryId: editing.categoryId,
    date: editing.date
  } : undefined;

  return (
    <div className="today-page">
      <header className="today-hero surface-card">
        <div className="today-hero__copy">
          <p>{formatToday(now)}</p>
          <h1>早上好，{state.settings.displayName || "朋友"}</h1>
          <p className="today-hero__cat-message">{getCatMessage(progress)}</p>
          <p className="today-hero__mascot-hint">小猫会自己换动作，也可以点它切换 18 种待机动作。</p>
        </div>
        <CatMascot baseState={progress.total === 0 ? "sleep" : "idle"} celebrationKey={celebrationKey} />
      </header>
      <FocusTimer onFocusComplete={() => setCelebrationKey((current) => current + 1)} />
      <section className="progress-card surface-card" aria-label="今日完成进度">
        <div><p>今日完成</p><strong>{progress.completed}<span> / {progress.total}</span></strong></div>
        <div className="progress-card__bar" aria-hidden="true"><span style={{ width: `${progress.ratio * 100}%` }} /></div>
        <span className="progress-card__cat" aria-hidden="true">●ᴥ●</span>
      </section>
      <section className="category-filter" aria-label="任务分类筛选">
        <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>全部</button>
        {state.categories.map((category) => <button key={category.id} type="button" aria-label={`只看${category.name}`} aria-pressed={filter === category.id} onClick={() => setFilter(category.id)}>{category.name}</button>)}
      </section>
      <TaskList title="每日固定" tasks={fixedTasks} onToggle={toggle} onEdit={openEdit} onDelete={setDeleting} />
      <TaskList title="今日安排" tasks={scheduledTasks} onToggle={toggle} onEdit={openEdit} onDelete={setDeleting} />
      <Backlog now={now} />
      <button type="button" className="add-task-button" aria-label="添加任务" onClick={() => { setEditing(undefined); setFormOpen(true); }}>＋<span>添加任务</span></button>
      {formOpen && <TaskForm categories={state.categories} today={today} initialValues={formValues} error={error} onSubmit={saveTask} onCancel={closeForm} />}
      {deleting && <ConfirmDialog title="删除任务？" message={`确定删除“${deleting.title}”吗？`} confirmLabel="删除" onConfirm={confirmDelete} onCancel={() => setDeleting(undefined)} />}
    </div>
  );
}
