import { fromDateKey, toDateKey } from "./date";
import type { AppState, DateKey } from "./types";
import { getPlanForDates, type WeekPlanDay } from "./week";

export type MonthPlanDay = WeekPlanDay & {
  inCurrentMonth: boolean;
  overdue: number;
};

export function getMonthGridDates(anchor: Date): DateKey[] {
  const firstDay = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return toDateKey(date);
  });
}

export function getMonthPlan(state: AppState, anchor: Date, now: Date): MonthPlanDay[] {
  const dates = getMonthGridDates(anchor);
  const today = toDateKey(now);
  const month = anchor.getMonth();
  const year = anchor.getFullYear();

  return getPlanForDates(state, dates, now, { includeArchived: true }).map((day) => {
    const date = fromDateKey(day.date);
    return {
      ...day,
      inCurrentMonth: date.getMonth() === month && date.getFullYear() === year,
      overdue: day.date < today
        ? day.tasks.filter((task) => task.status !== "completed").length
        : 0
    };
  });
}
