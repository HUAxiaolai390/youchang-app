import { useEffect, useMemo } from "react";
import { useAppState } from "../app/AppStateProvider";
import {
  buildNativeTaskNotifications,
  consumeNativeReminderActions,
  isNativeAndroid,
  syncNativeTaskNotifications
} from "../native/task-notifications";

export function NativeTaskNotificationSync() {
  const { state, dispatch } = useAppState();
  const nativeAndroid = isNativeAndroid();
  const scheduleSignature = useMemo(() => {
    if (!nativeAndroid) return "web";
    const reminders = buildNativeTaskNotifications(state, new Date());
    return JSON.stringify({
      enabled: Boolean(state.settings.systemNotificationsEnabled),
      wakeScreen: state.settings.wakeScreenForReminders !== false,
      reminders: reminders.map((notification) => [
        notification.id,
        notification.title,
        notification.body,
        notification.schedule?.at?.getTime()
      ])
    });
  }, [nativeAndroid, state]);

  useEffect(() => {
    if (!nativeAndroid) return;
    void syncNativeTaskNotifications(state).catch(() => {
      // A denied permission or a manufacturer-specific restriction must not
      // block task editing. The setting screen still shows permission status.
    });
  }, [nativeAndroid, scheduleSignature]);

  useEffect(() => {
    if (!nativeAndroid) return;
    let active = true;
    const applyActions = async () => {
      const actions = await consumeNativeReminderActions();
      if (!active) return;
      for (const action of actions) {
        if (action.action === "complete") {
          dispatch(action.kind === "fixed"
            ? { type: "fixed/complete-from-notification", recordId: action.taskId, date: action.date, completedAt: action.at }
            : { type: "scheduled/complete-from-notification", id: action.taskId, completedAt: action.at });
        } else if (action.action === "postpone" && action.kind === "scheduled") {
          dispatch({ type: "scheduled/postpone-from-notification", id: action.taskId });
        } else if (action.action === "skip" && action.kind === "fixed") {
          dispatch({ type: "fixed/skip-from-notification", recordId: action.taskId, date: action.date });
        } else {
          dispatch({
            type: "reminder/snooze",
            kind: action.kind,
            id: action.taskId,
            until: new Date(action.at).toISOString()
          });
        }
      }
    };
    void applyActions();
    const onResume = () => void applyActions();
    window.addEventListener("focus", onResume);
    document.addEventListener("visibilitychange", onResume);
    return () => {
      active = false;
      window.removeEventListener("focus", onResume);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, [dispatch, nativeAndroid]);

  return null;
}
