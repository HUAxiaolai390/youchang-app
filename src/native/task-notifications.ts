import { Capacitor, registerPlugin, type PermissionState } from "@capacitor/core";
import {
  LocalNotifications,
  type LocalNotificationSchema
} from "@capacitor/local-notifications";
import { getSchedulableTaskReminders, type TaskReminder } from "../domain/reminders";
import type { AppState, DateKey } from "../domain/types";

const taskReminderSource = "youchang-task-reminder";
const exactReminderIdsStorageKey = "youchang.exact-reminder-ids.v1";

type ExactReminderSchedule = {
  id: number;
  at: number;
  title: string;
  body: string;
  wakeScreen: boolean;
  kind: "fixed" | "scheduled";
  taskId: string;
  date: DateKey;
};
export type NativeReminderAction = {
  id: string;
  action: "complete" | "snooze" | "postpone" | "skip";
  kind: "fixed" | "scheduled";
  taskId: string;
  date: DateKey;
  at: number;
};
interface ExactReminderPlugin {
  replace(options: { oldIds: number[]; reminders: ExactReminderSchedule[] }): Promise<void>;
  scheduleTest(options: { at: number; wakeScreen: boolean }): Promise<{ at: number }>;
  scheduleFocus(options: { at: number; title: string; body: string; wakeScreen: boolean }): Promise<{ at: number }>;
  cancelFocus(): Promise<void>;
  getActions(): Promise<{ actions: NativeReminderAction[] }>;
  acknowledgeActions(options: { ids: string[] }): Promise<void>;
}
const ExactReminder = registerPlugin<ExactReminderPlugin>("ExactReminder");

export type SystemNotificationPermission = PermissionState | "unsupported";
export type ExactAlarmPermission = PermissionState | "unsupported";

function webPermission(permission: NotificationPermission): SystemNotificationPermission {
  return permission === "default" ? "prompt" : permission;
}

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function supportsSystemNotifications(): boolean {
  return isNativeAndroid() || typeof Notification !== "undefined";
}

export async function checkSystemNotificationPermission(): Promise<SystemNotificationPermission> {
  if (isNativeAndroid()) {
    return (await LocalNotifications.checkPermissions()).display;
  }
  return typeof Notification === "undefined" ? "unsupported" : webPermission(Notification.permission);
}

export async function requestSystemNotificationPermission(): Promise<SystemNotificationPermission> {
  if (isNativeAndroid()) {
    return (await LocalNotifications.requestPermissions()).display;
  }
  return typeof Notification === "undefined" ? "unsupported" : webPermission(await Notification.requestPermission());
}

export async function checkExactAlarmPermission(): Promise<ExactAlarmPermission> {
  if (!isNativeAndroid()) return "unsupported";
  return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm;
}

export async function openExactAlarmSettings(): Promise<ExactAlarmPermission> {
  if (!isNativeAndroid()) return "unsupported";
  return (await LocalNotifications.changeExactNotificationSetting()).exact_alarm;
}

export async function sendNativeTestNotification(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  const permission = await checkSystemNotificationPermission();
  if (permission !== "granted") return false;
  await LocalNotifications.schedule({
    notifications: [{
      id: 2_100_000_001,
      title: "有常 · 测试通知",
      body: "如果你看到了这条消息，说明通知栏权限正常。",
      largeBody: "如果你看到了这条消息，说明通知栏权限正常。接下来再测试任务的准时提醒。",
      summaryText: "任务提醒",
      autoCancel: true,
      extra: { source: "youchang-notification-test" }
    }]
  });
  return true;
}

export async function scheduleNativeTestNotification(
  delayMilliseconds = 60_000,
  wakeScreen = true
): Promise<Date | undefined> {
  if (!isNativeAndroid()) return undefined;
  const permission = await checkSystemNotificationPermission();
  if (permission !== "granted") return undefined;
  const at = new Date(Date.now() + delayMilliseconds);
  await ExactReminder.scheduleTest({ at: at.getTime(), wakeScreen });
  return at;
}

export async function scheduleFocusPhaseNotification(
  phase: "focus" | "break",
  at: number,
  nextPhaseMinutes: number,
  wakeScreen = true
): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  const permission = await checkSystemNotificationPermission();
  if (permission !== "granted") return false;
  const exactPermission = await checkExactAlarmPermission();
  if (exactPermission !== "granted") return false;
  const title = phase === "focus" ? "有常 · 专注完成" : "有常 · 休息结束";
  const body = phase === "focus"
    ? `辛苦了，该休息 ${nextPhaseMinutes} 分钟了。`
    : "状态恢复，可以开始下一轮专注了。";
  await ExactReminder.scheduleFocus({ at, title, body, wakeScreen });
  return true;
}

export async function cancelFocusPhaseNotification(): Promise<void> {
  if (!isNativeAndroid()) return;
  await ExactReminder.cancelFocus();
}

