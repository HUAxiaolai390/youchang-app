import { Capacitor, type PermissionState } from "@capacitor/core";
import {
  LocalNotifications,
  type LocalNotificationSchema
} from "@capacitor/local-notifications";
import { getSchedulableTaskReminders, type TaskReminder } from "../domain/reminders";
import type { AppState } from "../domain/types";

const taskReminderSource = "youchang-task-reminder";

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

export async function scheduleNativeTestNotification(delayMilliseconds = 60_000): Promise<Date | undefined> {
  if (!isNativeAndroid()) return undefined;
  const permission = await checkSystemNotificationPermission();
  if (permission !== "granted") return undefined;
  const at = new Date(Date.now() + delayMilliseconds);
  await LocalNotifications.schedule({
    notifications: [{
      id: 2_100_000_002,
      title: "有常 · 定时测试成功",
      body: "这是一分钟前安排的测试提醒，说明准时提醒可以正常工作。",
      largeBody: "这是一分钟前安排的测试提醒，说明退出有常后，安卓也能按时间显示任务通知。",
      summaryText: "任务提醒",
      autoCancel: true,
      schedule: { at, allowWhileIdle: true },
      extra: { source: "youchang-scheduled-notification-test" }
    }]
  });
  return at;
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

  const pending = await LocalNotifications.getPending();
  const owned = pending.notifications.filter((notification) => notification.extra?.source === taskReminderSource);
  if (owned.length > 0) {
    await LocalNotifications.cancel({ notifications: owned.map(({ id }) => ({ id })) });
  }
  if (!state.settings.systemNotificationsEnabled) return;

  let permission = await checkSystemNotificationPermission();
  if (permission === "prompt" || permission === "prompt-with-rationale") {
    permission = await requestSystemNotificationPermission();
  }
  if (permission !== "granted") return;

  const notifications = buildNativeTaskNotifications(state, now);
  if (notifications.length > 0) await LocalNotifications.schedule({ notifications });
}

export function syncNativeTaskNotifications(state: AppState, now = new Date()): Promise<void> {
  notificationSyncQueue = notificationSyncQueue
    .catch(() => undefined)
    .then(() => performNativeTaskNotificationSync(state, now));
  return notificationSyncQueue;
}
