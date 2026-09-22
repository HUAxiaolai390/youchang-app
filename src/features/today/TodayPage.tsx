import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppState } from "../../app/AppStateProvider";
import { CatMascot } from "../../components/CatMascot";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DisplayNameDialog } from "../../components/DisplayNameDialog";
import { TimeEntryDialog } from "../../components/TimeEntryDialog";
import { TimeAllocationCard } from "../../components/TimeAllocationCard";
import { TaskReminderOverview } from "../../components/TaskReminderOverview";
import { assignTaskCatVariants } from "../../components/TaskCatAnimation";
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

function getLocalGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function taskElementId(task: Pick<TodayTask, "kind" | "id">): string {
  return `today-task-${task.kind}-${task.id}`;
}

export function TodayPage({ onOpenAchievements }: { onOpenAchievements?: () => void }) {
  const { state, dispatch, error } = useAppState();
  const [now, setNow] = useState(() => new Date());
  const today = toDateKey(now);
  const [filter, setFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EditingTask>();
  const [deleting, setDeleting] = useState<TodayTask>();
  const [timing, setTiming] = useState<TodayTask>();
  const [habitTask, setHabitTask] = useState<TodayTask>();
  const [displayNameOpen, setDisplayNameOpen] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);
  const [taskToReveal, setTaskToReveal] = useState<string>();
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusRunning, setFocusRunning] = useState(false);
  const [timeAllocationOpen, setTimeAllocationOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const progress = getTodayProgress(state, now);
  const todayTime = getTimeAllocation(state, today, today);
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
        plannedStartTime: task.plannedStartTime, reminderMinutesBefore: task.reminderMinutesBefore,
        priority: task.priority,
        steps: task.steps,
        actualMinutes: task.actualMinutes
      }))
    };
  }, [state.categories, state.fixedRecords, state.fixedTasks, state.goals, state.scheduledTasks, today]);

  const fixedTasks = allFixedTasks.filter((task) => filter === "all" || filter === task.categoryId);
  const scheduledTasks = allScheduledTasks.filter((task) => filter === "all" || filter === task.categoryId);
  const todayTasks = useMemo(() => [...fixedTasks, ...scheduledTasks].sort((first, second) => {
    const priorityOrder = taskPriorityRank(first.priority) - taskPriorityRank(second.priority);
    if (priorityOrder !== 0) return priorityOrder;
    const firstTime = first.plannedStartTime ?? "99:99";
    const secondTime = second.plannedStartTime ?? "99:99";
    return firstTime.localeCompare(secondTime, "zh-CN") || first.title.localeCompare(second.title, "zh-CN");
  }), [fixedTasks, scheduledTasks]);
  const todayCatVariants = useMemo(() => {
    const tasks = [...allFixedTasks, ...allScheduledTasks];
    const variants = assignTaskCatVariants(tasks.map((task) => ({
      taskKey: `${task.kind}:${task.taskId}`,
      title: task.title,
      categoryId: task.categoryId,
      categoryName: task.categoryName
    })));
    return new Map(tasks.map((task, index) => [`${task.kind}:${task.taskId}`, variants[index]]));
  }, [allFixedTasks, allScheduledTasks]);
  const pendingTasks = useMemo(() => [...allFixedTasks, ...allScheduledTasks]
    .filter((task) => !task.completed)
    .sort((first, second) => {
      const priorityOrder = taskPriorityRank(first.priority) - taskPriorityRank(second.priority);
      if (priorityOrder !== 0) return priorityOrder;
      const firstTime = first.plannedStartTime ?? "99:99";
      const secondTime = second.plannedStartTime ?? "99:99";
      return firstTime.localeCompare(secondTime, "zh-CN") || first.title.localeCompare(second.title, "zh-CN");
    }), [allFixedTasks, allScheduledTasks]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!taskToReveal) return;
    const target = document.getElementById(taskToReveal);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.focus({ preventScroll: true });
    setTaskToReveal(undefined);
  }, [filter, taskToReveal]);

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
          plannedStartTime: values.plannedStartTime, reminderMinutesBefore: values.reminderMinutesBefore,
          priority: values.priority,
          steps: values.steps,
          repeatRule: values.repeatRule
        } });
      } else {
        saved = dispatch({ type: "scheduled/update", id: editing.taskId, input: {
          title: values.title, categoryId: values.categoryId, scheduledDate: values.date,
          goalId: values.goalId,
          plannedStartTime: values.plannedStartTime, reminderMinutesBefore: values.reminderMinutesBefore,
          priority: values.priority,
          steps: values.steps
        } });
      }
    } else if (values.kind === "fixed") {
      saved = dispatch({ type: "fixed/add", input: {
        title: values.title, categoryId: values.categoryId, activeFrom: today,
        goalId: values.goalId,
        plannedStartTime: values.plannedStartTime, reminderMinutesBefore: values.reminderMinutesBefore,
        priority: values.priority,
        steps: values.steps,
        repeatRule: values.repeatRule
      } });
    } else {
      saved = dispatch({ type: "scheduled/add", input: {
        title: values.title, categoryId: values.categoryId, scheduledDate: values.date,
        goalId: values.goalId,
        plannedStartTime: values.plannedStartTime, reminderMinutesBefore: values.reminderMinutesBefore,
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
    priority: editing.priority ?? "medium",
    steps: editing.steps,
    completed: editing.completed,
    repeatRule: editing.repeatRule
  } : undefined;

  const focusVisible = focusOpen || focusRunning;
  const celebrateFocus = useCallback(() => {
    setCelebrationKey((current) => current + 1);
  }, []);

  function openNewTask() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function saveDisplayName(value: string) {
    if (dispatch({ type: "settings/name", value })) setDisplayNameOpen(false);
  }

  function revealTask(task: TodayTask) {
    setFilter("all");
    setTodoOpen(false);
    setTaskToReveal(taskElementId(task));
  }

  return (
    <div className={`today-page${focusVisible ? " today-page--focus-open" : ""}`}>
      <header className="today-hero surface-card" aria-label="今日概览">
        <div className="today-hero__copy">
          <div className="today-hero__topline">
            <p>{formatToday(now)}</p>
            <span>日日有常，步步有长。</span>
          </div>
          <h1>
            <button type="button" className="today-hero__name-button" title="点击修改称呼" onClick={() => setDisplayNameOpen(true)}>
              <span>{getLocalGreeting(now)}，{state.settings.displayName || "朋友"}</span>
              <small>修改</small>
            </button>
          </h1>
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
        <section className={`today-todo${todoOpen ? " today-todo--open" : ""}`} aria-label="待办清单">
          <button
            type="button"
            className="today-todo__toggle"
            aria-expanded={todoOpen}
            onClick={() => setTodoOpen((open) => !open)}
          >
            <span className="today-todo__copy">
              <span className="today-todo__label">待办清单</span>
              <strong>{pendingTasks.length > 0 ? `${pendingTasks.length} 项未完成` : progress.total > 0 ? "今天的任务都完成了" : "今天还没有安排"}</strong>
              <small>{pendingTasks.length > 0 ? "点开查看并快速定位任务" : progress.total > 0 ? "今天做得很好" : "先放进一件想完成的小事"}</small>
            </span>
            <span className="today-todo__action">{todoOpen ? "收起" : "查看"}</span>
          </button>
          {todoOpen && pendingTasks.length > 0 && <ul className="today-todo__list">
            {pendingTasks.map((task) => (
              <li key={`${task.kind}-${task.id}`}>
                <button type="button" onClick={() => revealTask(task)}>
                  <span>
                    <strong>{task.title}</strong>
                    <small>{[task.categoryName, task.plannedStartTime].filter(Boolean).join(" · ")}</small>
                  </span>
                  <em>查看任务</em>
                </button>
              </li>
            ))}
          </ul>}
          {todoOpen && pendingTasks.length === 0 && progress.total === 0 && <button type="button" className="button today-todo__add" onClick={openNewTask}>添加第一项</button>}
        </section>
      </header>
      <section className="surface-card today-achievements" aria-labelledby="today-achievements-title">
        <div className="today-achievements__heading">
          <span>MY MEDALS</span>
          <strong id="today-achievements-title">我的勋章</strong>
          <a
            href="#achievements"
            aria-label="我的勋章，查看全部"
            onClick={(event) => {
              if (onOpenAchievements) {
                event.preventDefault();
                onOpenAchievements();
              }
            }}
          >
            查看全部
          </a>
          {onOpenAchievements && <button type="button" className="visually-hidden" aria-label="管理" onClick={onOpenAchievements}>管理</button>}
        </div>
      </section>
      <section className={`focus-drawer surface-card${focusVisible ? " focus-drawer--open" : ""}`} aria-label="专注工具">
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
      <TaskList title="今日任务" tasks={todayTasks} assignedCatVariants={todayCatVariants} onToggle={toggle} onStepToggle={toggleStep} onEdit={openEdit} onDelete={setDeleting} onTime={setTiming} onHabit={setHabitTask} />
      <details className="today-collapsible" open={timeAllocationOpen} onToggle={(event) => setTimeAllocationOpen(event.currentTarget.open)}>
        <summary>
          <span>时间分配</span>
          <button type="button" aria-label={timeAllocationOpen ? "收起时间分配" : "展开时间分配"} aria-expanded={timeAllocationOpen} onClick={(event) => {
            event.preventDefault();
            setTimeAllocationOpen((open) => !open);
          }}>
            {timeAllocationOpen ? "收起" : "展开"}
          </button>
        </summary>
        <TimeAllocationCard now={now} />
      </details>
      <details className="today-collapsible" open={historyOpen} onToggle={(event) => setHistoryOpen(event.currentTarget.open)}>
        <summary>
          <span>历史记录</span>
          <button type="button" aria-label={historyOpen ? "收起历史记录" : "展开历史记录"} aria-expanded={historyOpen} onClick={(event) => {
            event.preventDefault();
            setHistoryOpen((open) => !open);
          }}>
            {historyOpen ? "收起" : "展开"}
          </button>
        </summary>
        <Backlog now={now} />
      </details>
      <button type="button" className="add-task-button" aria-label="添加任务" onClick={openNewTask}>＋<span>添加任务</span></button>
      {formOpen && <TaskForm categories={state.categories} goals={state.goals ?? []} today={today} initialValues={formValues} error={error} onSubmit={saveTask} onCancel={closeForm} />}
      {deleting && <ConfirmDialog title="删除任务？" message={`确定删除“${deleting.title}”吗？`} confirmLabel="删除" onConfirm={confirmDelete} onCancel={() => setDeleting(undefined)} />}
      {timing && <TimeEntryDialog taskTitle={timing.title} currentMinutes={timing.actualMinutes} onSave={saveActualTime} onCancel={() => setTiming(undefined)} />}
      {habitTask && <HabitDetailDialog templateId={habitTask.taskId} onClose={() => setHabitTask(undefined)} />}
      {displayNameOpen && <DisplayNameDialog currentName={state.settings.displayName} onSave={saveDisplayName} onCancel={() => setDisplayNameOpen(false)} />}
    </div>
  );
}
