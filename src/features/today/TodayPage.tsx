import { useCallback, useMemo, useRef, useState } from "react";
import { useAppState } from "../../app/AppStateProvider";
import { CatMascot } from "../../components/CatMascot";
import { AchievementMedal } from "../../components/AchievementMedal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { TimeEntryDialog } from "../../components/TimeEntryDialog";
import { TaskReminderOverview } from "../../components/TaskReminderOverview";
import { achievementTierLabels, getFeaturedAchievements } from "../../domain/achievements";
import { toDateKey } from "../../domain/date";
import { getCatMessage, getTodayProgress } from "../../domain/stats";
import { formatFixedRepeatRule } from "../../domain/repeat";
import { taskPriorityRank } from "../../domain/priorities";
import { formatTrackedTime, getTimeAllocation } from "../../domain/time";
import type { DateKey } from "../../domain/types";
import { TaskForm, type TaskFormValues } from "./TaskForm";
import { TaskList, type TodayTask } from "./TaskList";
import { Backlog } from "../backlog/Backlog";
import { FocusTimer } from "../focus/FocusTimer";
import { HabitDetailDialog } from "./HabitDetailDialog";

type EditingTask = TodayTask & { date: DateKey };

function formatToday(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(date);
}

export function TodayPage({ onOpenAchievements }: { onOpenAchievements?: () => void }) {
  const { state, dispatch, error } = useAppState();
  const now = new Date();
  const today = toDateKey(now);
  const [filter, setFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EditingTask>();
  const [deleting, setDeleting] = useState<TodayTask>();
  const [timing, setTiming] = useState<TodayTask>();
  const [habitTask, setHabitTask] = useState<TodayTask>();
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusRunning, setFocusRunning] = useState(false);
  const focusDrawerRef = useRef<HTMLElement>(null);
  const progress = getTodayProgress(state, now);
  const todayTime = getTimeAllocation(state, today, today);
  const featuredAchievements = getFeaturedAchievements(state, now);

  const { allFixedTasks, allScheduledTasks } = useMemo(() => {
    const templatesById = new Map(state.fixedTasks.map((task) => [task.id, task]));
    const categoriesById = new Map(state.categories.map((category) => [category.id, category.name]));
    const goalsById = new Map((state.goals ?? []).map((goal) => [goal.id, goal.title]));
    const liveCategoryName = (categoryId: string) => categoriesById.get(categoryId) ?? categoriesById.get("other") ?? "其他";
    return {
      allFixedTasks: state.fixedRecords.filter((record) => {
        const template = templatesById.get(record.templateId);
        if (!template) return false;
        return record.date === today
          && template.activeFrom <= today
          && (!template.inactiveFrom || today < template.inactiveFrom);
      }).map((record): TodayTask => {
        const template = templatesById.get(record.templateId)!;
        return {
          id: record.id, taskId: record.templateId, kind: "fixed", title: record.titleSnapshot, categoryId: record.categoryId,
          categoryName: liveCategoryName(record.categoryId), completed: Boolean(record.completedAt), editable: true,
          goalId: record.goalId ?? template.goalId,
          goalTitle: goalsById.get(record.goalId ?? template.goalId ?? ""),
          plannedStartTime: record.plannedStartTime ?? template.plannedStartTime,
          reminderMinutesBefore: record.reminderMinutesBefore ?? template.reminderMinutesBefore,
          priority: record.priority ?? template.priority,
          steps: record.steps ?? template.steps,
          estimatedMinutes: record.estimatedMinutes ?? template.estimatedMinutes,
          actualMinutes: record.actualMinutes,
          repeatRule: template.repeatRule,
          repeatLabel: formatFixedRepeatRule(template.repeatRule)
        };
      }),
      allScheduledTasks: state.scheduledTasks.filter((task) => (
        task.scheduledDate === today && !["rescheduled", "archived"].includes(task.status)
      )).map((task): TodayTask => ({
        id: task.id, taskId: task.id, kind: "scheduled", title: task.title, categoryId: task.categoryId,
        categoryName: liveCategoryName(task.categoryId), completed: task.status === "completed", editable: ["pending", "completed"].includes(task.status),
        goalId: task.goalId,
        goalTitle: goalsById.get(task.goalId ?? ""),
        plannedStartTime: task.plannedStartTime, reminderMinutesBefore: task.reminderMinutesBefore, estimatedMinutes: task.estimatedMinutes,
        priority: task.priority,
        steps: task.steps,
        actualMinutes: task.actualMinutes
      }))
    };
  }, [state.categories, state.fixedRecords, state.fixedTasks, state.goals, state.scheduledTasks, today]);

  const fixedTasks = allFixedTasks.filter((task) => filter === "all" || filter === task.categoryId);
  const scheduledTasks = allScheduledTasks.filter((task) => filter === "all" || filter === task.categoryId);
  const nextTask = useMemo(() => [...allFixedTasks, ...allScheduledTasks]
    .filter((task) => !task.completed)
    .sort((first, second) => {
      const priorityOrder = taskPriorityRank(first.priority) - taskPriorityRank(second.priority);
      if (priorityOrder !== 0) return priorityOrder;
      const firstTime = first.plannedStartTime ?? "99:99";
      const secondTime = second.plannedStartTime ?? "99:99";
      return firstTime.localeCompare(secondTime, "zh-CN") || first.title.localeCompare(second.title, "zh-CN");
    })[0], [allFixedTasks, allScheduledTasks]);

  function openEdit(task: TodayTask) {
    setEditing({ ...task, date: task.kind === "scheduled" ? today : today });
    setFormOpen(true);
  }

  function saveTask(values: TaskFormValues) {
    let saved: boolean;
    if (editing) {
      if (editing.kind === "fixed") {
        saved = dispatch({ type: "fixed/update", id: editing.taskId, input: {
          title: values.title, categoryId: values.categoryId,
          goalId: values.goalId,
          plannedStartTime: values.plannedStartTime, reminderMinutesBefore: values.reminderMinutesBefore, estimatedMinutes: values.estimatedMinutes,
          priority: values.priority,
          steps: values.steps,
          repeatRule: values.repeatRule
        } });
      } else {
        saved = dispatch({ type: "scheduled/update", id: editing.taskId, input: {
          title: values.title, categoryId: values.categoryId, scheduledDate: values.date,
          goalId: values.goalId,
          plannedStartTime: values.plannedStartTime, reminderMinutesBefore: values.reminderMinutesBefore, estimatedMinutes: values.estimatedMinutes,
          priority: values.priority,
          steps: values.steps
        } });
      }
    } else if (values.kind === "fixed") {
      saved = dispatch({ type: "fixed/add", input: {
        title: values.title, categoryId: values.categoryId, activeFrom: today,
        goalId: values.goalId,
        plannedStartTime: values.plannedStartTime, reminderMinutesBefore: values.reminderMinutesBefore, estimatedMinutes: values.estimatedMinutes,
        priority: values.priority,
        steps: values.steps,
        repeatRule: values.repeatRule
      } });
    } else {
      saved = dispatch({ type: "scheduled/add", input: {
        title: values.title, categoryId: values.categoryId, scheduledDate: values.date,
        goalId: values.goalId,
        plannedStartTime: values.plannedStartTime, reminderMinutesBefore: values.reminderMinutesBefore, estimatedMinutes: values.estimatedMinutes,
        priority: values.priority,
        steps: values.steps
      } });
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

  function toggleStep(task: TodayTask, stepId: string) {
    dispatch(task.kind === "fixed"
      ? { type: "fixed/step-toggle", recordId: task.id, stepId }
      : { type: "scheduled/step-toggle", id: task.id, stepId });
  }

  function confirmDelete() {
    if (!deleting) return;
    dispatch(deleting.kind === "fixed" ? { type: "fixed/set-active", id: deleting.taskId, active: false } : { type: "scheduled/delete", id: deleting.taskId });
    setDeleting(undefined);
  }

  function saveActualTime(minutes: number) {
    if (!timing) return;
    const saved = dispatch(timing.kind === "fixed"
      ? { type: "fixed/time-set", recordId: timing.id, minutes }
      : { type: "scheduled/time-set", id: timing.id, minutes });
    if (saved) setTiming(undefined);
  }

  const formValues = editing ? {
    title: editing.title,
    kind: editing.kind,
    categoryId: editing.categoryId,
    goalId: editing.goalId,
    date: editing.date,
    plannedStartTime: editing.plannedStartTime,
    reminderMinutesBefore: editing.reminderMinutesBefore,
    estimatedMinutes: editing.estimatedMinutes,
    priority: editing.priority ?? "medium",
    steps: editing.steps,
    completed: editing.completed,
    repeatRule: editing.repeatRule
  } : undefined;

  const focusVisible = focusOpen || focusRunning;
  const nextTaskDetails = nextTask ? [
    nextTask.categoryName,
    nextTask.plannedStartTime ? `${nextTask.plannedStartTime} 开始` : undefined,
    nextTask.estimatedMinutes ? `预计 ${nextTask.estimatedMinutes} 分钟` : undefined
  ].filter(Boolean).join(" · ") : "";
  const celebrateFocus = useCallback(() => {
    setCelebrationKey((current) => current + 1);
  }, []);

  function openNewTask() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openFocus() {
    setFocusOpen(true);
    focusDrawerRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  return (
    <div className={`today-page${focusVisible ? " today-page--focus-open" : ""}`}>
      <header className="today-hero surface-card" aria-label="今日概览">
        <div className="today-hero__copy">
          <div className="today-hero__topline">
            <p>{formatToday(now)}</p>
            <span>日日有常，步步有长。</span>
          </div>
          <h1>早上好，{state.settings.displayName || "朋友"}</h1>
          <p className="today-hero__cat-message">{getCatMessage(progress)}</p>
        </div>
        <CatMascot baseState={progress.total === 0 ? "sleep" : "idle"} celebrationKey={celebrationKey} />
        <section className="today-hero__progress" aria-label="今日完成进度">
          <div className="today-hero__metric">
            <span>今日完成</span>
            <strong>{progress.completed}<small> / {progress.total}</small></strong>
          </div>
          <div className="today-hero__bar" aria-hidden="true">
            <span style={{ width: `${progress.ratio * 100}%` }} />
          </div>
          <div className="today-hero__metric today-hero__metric--time">
            <span>今日记录</span>
            <strong>{formatTrackedTime(todayTime.totalMinutes)}</strong>
          </div>
        </section>
        <section className={`today-next${nextTask ? " today-next--ready" : ""}`} aria-label="下一项任务">
          <div>
            <span className="today-next__label">下一项</span>
            <strong>{nextTask
              ? `待办 · ${nextTask.title}`
              : progress.total > 0
                ? "今天的任务都完成了"
                : "今天还没有安排"}</strong>
            <small>{nextTask
              ? nextTaskDetails
              : progress.total > 0
                ? "做得很好，去成长页看看今天的积累吧"
                : "先放进一件今天最想完成的小事"}</small>
          </div>
          {nextTask
            ? <button type="button" className="button button--primary" onClick={openFocus}>开始下一项</button>
            : progress.total === 0
              ? <button type="button" className="button" onClick={openNewTask}>添加第一项</button>
              : null}
        </section>
      </header>
      <section className="surface-card today-achievements" aria-labelledby="today-achievements-title">
        <div className="today-achievements__heading">
          <span>MY MEDALS</span>
          <strong id="today-achievements-title">我的勋章</strong>
          {onOpenAchievements && <button type="button" onClick={onOpenAchievements}>管理</button>}
        </div>
        <div className="today-achievements__slots">
          {Array.from({ length: 3 }, (_, index) => {
            const achievement = featuredAchievements[index];
            return achievement ? (
              <div className="today-achievement-slot" key={achievement.id} aria-label={`${achievement.name}，${achievementTierLabels[achievement.tier]}`}>
                <AchievementMedal achievement={achievement} compact />
              </div>
            ) : (
              <div className="today-achievement-slot today-achievement-slot--empty" key={`empty-${index}`}>
                <span aria-hidden="true">＋</span>
                <small>待展示</small>
              </div>
            );
          })}
        </div>
      </section>
      <section className={`focus-drawer surface-card${focusVisible ? " focus-drawer--open" : ""}`} ref={focusDrawerRef} aria-label="专注工具">
        <button
          type="button"
          className="focus-drawer__toggle"
          aria-expanded={focusVisible}
          disabled={focusRunning}
          onClick={() => setFocusOpen((open) => !open)}
        >
          <span className="focus-drawer__icon" aria-hidden="true">◷</span>
          <span className="focus-drawer__copy">
            <strong>{focusRunning ? "专注进行中" : "专注计时"}</strong>
            <small>{focusRunning ? "计时期间会保持展开" : "倒计时或正计时，按需要展开"}</small>
          </span>
          <span className="focus-drawer__action">{focusRunning ? "进行中" : focusVisible ? "收起" : "展开"}</span>
        </button>
        <div className="focus-drawer__content" hidden={!focusVisible}>
          <FocusTimer onFocusComplete={celebrateFocus} onRunningChange={setFocusRunning} />
        </div>
      </section>
      <section className="category-filter" aria-label="任务分类筛选">
        <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>全部</button>
        {state.categories.map((category) => <button key={category.id} type="button" aria-label={`只看${category.name}`} aria-pressed={filter === category.id} onClick={() => setFilter(category.id)}>{category.name}</button>)}
      </section>
      <TaskReminderOverview />
      <TaskList title="固定任务" tasks={fixedTasks} onToggle={toggle} onStepToggle={toggleStep} onEdit={openEdit} onDelete={setDeleting} onTime={setTiming} onHabit={setHabitTask} />
      <TaskList title="今日安排" tasks={scheduledTasks} onToggle={toggle} onStepToggle={toggleStep} onEdit={openEdit} onDelete={setDeleting} onTime={setTiming} />
      <Backlog now={now} />
      <button type="button" className="add-task-button" aria-label="添加任务" onClick={openNewTask}>＋<span>添加任务</span></button>
      {formOpen && <TaskForm categories={state.categories} goals={state.goals ?? []} today={today} initialValues={formValues} error={error} onSubmit={saveTask} onCancel={closeForm} />}
      {deleting && <ConfirmDialog title="删除任务？" message={`确定删除“${deleting.title}”吗？`} confirmLabel="删除" onConfirm={confirmDelete} onCancel={() => setDeleting(undefined)} />}
      {timing && <TimeEntryDialog taskTitle={timing.title} currentMinutes={timing.actualMinutes} onSave={saveActualTime} onCancel={() => setTiming(undefined)} />}
      {habitTask && <HabitDetailDialog templateId={habitTask.taskId} onClose={() => setHabitTask(undefined)} />}
    </div>
  );
}
