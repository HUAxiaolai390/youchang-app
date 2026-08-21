import { useState, type CSSProperties } from "react";
import { useAppState } from "../app/AppStateProvider";
import { toDateKey } from "../domain/date";
import { formatTrackedTime, getTaskTimeAllocation } from "../domain/time";

type AllocationStyle = CSSProperties & {
  "--allocation-color"?: string;
  "--pie-background"?: string;
};

export const allocationPalette = [
  "#b86f52",
  "#6f8f72",
  "#6e83a6",
  "#c39a4a",
  "#9b708e",
  "#5f8f8a",
  "#9b7a5c",
  "#7a709e"
] as const;

function stableHash(value: string): number {
  let hash = 0;
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

function allocationColors(items: ReturnType<typeof getTaskTimeAllocation>["items"]): Map<string, string> {
  const colors = new Map<string, string>();
  const occupied = new Set<number>();
  [...items].sort((left, right) => left.taskKey.localeCompare(right.taskKey)).forEach((item) => {
    let colorIndex = stableHash(item.taskKey) % allocationPalette.length;
    if (items.length <= allocationPalette.length) {
      while (occupied.has(colorIndex)) colorIndex = (colorIndex + 1) % allocationPalette.length;
      occupied.add(colorIndex);
    }
    colors.set(item.taskKey, allocationPalette[colorIndex]);
  });
  return colors;
}

function pieBackground(items: ReturnType<typeof getTaskTimeAllocation>["items"], colors: Map<string, string>): string {
  let start = 0;
  const segments = items.map((item) => {
    const end = start + item.ratio * 100;
    const segment = `${colors.get(item.taskKey)} ${start}% ${end}%`;
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
  const allocation = getTaskTimeAllocation(
    state,
    period === "today" ? todayKey : toDateKey(rollingWeekStart),
    todayKey,
    { groupByGoal: period === "week" }
  );
  const colors = allocationColors(allocation.items);

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
      {period === "week" && allocation.items.length > 0 && <p className="time-allocation-card__hint">已按长期目标智能合并；未关联目标的记录按任务名称整理。</p>}
      {allocation.items.length === 0 ? (
        <p className="time-allocation-card__empty">完成一次正计时，或在任务旁填写实际用时后，这里会按具体任务显示时间去向。</p>
      ) : (
        <div className="time-allocation-visual">
          <div
            className="time-allocation-pie"
            style={{ "--pie-background": pieBackground(allocation.items, colors) } as AllocationStyle}
            role="img"
            aria-label={`任务时间饼图，共 ${formatTrackedTime(allocation.totalMinutes)}`}
          >
            <div><strong>{formatTrackedTime(allocation.totalMinutes)}</strong><span>总记录</span></div>
          </div>
          <div className="time-allocation-list">
            {allocation.items.map((item) => {
              const style = { "--allocation-color": colors.get(item.taskKey) } as AllocationStyle;
              const detail = item.groupType === "goal"
                ? `长期目标${item.groupedTaskCount > 1 ? ` · 合并 ${item.groupedTaskCount} 项任务` : ""}`
                : item.categoryName;
              return (
                <div className="time-allocation-row" key={item.taskKey} style={style} aria-label={`${item.taskTitle} ${formatTrackedTime(item.minutes)}，占 ${Math.round(item.ratio * 100)}%`}>
                  <span className="time-allocation-row__icon" aria-hidden="true">{item.categoryIcon}</span>
                  <div className="time-allocation-row__main">
                    <div>
                      <span className="time-allocation-row__title"><strong>{item.taskTitle}</strong><small>{detail}</small></span>
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
