import { fromDateKey } from "../../domain/date";
import type { DateKey } from "../../domain/types";
import type { MonthPlanDay } from "../../domain/month";

const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

function taskSummary(day: MonthPlanDay): string {
  if (day.tasks.length === 0) return "没有任务";
  const unfinished = day.tasks.length - day.completed;
  return `${day.tasks.length} 项任务，完成 ${day.completed} 项${unfinished ? `，未完成 ${unfinished} 项` : ""}`;
}

export function MonthCalendar({ days, selectedDate, today, onSelect }: {
  days: MonthPlanDay[];
  selectedDate: DateKey;
  today: DateKey;
  onSelect(date: DateKey): void;
}) {
  return (
    <section className="month-calendar surface-card" aria-label="月历总览">
      <div className="month-calendar__weekdays" aria-hidden="true">
        {weekdays.map((weekday) => <span key={weekday}>周{weekday}</span>)}
      </div>
      <div className="month-calendar__grid">
        {days.map((day) => {
          const date = fromDateKey(day.date);
          const selected = day.date === selectedDate;
          const completed = day.tasks.length > 0 && day.completed === day.tasks.length;
          const classNames = [
            "month-calendar__day",
            !day.inCurrentMonth ? "month-calendar__day--outside" : "",
            day.date === today ? "month-calendar__day--today" : "",
            day.overdue > 0 ? "month-calendar__day--overdue" : "",
            completed ? "month-calendar__day--completed" : ""
          ].filter(Boolean).join(" ");

          return (
            <button
              key={day.date}
              type="button"
              className={classNames}
              aria-pressed={selected}
              aria-label={`${date.getMonth() + 1}月${date.getDate()}日，${taskSummary(day)}${day.overdue ? `，逾期 ${day.overdue} 项` : ""}`}
              onClick={() => onSelect(day.date)}
            >
              <span className="month-calendar__date">{date.getDate()}</span>
              {day.tasks.length > 0 && (
                <span className="month-calendar__progress" aria-hidden="true">
                  <i style={{ width: `${(day.completed / day.tasks.length) * 100}%` }} />
                </span>
              )}
              <small>{day.tasks.length > 0 ? `${day.completed}/${day.tasks.length}` : ""}</small>
              {day.overdue > 0 && <em>{day.overdue} 项逾期</em>}
            </button>
          );
        })}
      </div>
      <div className="month-calendar__legend" aria-label="月历标记说明">
        <span><i className="month-calendar__legend-dot month-calendar__legend-dot--today" />今天</span>
        <span><i className="month-calendar__legend-dot month-calendar__legend-dot--done" />全部完成</span>
        <span><i className="month-calendar__legend-dot month-calendar__legend-dot--overdue" />有逾期</span>
      </div>
    </section>
  );
}
