export type DateKey = `${number}-${number}-${number}`;
export type TimeKey = `${number}:${number}`;
export type ReminderMinutesBefore = 0 | 5 | 10 | 30 | 60;
export type TaskPriority = "high" | "medium" | "low";

export type TaskStatus =
  | "pending"
  | "completed"
  | "backlog"
  | "rescheduled"
  | "archived";

export interface Category {
  id: string;
  name: string;
  icon: string;
  builtIn: boolean;
  order: number;
  createdAt: string;
}

export type FixedRepeatRule =
  | { type: "daily" }
  | { type: "weekdays" }
  | { type: "custom-weekdays"; weekdays: number[] }
  | { type: "weekly-count"; timesPerWeek: number }
  | { type: "interval"; intervalDays: number };

export interface FixedTaskTemplate {
  id: string;
  title: string;
  categoryId: string;
  categoryNameSnapshot: string;
  activeFrom: DateKey;
  inactiveFrom?: DateKey;
  successorId?: string;
  plannedStartTime?: TimeKey;
  reminderMinutesBefore?: ReminderMinutesBefore;
  priority?: TaskPriority;
  estimatedMinutes?: number;
  repeatRule?: FixedRepeatRule;
  skippedDates?: DateKey[];
  pausedUntil?: DateKey;
  order: number;
  createdAt: string;
}

export interface FixedTaskRecord {
  id: string;
  templateId: string;
  date: DateKey;
  titleSnapshot: string;
  categoryId: string;
  categoryNameSnapshot: string;
  completedAt?: string;
  plannedStartTime?: TimeKey;
  reminderMinutesBefore?: ReminderMinutesBefore;
  reminderSentAt?: string;
  priority?: TaskPriority;
  isTodayFocus?: boolean;
  estimatedMinutes?: number;
  actualMinutes?: number;
}

export interface ScheduledTask {
  id: string;
  title: string;
  categoryId: string;
  categoryNameSnapshot: string;
  scheduledDate: DateKey;
  status: TaskStatus;
  sourceTaskId?: string;
  createdAt: string;
  completedAt?: string;
  plannedStartTime?: TimeKey;
  reminderMinutesBefore?: ReminderMinutesBefore;
  reminderSentAt?: string;
  priority?: TaskPriority;
  isTodayFocus?: boolean;
  estimatedMinutes?: number;
  actualMinutes?: number;
}

export interface RescheduleRecord {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  fromDate: DateKey;
  toDate: DateKey;
  changedAt: string;
}

export interface FocusProgress {
  focusMinutes: number;
  breakMinutes: number;
  completedSessions: number;
  totalFocusMinutes: number;
  experience: number;
}

export interface TimeEntry {
  id: string;
  title: string;
  categoryId: string;
  categoryNameSnapshot: string;
  date: DateKey;
  minutes: number;
  createdAt: string;
}

export interface AppState {
  schemaVersion: 1;
  settings: {
    displayName: string;
    firstUsedAt: string;
    lastOpenedDate: DateKey;
    musicVolume?: number;
    featuredAchievementIds?: string[];
    systemNotificationsEnabled?: boolean;
  };
  categories: Category[];
  fixedTasks: FixedTaskTemplate[];
  fixedRecords: FixedTaskRecord[];
  scheduledTasks: ScheduledTask[];
  reschedules: RescheduleRecord[];
  focus?: FocusProgress;
  timeEntries?: TimeEntry[];
}
