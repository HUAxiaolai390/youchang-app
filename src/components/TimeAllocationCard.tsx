import { useState, type CSSProperties } from "react";
import { useAppState } from "../app/AppStateProvider";
import { toDateKey } from "../domain/date";
import { formatTrackedTime, getTaskTimeAllocation } from "../domain/time";

type AllocationStyle = CSSProperties & {
  "--allocation-color"?: string;
  "--pie-background"?: string;
};

function allocationColor(index: number): string {
  const hue = Math.round((32 + index * 137.508) % 360);
  return `hsl(${hue} 46% 56%)`;
}

function pieBackground(items: ReturnType<typeof getTaskTimeAllocation>["items"]): string {
  let start = 0;
  const segments = items.map((item, index) => {
    const end = start + item.ratio * 100;
    const segment = `${allocationColor(index)} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

export function TimeAllocationCard({ now = new Date() }: { now?: Date }) {
  const { state } = useAppState();
  const [period, setPeriod] = useState<"today" | "week">("today");
  const todayKey = toDateKey(now);
  const rollingWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const allocation = getTaskTimeAllocation(state, period === "today" ? todayKey : toDateKey(rollingWeekStart), todayKey);

  return (
    <section className="surface-card time-allocation-card" aria-labelledby="time-allocation-title">
      <div className="time-allocation-card__heading">
        <div>
          <p>TIME ALLOCATION</p>
          <h2 id="time-allocation-title">时间分配</h2>
        </div>
        <div className="time-period-switch" aria-label="时间分配范围">
          <button type="button" aria-pressed={period === "today"} onClick={() => setPeriod("today")}>今天</button>
          <button type="button" aria-pressed={period === "week"} onClick={() => setPeriod("week")}>近 7 天</button>
        </div>
      </div>
      <div className="time-allocation-card__total">
        <strong>{formatTrackedTime(allocation.totalMinutes)}</strong>
        <span>{period === "today" ? "今天已记录" : "近七天已记录"}</span>
      </div>
      {allocation.items.length === 0 ? (
        <p className="time-allocation-card__empty">完成一次正计时，或在任务旁填写实际用时后，这里会按具体任务显示时间去向。</p>
      ) : (
        <div className="time-allocation-visual">
          <div
            className="time-allocation-pie"
            style={{ "--pie-background": pieBackground(allocation.items) } as AllocationStyle}
            role="img"
            aria-label={`任务时间饼图，共 ${formatTrackedTime(allocation.totalMinutes)}`}
          >
            <div><strong>{formatTrackedTime(allocation.totalMinutes)}</strong><span>总记录</span></div>
          </div>
          <div className="time-allocation-list">
            {allocation.items.map((item, index) => {
              const style = { "--allocation-color": allocationColor(index) } as AllocationStyle;
              return (
                <div className="time-allocation-row" key={item.taskKey} style={style} aria-label={`${item.taskTitle} ${formatTrackedTime(item.minutes)}，占 ${Math.round(item.ratio * 100)}%`}>
                  <span className="time-allocation-row__icon" aria-hidden="true">{item.categoryIcon}</span>
                  <div className="time-allocation-row__main">
                    <div>
                      <span className="time-allocation-row__title"><strong>{item.taskTitle}</strong><small>{item.categoryName}</small></span>
                      <span>{formatTrackedTime(item.minutes)} · {Math.round(item.ratio * 100)}%</span>
                    </div>
                    <div className="time-allocation-row__track" aria-hidden="true"><span className="time-allocation-row__bar" style={{ width: `${item.ratio * 100}%` }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
