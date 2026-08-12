import { useEffect, useMemo } from "react";
import { useAppState } from "../app/AppStateProvider";
import { buildNativeTaskNotifications, isNativeAndroid, syncNativeTaskNotifications } from "../native/task-notifications";

export function NativeTaskNotificationSync() {
  const { state } = useAppState();
  const nativeAndroid = isNativeAndroid();
  const scheduleSignature = useMemo(() => {
    if (!nativeAndroid) return "web";
    const reminders = buildNativeTaskNotifications(state, new Date());
    return JSON.stringify({
      enabled: Boolean(state.settings.systemNotificationsEnabled),
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

  return null;
}