export async function readNativeReminderActions(): Promise<NativeReminderAction[]> {
  if (!isNativeAndroid()) return [];
  const result = await ExactReminder.getActions();
  return Array.isArray(result.actions) ? result.actions.filter((action): action is NativeReminderAction => (
    action !== null && typeof action === "object"
      && typeof action.id === "string" && action.id.length > 0
      && (action.action === "complete" || action.action === "snooze"
        || (action.action === "postpone" && action.kind === "scheduled")
        || (action.action === "skip" && action.kind === "fixed"))
      && (action.kind === "fixed" || action.kind === "scheduled")
      && typeof action.taskId === "string" && action.taskId.length > 0
      && isDateKey(action.date)
      && Number.isFinite(action.at)
      && Number.isFinite(new Date(action.at).getTime())
  )) : [];
}

export async function acknowledgeNativeReminderActions(ids: string[]): Promise<void> {
  if (!isNativeAndroid() || ids.length === 0) return;
  await ExactReminder.acknowledgeActions({ ids });
}

function isDateKey(value: unknown): value is DateKey {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function hashReminderKey(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2_000_000_000 + 1;
}

function reminderBody(reminder: TaskReminder): string {
  if (reminder.snoozed) return `稍后提醒：${reminder.title}`;
  if (reminder.reminderMinutesBefore === 0) return `计划 ${reminder.plannedStartTime} 开始，现在可以行动了。`;
  return `计划 ${reminder.plannedStartTime} 开始，还有 ${reminder.reminderMinutesBefore} 分钟。`;
}

export function buildNativeTaskNotifications(state: AppState, now: Date): LocalNotificationSchema[] {
  const usedIds = new Set<number>();
  return getSchedulableTaskReminders(state, now).slice(0, 480).map((reminder) => {
    let notificationId = hashReminderKey(`${reminder.kind}:${reminder.id}:${reminder.date}`);
    while (usedIds.has(notificationId)) notificationId = notificationId === 2_000_000_000 ? 1 : notificationId + 1;
    usedIds.add(notificationId);
    const body = reminderBody(reminder);
    return {
      id: notificationId,
      title: `有常 · ${reminder.title}`,
      body,
      largeBody: body,
      summaryText: "任务提醒",
      autoCancel: true,
      schedule: { at: reminder.remindAt, allowWhileIdle: true },
      extra: {
        source: taskReminderSource,
        kind: reminder.kind,
        taskId: reminder.id,
        date: reminder.date
      }
    };
  });
}

let notificationSyncQueue = Promise.resolve();

async function performNativeTaskNotificationSync(state: AppState, now: Date): Promise<void> {
  if (!isNativeAndroid()) return;

  // Remove timers created by the older generic implementation during the
  // migration, otherwise a delayed duplicate could still appear.
  const oldPluginPending = await LocalNotifications.getPending();
  const oldPluginOwned = oldPluginPending.notifications.filter((notification) => notification.extra?.source === taskReminderSource);
  if (oldPluginOwned.length > 0) {
    await LocalNotifications.cancel({ notifications: oldPluginOwned.map(({ id }) => ({ id })) });
  }

  const oldIds = readExactReminderIds();
  if (!state.settings.systemNotificationsEnabled) {
    await ExactReminder.replace({ oldIds, reminders: [] });
    await ExactReminder.cancelFocus();
    rememberExactReminderIds([]);
    return;
  }

  let permission = await checkSystemNotificationPermission();
  if (permission === "prompt" || permission === "prompt-with-rationale") {
    permission = await requestSystemNotificationPermission();
  }
  if (permission !== "granted") return;

  const exactPermission = await checkExactAlarmPermission();
  if (exactPermission !== "granted") return;

  const notifications = buildNativeTaskNotifications(state, now);
  const reminders = notifications.flatMap((notification): ExactReminderSchedule[] => {
    const at = notification.schedule?.at?.getTime();
    const kind = notification.extra?.kind;
    const taskId = notification.extra?.taskId;
    const date = notification.extra?.date;
    if (!at || (kind !== "fixed" && kind !== "scheduled")
      || typeof taskId !== "string" || !isDateKey(date)) return [];
    return [{
      id: notification.id,
      at,
      title: notification.title,
      body: notification.body,
      wakeScreen: state.settings.wakeScreenForReminders !== false,
      kind,
      taskId,
      date
    }];
  });
  await ExactReminder.replace({ oldIds, reminders });
  rememberExactReminderIds(reminders.map(({ id }) => id));
}

function readExactReminderIds(): number[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(exactReminderIdsStorageKey) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function rememberExactReminderIds(ids: number[]) {
  window.localStorage.setItem(exactReminderIdsStorageKey, JSON.stringify(ids));
}

export function syncNativeTaskNotifications(state: AppState, now = new Date()): Promise<void> {
  notificationSyncQueue = notificationSyncQueue
    .catch(() => undefined)
    .then(() => performNativeTaskNotificationSync(state, now));
  return notificationSyncQueue;
}
