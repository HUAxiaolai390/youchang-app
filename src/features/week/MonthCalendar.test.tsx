import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MonthPlanDay } from "../../domain/month";
import { MonthCalendar } from "./MonthCalendar";

function day(overrides: Partial<MonthPlanDay>): MonthPlanDay {
  return {
    date: "2026-08-11",
    tasks: [],
    completed: 0,
    actualMinutes: 0,
    inCurrentMonth: true,
    overdue: 0,
    ...overrides
  };
}

describe("MonthCalendar", () => {
  it("shows task progress and selects a day", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<MonthCalendar
      days={[
        day({ date: "2026-08-10", tasks: [{ id: "a", taskId: "a", kind: "scheduled", title: "复习", categoryId: "study", categoryName: "学习", date: "2026-08-10", status: "archived" }], overdue: 1 }),
        day({ date: "2026-08-11" })
      ]}
      selectedDate="2026-08-11"
      today="2026-08-11"
      onSelect={onSelect}
    />);

    const overdueDay = screen.getByRole("button", { name: /8月10日，1 项任务.*逾期 1 项/ });
    expect(overdueDay).toHaveTextContent("1 项逾期");
    await user.click(overdueDay);
    expect(onSelect).toHaveBeenCalledWith("2026-08-10");
  });
});
