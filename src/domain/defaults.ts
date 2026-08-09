import { toDateKey } from "./date";
import type { AppState, Category } from "./types";

const builtInCategories: ReadonlyArray<Pick<Category, "id" | "name" | "icon">> = [
  { id: "study", name: "学习", icon: "学" },
  { id: "work", name: "工作", icon: "工" },
  { id: "exercise", name: "运动", icon: "动" },
  { id: "rest", name: "休息", icon: "休" },
  { id: "life", name: "生活", icon: "生" },
  { id: "other", name: "其他", icon: "其" }
];

export function createInitialState(now: Date): AppState {
  const createdAt = now.toISOString();

  return {
    schemaVersion: 1,
    settings: {
      displayName: "",
      firstUsedAt: createdAt,
      lastOpenedDate: toDateKey(now),
      musicVolume: 0.35,
      featuredAchievementIds: [],
      systemNotificationsEnabled: false
    },
    categories: builtInCategories.map((category, order) => ({
      ...category,
      builtIn: true,
      order,
      createdAt
    })),
    fixedTasks: [],
    fixedRecords: [],
    scheduledTasks: [],
    reschedules: [],
    focus: {
      focusMinutes: 25,
      breakMinutes: 5,
      completedSessions: 0,
      totalFocusMinutes: 0,
      experience: 0
    },
    timeEntries: []
  };
}
