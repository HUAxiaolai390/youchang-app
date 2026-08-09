import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../app/AppStateProvider";
import {
  describeTaskReminder,
  getPendingTaskReminders,
  type TaskReminder
} from "../domain/reminders";

const readSystemTime = () => new Date();

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
  const [currentTime, setCurrentTime] = useState(readNow);
  const [activeReminder, setActiveReminder] = useState<TaskReminder>();
  const pendingReminders = useMemo(
    () => getPendingTaskReminders(state, currentTime),
    [currentTime, state]
  );

  useEffect(() => {
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
  }, [readNow, tickMilliseconds]);

  useEffect(() => {
    const reminder = pendingReminders[0];
    if (activeReminder || !reminder) return;
    const sentAt = currentTime.toISOString();
    if (!dispatch({ type: "reminder/mark-sent", kind: reminder.kind, id: reminder.id, sentAt })) return;
    setActiveReminder(reminder);
    if (state.settings.systemNotificationsEnabled) void showSystemNotification(reminder);
  }, [activeReminder, currentTime, dispatch, pendingReminders, state.settings.systemNotificationsEnabled]);

  if (!activeReminder) return null;

  return (
    <aside className="task-reminder" role="alert" aria-label="任务提醒">
      <span className="task-reminder__icon" aria-hidden="true">◷</span>
      <div className="task-reminder__copy">
        <span>任务提醒</span>
        <strong>{activeReminder.title}</strong>
        <small>{activeReminder.plannedStartTime} · {describeTaskReminder(activeReminder, currentTime)}</small>
      </div>
      <div className="task-reminder__actions">
        {onOpenTask && <button type="button" onClick={() => { onOpenTask(); setActiveReminder(undefined); }}>查看任务</button>}
        <button type="button" onClick={() => setActiveReminder(undefined)}>知道了</button>
      </div>
    </aside>
  );
}
