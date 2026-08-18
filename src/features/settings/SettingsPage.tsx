import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useAppState } from "../../app/AppStateProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { HelpCenterDialog } from "../../components/HelpCenterDialog";
import { RepeatRuleFields } from "../../components/RepeatRuleFields";
import { toDateKey } from "../../domain/date";
import { formatFixedRepeatRule, getFixedRepeatRule } from "../../domain/repeat";
import { formatReminderMinutes, normalizeReminderMinutesBefore, reminderMinuteOptions } from "../../domain/reminders";
import { formatTaskPriority, taskPriorityOptions } from "../../domain/priorities";
import type { AppState, Category, DateKey, FixedRepeatRule, FixedTaskTemplate, TaskPriority, TaskStep, TimeKey } from "../../domain/types";
import { downloadBackup, downloadTextFile, parseBackup } from "../../storage/backup";
import {
  listRecoverySnapshots,
  removeRecoverySnapshot,
  type RecoverySnapshot
} from "../../storage/repository";
import {
  checkExactAlarmPermission,
  checkSystemNotificationPermission,
  isNativeAndroid,
  openExactAlarmSettings,
  requestSystemNotificationPermission,
  syncNativeTaskNotifications,
  supportsSystemNotifications,
  type ExactAlarmPermission,
  type SystemNotificationPermission
} from "../../native/task-notifications";

function backupErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "备份文件版本不受支持") return "备份版本不受支持";
  return "备份文件格式不正确";
}

function backupSummary(state: AppState): string {
  return `将导入 ${state.scheduledTasks.length} 个临时任务、${state.fixedTasks.length} 个固定任务、${state.goals?.length ?? 0} 个目标和 ${state.categories.length} 个分类`;
}

function categoryName(categories: Category[], categoryId: string): string {
  return categories.find((category) => category.id === categoryId)?.name ?? "其他";
}

function stepsFromLines(value: string, current: TaskStep[] = []) {
  return value.split(/\r?\n/).map((title, index) => ({
    id: current[index]?.id,
    title,
    completed: current[index]?.completed
  }));
}

function fallbackCategoryId(categories: Category[]): string {
  return categories.find((category) => category.id === "other")?.id ?? categories[0]?.id ?? "";
}

function permissionLabel(permission: SystemNotificationPermission | ExactAlarmPermission): string {
  if (permission === "granted") return "已允许";
  if (permission === "denied") return "未允许";
  if (permission === "prompt") return "等待授权";
  return "不支持";
}

function formatBackupAt(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function FixedTaskEditSurface({ children, onCancel }: { children: ReactNode; onCancel(): void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canUseNativeDialog = typeof HTMLDialogElement !== "undefined" && "showModal" in HTMLDialogElement.prototype;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (canUseNativeDialog && dialog && !dialog.open) dialog.showModal();
    return () => {
      if (canUseNativeDialog && dialog?.open) dialog.close();
    };
  }, [canUseNativeDialog]);

  if (!canUseNativeDialog) {
    return <section className="task-form-panel fixed-task-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="fixed-task-edit-title">{children}</section>;
  }

  return <dialog ref={dialogRef} className="task-form-panel fixed-task-edit-dialog" aria-labelledby="fixed-task-edit-title" onCancel={onCancel}>{children}</dialog>;
}

function FixedTaskExceptionSurface({ children, onCancel }: { children: ReactNode; onCancel(): void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canUseNativeDialog = typeof HTMLDialogElement !== "undefined" && "showModal" in HTMLDialogElement.prototype;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (canUseNativeDialog && dialog && !dialog.open) dialog.showModal();
    return () => {
      if (canUseNativeDialog && dialog?.open) dialog.close();
    };
  }, [canUseNativeDialog]);

  if (!canUseNativeDialog) {
    return <section className="task-form-panel fixed-task-exception-dialog" role="dialog" aria-modal="true" aria-labelledby="fixed-task-exception-title">{children}</section>;
  }

  return <dialog ref={dialogRef} className="task-form-panel fixed-task-exception-dialog" aria-labelledby="fixed-task-exception-title" onCancel={onCancel}>{children}</dialog>;
}

