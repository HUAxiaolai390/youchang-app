import type {
  AddFixedTaskInput,
  AddScheduledTaskInput,
  UpdateFixedTaskInput,
  UpdateScheduledTaskInput
} from "../domain/tasks";
import type { AppState, DateKey } from "../domain/types";

export type AppAction =
  | { type: "scheduled/add"; input: AddScheduledTaskInput }
  | { type: "scheduled/update"; id: string; input: UpdateScheduledTaskInput }
  | { type: "scheduled/toggle"; id: string }
  | { type: "scheduled/delete"; id: string }
  | { type: "scheduled/reschedule"; id: string; targetDate: DateKey }
  | { type: "scheduled/move-archived"; id: string; targetDate: DateKey }
  | { type: "fixed/add"; input: AddFixedTaskInput }
  | { type: "fixed/update"; id: string; input: UpdateFixedTaskInput }
  | { type: "fixed/toggle"; recordId: string }
  | { type: "fixed/set-active"; id: string; active: boolean }
  | { type: "category/add"; name: string; icon: string }
  | { type: "category/delete"; id: string }
  | { type: "settings/name"; value: string }
  | { type: "settings/music-volume"; value: number }
  | { type: "focus/configure"; focusMinutes: number; breakMinutes: number }
  | { type: "focus/session-complete"; minutes: number }
  | { type: "backup/import"; state: AppState }
  | { type: "data/clear" }
  | { type: "system/rollover"; now: Date }
  | { type: "error/dismiss" };
