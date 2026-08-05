export type DateKey = `${number}-${number}-${number}`;

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

export interface FixedTaskTemplate {
  id: string;
  title: string;
  categoryId: string;
  categoryNameSnapshot: string;
  activeFrom: DateKey;
  inactiveFrom?: DateKey;
  successorId?: string;
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

export interface AppState {
  schemaVersion: 1;
  settings: {
    displayName: string;
    firstUsedAt: string;
    lastOpenedDate: DateKey;
    musicVolume?: number;
  };
  categories: Category[];
  fixedTasks: FixedTaskTemplate[];
  fixedRecords: FixedTaskRecord[];
  scheduledTasks: ScheduledTask[];
  reschedules: RescheduleRecord[];
  focus?: FocusProgress;
}
