import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../app/AppStateProvider";
import { toDateKey } from "../domain/date";
import {
  describeTaskReminder,
  getPendingTaskReminders,
  type TaskReminder
} from "../domain/reminders";
import { isNativeAndroid } from "../native/task-notifications";

const readSystemTime = () => new Date();
const snoozeOptions = [5, 10, 30] as const;

async function showSystemNotification(reminder: TaskReminder) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const title = `有常 · ${reminder.title}`;
  const options: NotificationOptions = {
    body: `${reminder.plannedStartTime} 开始，准备好就行动吧。`,
    icon: "/pwa-192x192.png",
    badge: "/pwa-64x64.png",
    tag: `youchang-reminder-${reminder.kind}-${reminder.id}`
  };

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, options);
        return;
      }
    } catch {
      // The regular notification below is a safe fallback while the app is open.
    }
  }
  new Notification(title, options);
}

export function TaskReminderCenter({
  onOpenTask,
  now: readNow = readSystemTime,
  tickMilliseconds = 15_000
}: {
  onOpenTask?(): void;
  now?(): Date;
  tickMilliseconds?: number;
}) {
  const { state, dispatch } = useAppState();
  const nativeAndroid = isNativeAndroid();
  const [currentTime, setCurrentTime] = useState(readNow);
  const [activeReminder, setActiveReminder] = useState<TaskReminder>();
  const [snoozeMinutes, setSnoozeMinutes] = useState<(typeof snoozeOptions)[number]>(10);
  const pendingReminders = useMemo(
    () => getPendingTaskReminders(state, currentTime),
    [currentTime, state]
  );

  useEffect(() => {
    if (nativeAndroid) return;
    const refresh = () => setCurrentTime(readNow());
    const timer = window.setInterval(refresh, tickMilliseconds);
    const refreshWhenVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [nativeAndroid, readNow, tickMilliseconds]);

  useEffect(() => {
    if (nativeAndroid) return;
    const reminder = pendingReminders[0];
    if (activeReminder || !reminder) return;
    const sentAt = currentTime.toISOString();
    if (!dispatch({ type: "reminder/mark-sent", kind: reminder.kind, id: reminder.id, sentAt })) return;
    setActiveReminder(reminder);
    if (state.settings.systemNotificationsEnabled) void showSystemNotification(reminder);
  }, [activeReminder, currentTime, dispatch, nativeAndroid, pendingReminders, state.settings.systemNotificationsEnabled]);

  useEffect(() => {
    if (!activeReminder) return;
    if (activeReminder.kind === "fixed") {
      const record = state.fixedRecords.find((item) => item.id === activeReminder.id);
      if (!record || record.completedAt || record.reminderSnoozedUntil) setActiveReminder(undefined);
      return;
    }
    const task = state.scheduledTasks.find((item) => item.id === activeReminder.id);
    if (!task || ["completed", "rescheduled"].includes(task.status) || task.reminderSnoozedUntil) {
      setActiveReminder(undefined);
    }
  }, [activeReminder, state.fixedRecords, state.scheduledTasks]);

  if (nativeAndroid || !activeReminder) return null;

  function finishReminder() {
    if (!activeReminder) return;
    const saved = dispatch(activeReminder.kind === "fixed"
      ? { type: "fixed/toggle", recordId: activeReminder.id }
      : { type: "scheduled/toggle", id: activeReminder.id });
    if (saved) setActiveReminder(undefined);
  }

  function snoozeReminder() {
    if (!activeReminder) return;
    const until = new Date(readNow().getTime() + snoozeMinutes * 60_000).toISOString();
    const saved = dispatch({
      type: "reminder/snooze",
      kind: activeReminder.kind,
      id: activeReminder.id,
      until
    });
    if (saved) {
      setCurrentTime(readNow());
      setActiveReminder(undefined);
    }
  }

  function moveOrSkipReminder() {
    if (!activeReminder) return;
    let saved = false;
    if (activeReminder.kind === "scheduled") {
      saved = dispatch({ type: "scheduled/postpone-tomorrow", id: activeReminder.id });
    } else {
      const record = state.fixedRecords.find((item) => item.id === activeReminder.id);
      if (record) {
        saved = dispatch({
          type: "fixed/toggle-skip-date",
          id: record.templateId,
          date: record.date
        });
      }
    }
    if (saved) setActiveReminder(undefined);
  }

  return (
    <aside className="task-reminder" role="alert" aria-label="任务提醒">
      <span className="task-reminder__icon" aria-hidden="true">◷</span>
      <div className="task-reminder__copy">
        <span>任务提醒</span>
        <strong>{activeReminder.title}</strong>
        <small>{activeReminder.plannedStartTime} · {describeTaskReminder(activeReminder, currentTime)}</small>
      </div>
      <div className="task-reminder__actions">
        <button type="button" className="task-reminder__complete" onClick={finishReminder}>完成</button>
        <label className="task-reminder__snooze-select">
          <span className="visually-hidden">稍后提醒时间</span>
          <select
            aria-label="稍后提醒时间"
            value={snoozeMinutes}
            onChange={(event) => setSnoozeMinutes(Number(event.target.value) as typeof snoozeMinutes)}
          >
            {snoozeOptions.map((minutes) => <option value={minutes} key={minutes}>{minutes} 分钟后</option>)}
          </select>
        </label>
        <button type="button" onClick={snoozeReminder}>稍后提醒</button>
        <button type="button" onClick={moveOrSkipReminder}>
          {activeReminder.kind === "scheduled" ? "改到明天" : activeReminder.date === toDateKey(currentTime) ? "今天跳过" : "跳过这次"}
        </button>
        {onOpenTask && <button type="button" onClick={() => { onOpenTask(); setActiveReminder(undefined); }}>查看</button>}
        <button type="button" onClick={() => setActiveReminder(undefined)} aria-label="关闭提醒">×</button>
      </div>
    </aside>
  );
}