export function SettingsPage() {
  const { state, dispatch } = useAppState();
  const [categoryNameInput, setCategoryNameInput] = useState("");
  const [categoryIconInput, setCategoryIconInput] = useState("分");
  const [fixedTaskError, setFixedTaskError] = useState<string>();
  const [editingFixedId, setEditingFixedId] = useState<string>();
  const [editingFixedTitle, setEditingFixedTitle] = useState("");
  const [editingFixedCategoryId, setEditingFixedCategoryId] = useState("study");
  const [editingFixedGoalId, setEditingFixedGoalId] = useState("");
  const [editingFixedPriority, setEditingFixedPriority] = useState<TaskPriority>("medium");
  const [editingFixedSteps, setEditingFixedSteps] = useState("");
  const [editingFixedStartTime, setEditingFixedStartTime] = useState("");
  const [editingFixedReminderMinutes, setEditingFixedReminderMinutes] = useState("");
  const [editingFixedRepeatRule, setEditingFixedRepeatRule] = useState<FixedRepeatRule>({ type: "daily" });
  const [exceptionFixedId, setExceptionFixedId] = useState<string>();
  const [exceptionDate, setExceptionDate] = useState<DateKey>(() => toDateKey(new Date()));
  const [pendingBackup, setPendingBackup] = useState<AppState>();
  const [backupError, setBackupError] = useState<string>();
  const [recoverySnapshots, setRecoverySnapshots] = useState<RecoverySnapshot[]>(
    () => listRecoverySnapshots(window.localStorage)
  );
  const [recoveryToDelete, setRecoveryToDelete] = useState<RecoverySnapshot>();
  const [categoryToDelete, setCategoryToDelete] = useState<Category>();
  const [fixedTaskToDelete, setFixedTaskToDelete] = useState<FixedTaskTemplate>();
  const [clearPhrase, setClearPhrase] = useState("");
  const [clearArmed, setClearArmed] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [helpCenterOpen, setHelpCenterOpen] = useState(false);
  const nativeAndroid = isNativeAndroid();
  const notificationsSupported = supportsSystemNotifications();
  const [notificationPermission, setNotificationPermission] = useState<SystemNotificationPermission>(
    nativeAndroid ? "prompt" : notificationsSupported
      ? Notification.permission === "default" ? "prompt" : Notification.permission
      : "unsupported"
  );
  const [exactAlarmPermission, setExactAlarmPermission] = useState<ExactAlarmPermission>(
    nativeAndroid ? "prompt" : "unsupported"
  );
  const [notificationDiagnosticsOpen, setNotificationDiagnosticsOpen] = useState(false);
  const systemNotificationsActive = Boolean(state.settings.systemNotificationsEnabled)
    && notificationPermission === "granted"
    && (!nativeAndroid || exactAlarmPermission === "granted");

  useEffect(() => {
    const fallback = fallbackCategoryId(state.categories);
    setEditingFixedCategoryId((current) => state.categories.some((category) => category.id === current) ? current : fallback);
  }, [state.categories]);

  useEffect(() => {
    const goals = state.goals ?? [];
    setEditingFixedGoalId((current) => current && !goals.some((goal) => goal.id === current) ? "" : current);
  }, [state.goals]);

  useEffect(() => {
    if (editingFixedId && !state.fixedTasks.some((task) => task.id === editingFixedId)) setEditingFixedId(undefined);
  }, [editingFixedId, state.fixedTasks]);

  useEffect(() => {
    if (!notificationsSupported) return;
    let active = true;
    const refreshPermission = () => {
      void checkSystemNotificationPermission().then((permission) => {
        if (active) setNotificationPermission(permission);
      });
      if (nativeAndroid) {
        void checkExactAlarmPermission().then((permission) => {
          if (active) setExactAlarmPermission(permission);
        });
      }
    };
    refreshPermission();
    window.addEventListener("focus", refreshPermission);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshPermission);
    };
  }, [notificationsSupported, nativeAndroid]);

  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dispatch({ type: "category/add", name: categoryNameInput, icon: categoryIconInput.trim() || "分" })) {
      setCategoryNameInput("");
      setCategoryIconInput("分");
    }
  }

  function beginEditFixedTask(task: FixedTaskTemplate) {
    setEditingFixedId(task.id);
    setEditingFixedTitle(task.title);
    setEditingFixedCategoryId(task.categoryId);
    setEditingFixedGoalId(task.goalId ?? "");
    setEditingFixedPriority(task.priority ?? "medium");
    setEditingFixedSteps(task.steps?.map((step) => step.title).join("\n") ?? "");
    setEditingFixedStartTime(task.plannedStartTime ?? "");
    setEditingFixedReminderMinutes(task.reminderMinutesBefore?.toString() ?? "");
    setEditingFixedRepeatRule(getFixedRepeatRule(task));
  }

  function saveFixedTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingFixedId) return;
    if (!state.categories.some((category) => category.id === editingFixedCategoryId)) {
      setFixedTaskError("没有可用分类，请先添加分类");
      return;
    }
    if (!editingFixedStartTime && editingFixedReminderMinutes !== "") {
      setFixedTaskError("设置提醒前，请先填写开始时间");
      return;
    }
    setFixedTaskError(undefined);
    if (dispatch({ type: "fixed/update", id: editingFixedId, input: {
      title: editingFixedTitle,
      categoryId: editingFixedCategoryId,
      goalId: editingFixedGoalId || undefined,
      priority: editingFixedPriority,
      steps: stepsFromLines(editingFixedSteps, state.fixedTasks.find((task) => task.id === editingFixedId)?.steps),
      plannedStartTime: editingFixedStartTime ? editingFixedStartTime as TimeKey : undefined,
      reminderMinutesBefore: editingFixedStartTime ? normalizeReminderMinutesBefore(editingFixedReminderMinutes) : undefined,
      repeatRule: editingFixedRepeatRule
    } })) {
      setEditingFixedId(undefined);
    }
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const imported = parseBackup(await file.text());
      setBackupError(undefined);
      setPendingBackup(imported);
    } catch (error) {
      setPendingBackup(undefined);
      setBackupError(backupErrorMessage(error));
    }
  }

  function confirmImport() {
    if (!pendingBackup) return;
    if (dispatch({ type: "backup/import", state: pendingBackup })) setPendingBackup(undefined);
  }

  async function exportBackup() {
    try {
      await downloadBackup(state);
      setBackupError(undefined);
      dispatch({ type: "settings/backup-exported", at: new Date().toISOString() });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setBackupError("未能导出备份，请重试");
    }
  }

  async function exportRecoverySnapshot(snapshot: RecoverySnapshot) {
    try {
      const safeTime = snapshot.createdAt.replace(/[:.]/g, "-");
      await downloadTextFile(snapshot.raw, `有常异常数据恢复-${safeTime}.json`);
      setBackupError(undefined);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setBackupError("未能导出恢复副本，请重试");
    }
  }

  async function refreshNotificationDiagnostics() {
    setNotificationDiagnosticsOpen(true);
    if (!notificationsSupported) return;
    const permission = await checkSystemNotificationPermission();
    setNotificationPermission(permission);
    if (nativeAndroid) setExactAlarmPermission(await checkExactAlarmPermission());
  }

  async function toggleSystemNotifications() {
    if (!notificationsSupported || notificationPermission === "denied") return;
    if (systemNotificationsActive) {
      dispatch({ type: "settings/system-notifications", enabled: false });
      return;
    }
    const permission = notificationPermission === "granted"
      ? "granted"
      : await requestSystemNotificationPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      dispatch({ type: "settings/system-notifications", enabled: true });
      dispatch({ type: "settings/wake-screen-reminders", enabled: true });
      if (nativeAndroid && exactAlarmPermission !== "granted") {
        const exactPermission = await openExactAlarmSettings();
        setExactAlarmPermission(exactPermission);
        if (exactPermission === "granted") {
          await syncNativeTaskNotifications({
            ...state,
            settings: {
              ...state.settings,
              systemNotificationsEnabled: true,
              wakeScreenForReminders: true
            }
          });
        }
      }
    }
  }

  const customCategories = state.categories.filter((category) => !category.builtIn);
  const managedFixedTasks = state.fixedTasks.filter((task) => !task.successorId);
  const exceptionTask = managedFixedTasks.find((task) => task.id === exceptionFixedId);
  const todayKey = toDateKey(new Date());
  const lastBackupAt = state.settings.lastBackupAt;
  const backupDue = !lastBackupAt
    || Date.now() - new Date(lastBackupAt).getTime() >= 7 * 24 * 60 * 60 * 1000;
  const categoryHistory = [
    ...state.scheduledTasks.map((task) => ({ id: task.id, label: "当前任务", title: task.title, categoryId: task.categoryId, originalCategory: task.categoryNameSnapshot })),
    ...state.fixedRecords.map((record) => ({ id: record.id, label: "历史任务", title: record.titleSnapshot, categoryId: record.categoryId, originalCategory: record.categoryNameSnapshot }))
  ].filter((task) => task.originalCategory !== categoryName(state.categories, task.categoryId));

  return (
    <section className="settings-page" aria-label="设置内容">
      <section className="surface-card settings-help-entry" aria-labelledby="settings-help-title">
        <span className="settings-help-entry__icon" aria-hidden="true">?</span>
        <div>
          <h2 id="settings-help-title">使用帮助</h2>
          <p>快速了解任务、优先级、提醒、专注和备份。</p>
        </div>
        <button type="button" className="button" onClick={() => setHelpCenterOpen(true)}>打开帮助中心</button>
      </section>
      <section className="surface-card settings-section" aria-labelledby="reminder-settings-title">
        <div className="settings-section__heading">
          <div>
            <h2 id="reminder-settings-title">通知权限</h2>
            <p className="settings-muted">{nativeAndroid
              ? "一个开关统一管理任务提醒、专注完成、休息结束、通知栏快捷操作和到点亮屏。"
              : "一个开关统一管理任务、专注完成和休息结束的系统通知。"}</p>
          </div>
          <span className={`notification-status notification-status--${systemNotificationsActive ? "on" : "off"}`}>
            {systemNotificationsActive ? "已开启" : "未开启"}
          </span>
        </div>
        <button
          type="button"
          className="button"
          disabled={!notificationsSupported || notificationPermission === "denied"}
          onClick={toggleSystemNotifications}
        >
          {!notificationsSupported ? "当前浏览器不支持系统通知"
            : notificationPermission === "denied" ? "通知权限已被拒绝"
              : systemNotificationsActive ? "关闭通知" : "开启通知"}
        </button>
        {notificationPermission === "denied" && <p className="settings-muted">{nativeAndroid
          ? "请到手机设置 → 应用 → 有常 → 通知，重新允许通知。"
          : "请在浏览器的网站权限中重新允许通知；应用内提醒仍然有效。"}</p>}
        {nativeAndroid && notificationPermission === "granted" && exactAlarmPermission !== "granted" && (
          <p className="settings-muted">点击“开启通知”后，请按系统提示允许有常准时提醒；返回有常后会自动完成设置。</p>
        )}
        <p className="settings-muted">任务需填写开始时间并选择提醒时间；专注或休息倒计时开始后会自动登记结束提醒。</p>
        <button
          type="button"
          className="button button--quiet"
          aria-expanded={notificationDiagnosticsOpen}
          onClick={refreshNotificationDiagnostics}
        >检查通知状态</button>
        {notificationDiagnosticsOpen && (
          <div className="notification-diagnostics" role="status" aria-label="通知状态检查结果">
            <span><strong>通知栏权限</strong><em>{permissionLabel(notificationPermission)}</em></span>
            {nativeAndroid && <span><strong>准时提醒权限</strong><em>{permissionLabel(exactAlarmPermission)}</em></span>}
            {nativeAndroid && <span><strong>到点亮屏</strong><em>{state.settings.wakeScreenForReminders === false ? "已关闭" : "已开启"}</em></span>}
            {nativeAndroid && <p>若熄屏后仍延迟，请把“有常”的电池策略保持为“不限制”，这是部分安卓系统保证后台准时运行所需的设置。</p>}
          </div>
        )}
      </section>

      <section className="surface-card settings-section" aria-labelledby="fixed-settings-title">
        <h2 id="fixed-settings-title">固定任务管理</h2>
        <p className="settings-muted">这里只管理已有固定任务。新建固定任务请回到“今日”，点击“添加任务”。</p>
        <ul className="settings-list" aria-label="固定任务列表">
          {managedFixedTasks.length === 0 && <li className="settings-muted">还没有固定任务</li>}
          {managedFixedTasks.map((task) => (
            <li key={task.id} className="settings-list__item">
              <span><strong>{task.title}</strong><small>{formatTaskPriority(task.priority)}优先级 · {categoryName(state.categories, task.categoryId)}{task.goalId ? ` · 目标：${(state.goals ?? []).find((goal) => goal.id === task.goalId)?.title ?? "已删除"}` : ""} · {formatFixedRepeatRule(task.repeatRule)}{task.plannedStartTime ? ` · ${task.plannedStartTime}` : ""}{task.reminderMinutesBefore !== undefined ? ` · ${formatReminderMinutes(task.reminderMinutesBefore)}` : ""}{task.pausedUntil && task.pausedUntil >= todayKey ? ` · 暂停至 ${task.pausedUntil}` : ""}{(task.skippedDates ?? []).some((date) => date >= todayKey) ? ` · 已请假 ${(task.skippedDates ?? []).filter((date) => date >= todayKey).length} 天` : ""} · {task.inactiveFrom ? "已停用" : "进行中"}</small></span>
              <span className="settings-inline-actions">
                <button type="button" onClick={() => beginEditFixedTask(task)} aria-label={`编辑固定任务：${task.title}`}>编辑</button>
                {!task.inactiveFrom && <button type="button" onClick={() => { setExceptionFixedId(task.id); setExceptionDate(todayKey); }} aria-label={`请假或暂停：${task.title}`}>请假/暂停</button>}
                <button type="button" onClick={() => dispatch({ type: "fixed/set-active", id: task.id, active: Boolean(task.inactiveFrom) })} aria-label={`${task.inactiveFrom ? "启用" : "停用"}：${task.title}`}>{task.inactiveFrom ? "启用" : "停用"}</button>
                <button type="button" onClick={() => setFixedTaskToDelete(task)} aria-label={`删除固定任务：${task.title}`}>删除</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {exceptionTask && <FixedTaskExceptionSurface onCancel={() => setExceptionFixedId(undefined)}>
        <section className="settings-form fixed-exception-panel">
          <div className="task-form__heading">
            <div>
              <h2 id="fixed-task-exception-title">请假或暂停</h2>
              <p className="settings-muted">{exceptionTask.title}</p>
            </div>
            <button type="button" className="task-form__close" aria-label="关闭请假或暂停" onClick={() => setExceptionFixedId(undefined)}>×</button>
          </div>
          <p className="settings-muted">请假当天不会生成任务，也不会算作未完成；临时暂停会在所选日期之后自动恢复。</p>
          <label className="field-label" htmlFor="fixed-exception-date">选择日期</label>
          <input id="fixed-exception-date" className="field-control" type="date" min={todayKey} value={exceptionDate} onChange={(event) => setExceptionDate(event.target.value as DateKey)} />
          <div className="settings-inline-actions fixed-exception-actions">
            <button className="button" type="button" onClick={() => {
              dispatch({ type: "fixed/toggle-skip-date", id: exceptionTask.id, date: exceptionDate });
              setExceptionFixedId(undefined);
            }}>{(exceptionTask.skippedDates ?? []).includes(exceptionDate) ? "取消这天请假" : "仅请假这一天"}</button>
            <button className="button button--primary" type="button" onClick={() => {
              dispatch({ type: "fixed/set-paused-until", id: exceptionTask.id, date: exceptionDate });
              setExceptionFixedId(undefined);
            }}>暂停到这一天</button>
            {exceptionTask.pausedUntil && <button type="button" onClick={() => {
              dispatch({ type: "fixed/set-paused-until", id: exceptionTask.id });
              setExceptionFixedId(undefined);
            }}>取消临时暂停</button>}
          </div>
        </section>
      </FixedTaskExceptionSurface>}

      {editingFixedId && <FixedTaskEditSurface onCancel={() => setEditingFixedId(undefined)}>
        <form className="settings-form settings-form--edit fixed-task-edit-form" onSubmit={saveFixedTask} aria-label="编辑固定任务">
          <div className="task-form__heading">
            <h2 id="fixed-task-edit-title">编辑固定任务</h2>
            <button type="button" className="task-form__close" aria-label="关闭编辑固定任务" onClick={() => setEditingFixedId(undefined)}>×</button>
          </div>
          <label className="field-label" htmlFor="editing-fixed-title">编辑固定任务名称</label>
          <input id="editing-fixed-title" className="field-control" value={editingFixedTitle} onChange={(event) => setEditingFixedTitle(event.target.value)} />
          <label className="field-label" htmlFor="editing-fixed-category">编辑固定任务分类</label>
          <select id="editing-fixed-category" className="field-control" value={editingFixedCategoryId} onChange={(event) => setEditingFixedCategoryId(event.target.value)}>
            {state.categories.length === 0 && <option value="">暂无可用分类</option>}
            {state.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <label className="field-label" htmlFor="editing-fixed-goal">编辑关联长期目标（选填）</label>
          <select id="editing-fixed-goal" className="field-control" value={editingFixedGoalId} onChange={(event) => setEditingFixedGoalId(event.target.value)}>
            <option value="">不关联目标</option>
            {(state.goals ?? []).map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
          </select>
          <label className="field-label" htmlFor="editing-fixed-priority">编辑固定任务优先级</label>
          <select id="editing-fixed-priority" className="field-control" value={editingFixedPriority} onChange={(event) => setEditingFixedPriority(event.target.value as TaskPriority)}>
            {taskPriorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label} · {option.description}</option>)}
          </select>
          <label className="field-label" htmlFor="editing-fixed-steps">编辑任务步骤（选填，每行一个）</label>
          <textarea id="editing-fixed-steps" className="field-control settings-step-lines" value={editingFixedSteps} onChange={(event) => setEditingFixedSteps(event.target.value)} />
          <RepeatRuleFields idPrefix="editing-fixed" value={editingFixedRepeatRule} onChange={setEditingFixedRepeatRule} />
          <div className="task-form__planning">
            <label htmlFor="editing-fixed-start-time"><span>编辑开始时间（选填）</span><input id="editing-fixed-start-time" className="field-control" type="time" value={editingFixedStartTime} onChange={(event) => setEditingFixedStartTime(event.target.value)} /></label>
            <label className="task-form__reminder" htmlFor="editing-fixed-reminder"><span>编辑任务提醒</span><select id="editing-fixed-reminder" className="field-control" value={editingFixedReminderMinutes} onChange={(event) => setEditingFixedReminderMinutes(event.target.value)}><option value="">不提醒</option>{reminderMinuteOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </div>
          {fixedTaskError && <p className="form-error" role="alert">{fixedTaskError}</p>}
          <div className="settings-inline-actions"><button className="button" type="button" onClick={() => setEditingFixedId(undefined)}>取消编辑</button><button className="button button--primary" type="submit">保存固定任务</button></div>
        </form>
      </FixedTaskEditSurface>}

      <details className="surface-card settings-section settings-disclosure">
        <summary className="settings-disclosure__summary">
          <span>
            <strong id="category-settings-title">分类管理</strong>
            <small>内置 {state.categories.length - customCategories.length} 类 · 自定义 {customCategories.length} 类</small>
          </span>
          <span className="settings-disclosure__action">展开</span>
        </summary>
        <div className="settings-disclosure__content" aria-labelledby="category-settings-title">
          <form className="settings-form settings-form--category" onSubmit={addCategory}>
            <label className="field-label" htmlFor="category-name">新分类名称</label>
            <input id="category-name" className="field-control" value={categoryNameInput} onChange={(event) => setCategoryNameInput(event.target.value)} />
            <label className="field-label" htmlFor="category-icon">新分类图标</label>
            <input id="category-icon" className="field-control" value={categoryIconInput} onChange={(event) => setCategoryIconInput(event.target.value)} maxLength={2} />
            <button className="button" type="submit">添加分类</button>
          </form>
          <p className="settings-muted">内置分类不能删除；删除自定义分类后，当前任务会归入“其他”。</p>
          <ul className="settings-list" aria-label="自定义分类列表">
            {customCategories.length === 0 && <li className="settings-muted">还没有自定义分类</li>}
            {customCategories.map((category) => <li key={category.id} className="settings-list__item"><span>{category.icon} {category.name}</span><button type="button" onClick={() => setCategoryToDelete(category)} aria-label={`删除分类：${category.name}`}>删除</button></li>)}
          </ul>
          {categoryHistory.length > 0 && <section className="settings-history" aria-labelledby="category-history-title">
            <h3 id="category-history-title">历史分类记录</h3>
            <ul>{categoryHistory.map((task) => <li key={task.id}>{task.label}：{task.title}（{categoryName(state.categories, task.categoryId)}）<small>原分类：{task.originalCategory}</small></li>)}</ul>
          </section>}
        </div>
      </details>

      <section className="surface-card settings-section" aria-labelledby="backup-settings-title">
        <div className="settings-section__heading">
          <div><h2 id="backup-settings-title">备份与恢复</h2><p className="settings-muted">导出会下载完整备份；导入会先核对内容，确认后才替换当前数据。</p></div>
          <span className={`notification-status notification-status--${backupDue ? "off" : "on"}`}>{backupDue ? "建议备份" : "已备份"}</span>
        </div>
        <p className="settings-muted">{lastBackupAt ? `上次备份：${formatBackupAt(lastBackupAt)}${backupDue ? "，已超过 7 天" : ""}` : "还没有备份记录，建议现在导出一份。"}</p>
        <div className="settings-inline-actions"><button type="button" className="button" onClick={exportBackup}>导出备份</button><label className="button backup-import-button" htmlFor="backup-file">导入备份</label><input id="backup-file" className="visually-hidden" type="file" accept="application/json,.json" onChange={importBackup} /></div>
        {backupError && <p className="form-error" role="alert">{backupError}</p>}
        {pendingBackup && <div className="backup-preview" role="status"><p>{backupSummary(pendingBackup)}</p><div className="settings-inline-actions"><button className="button" type="button" onClick={() => setPendingBackup(undefined)}>取消导入</button><button className="button button--primary" type="button" onClick={confirmImport}>确认导入</button></div></div>}
        {recoverySnapshots.length > 0 && (
          <section className="recovery-snapshots" aria-labelledby="recovery-snapshots-title">
            <div><h3 id="recovery-snapshots-title">发现异常数据恢复副本</h3><p className="settings-muted">有常已保留出错前的原始数据。建议先导出副本再删除；原始副本不一定能直接导入。</p></div>
            <ul>
              {recoverySnapshots.map((snapshot) => (
                <li key={snapshot.key}>
                  <span>保存于 {formatBackupAt(snapshot.createdAt)}</span>
                  <span className="settings-inline-actions">
                    <button type="button" onClick={() => exportRecoverySnapshot(snapshot)}>导出副本</button>
                    <button type="button" onClick={() => setRecoveryToDelete(snapshot)}>删除副本</button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>

      <section className="surface-card settings-section settings-section--danger" aria-labelledby="danger-settings-title">
        <h2 id="danger-settings-title">危险操作</h2>
        <p className="settings-muted">清空会移除本机的全部任务、分类和记录，且无法撤销。</p>
        <button type="button" className="button" onClick={() => { setClearPhrase(""); setClearArmed(true); }}>清空所有数据</button>
        {clearArmed && <div className="clear-confirmation"><label className="field-label" htmlFor="clear-phrase">确认清空</label><input id="clear-phrase" className="field-control" value={clearPhrase} onChange={(event) => setClearPhrase(event.target.value)} placeholder="请输入“清空”" /><button className="button" type="button" disabled={clearPhrase !== "清空"} onClick={() => setClearDialogOpen(true)}>确认清空</button></div>}
      </section>

      <p className="settings-version">有常 1.9</p>

      {fixedTaskToDelete && <ConfirmDialog title="删除固定任务" message={`删除“${fixedTaskToDelete.title}”后将不再生成新任务，已有的完成记录和成长统计会保留。`} confirmLabel="删除固定任务" onCancel={() => setFixedTaskToDelete(undefined)} onConfirm={() => { dispatch({ type: "fixed/delete", id: fixedTaskToDelete.id }); setFixedTaskToDelete(undefined); }} />}
      {categoryToDelete && <ConfirmDialog title="删除自定义分类" message={`删除“${categoryToDelete.name}”后，当前任务会归入“其他”。`} confirmLabel="删除分类" onCancel={() => setCategoryToDelete(undefined)} onConfirm={() => { dispatch({ type: "category/delete", id: categoryToDelete.id }); setCategoryToDelete(undefined); }} />}
      {recoveryToDelete && <ConfirmDialog title="删除异常数据副本" message="删除后无法恢复。若还没导出，建议先取消并保存一份。" confirmLabel="删除副本" onCancel={() => setRecoveryToDelete(undefined)} onConfirm={() => { removeRecoverySnapshot(window.localStorage, recoveryToDelete.key); setRecoverySnapshots(listRecoverySnapshots(window.localStorage)); setRecoveryToDelete(undefined); }} />}
      {clearDialogOpen && <ConfirmDialog title="确认清空所有数据" message="这会清空本机所有数据，且无法恢复。" confirmLabel="我确认清空" onCancel={() => setClearDialogOpen(false)} onConfirm={() => { dispatch({ type: "data/clear" }); setClearDialogOpen(false); setClearArmed(false); setClearPhrase(""); }} />}
      {helpCenterOpen && <HelpCenterDialog onClose={() => setHelpCenterOpen(false)} />}
    </section>
  );
}
