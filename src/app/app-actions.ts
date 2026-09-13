import type {
  AddFixedTaskInput,
  AddScheduledTaskInput,
  UpdateFixedTaskInput,
  UpdateScheduledTaskInput
} from "../domain/tasks";
import type { AppState, DateKey, FocusTimerRuntime, TimeKey } from "../domain/types";

export type AppAction =
  | { type: "scheduled/add"; input: AddScheduledTaskInput }
  | { type: "scheduled/update"; id: string; input: UpdateScheduledTaskInput }
  | { type: "scheduled/toggle"; id: string }
  | { type: "scheduled/complete-from-notification"; id: string; completedAt: number }
  | { type: "scheduled/step-toggle"; id: string; stepId: string }
  | { type: "scheduled/delete"; id: string }
  | { type: "scheduled/reschedule"; id: string; targetDate: DateKey }
  | { type: "scheduled/postpone-tomorrow"; id: string }
  | { type: "scheduled/move-archived"; id: string; targetDate: DateKey }
  | { type: "fixed/add"; input: AddFixedTaskInput }
  | { type: "fixed/update"; id: string; input: UpdateFixedTaskInput }
  | { type: "fixed/delete"; id: string }
  | { type: "fixed/toggle"; recordId: string }
  | { type: "fixed/complete-from-notification"; recordId: string; date: DateKey; completedAt: number }
  | { type: "fixed/step-toggle"; recordId: string; stepId: string }
  | { type: "fixed/toggle-date"; templateId: string; date: DateKey }
  | { type: "fixed/set-active"; id: string; active: boolean }
  | { type: "fixed/toggle-skip-date"; id: string; date: DateKey }
  | { type: "fixed/set-paused-until"; id: string; date?: DateKey }
  | { type: "category/add"; name: string; icon: string }
  | { type: "category/delete"; id: string }
  | { type: "settings/name"; value: string }
  | { type: "settings/music-volume"; value: number }
  | { type: "settings/featured-achievements"; ids: string[] }
  | { type: "settings/system-notifications"; enabled: boolean }
  | { type: "settings/wake-screen-reminders"; enabled: boolean }
  | { type: "settings/quiet-hours"; enabled: boolean; start: TimeKey; end: TimeKey }
  | { type: "settings/backup-exported"; at: string }
  | { type: "reminder/mark-sent"; kind: "fixed" | "scheduled"; id: string; sentAt: string }
  | { type: "reminder/snooze"; kind: "fixed" | "scheduled"; id: string; until: string }
  | { type: "focus/configure"; focusMinutes: number; breakMinutes: number; timer?: FocusTimerRuntime }
  | { type: "focus/session-complete"; minutes: number; timer?: FocusTimerRuntime; target?: string }
  | { type: "focus/timer-save"; timer: FocusTimerRuntime }
  | { type: "fixed/time-set"; recordId: string; minutes: number }
  | { type: "fixed/time-add"; recordId: string; minutes: number }
  | { type: "scheduled/time-set"; id: string; minutes: number }
  | { type: "scheduled/time-add"; id: string; minutes: number }
  | { type: "time-entry/add"; title: string; categoryId: string; date: DateKey; minutes: number }
  | { type: "weekly-review/save"; weekStart: DateKey; summary: string; adjustment: string }
  | { type: "goal/add"; title: string; deadline: DateKey }
  | { type: "goal/update"; id: string; title: string; deadline: DateKey }
  | { type: "goal/delete"; id: string }
  | { type: "backup/import"; state: AppState }
  | { type: "data/clear" }
  | { type: "system/rollover"; now: Date }
  | { type: "error/dismiss" };
