import { Capacitor, type PermissionState } from "@capacitor/core";
import {
  LocalNotifications,
  type LocalNotificationSchema
} from "@capacitor/local-notifications";
import { getSchedulableTaskReminders, type TaskReminder } from "../domain/reminders";
import type { AppState } from "../domain/types";

const taskReminderSource = "youchang-task-reminder";

export type SystemNotificationPermission = PermissionState | "unsupported";

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
