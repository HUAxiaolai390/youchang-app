import { useState, type CSSProperties } from "react";
import { useAppState } from "../app/AppStateProvider";
import { toDateKey } from "../domain/date";
import { formatTrackedTime, getTaskTimeAllocation } from "../domain/time";

type AllocationStyle = CSSProperties & {
  "--allocation-color"?: string;
};

type AllocationItem = ReturnType<typeof getTaskTimeAllocation>["items"][number];

type ChartCallout = {
  item: AllocationItem;
  color: string;
  anchorX: number;
  anchorY: number;
  elbowX: number;
  elbowY: number;
  endX: number;
  endY: number;
  textX: number;
  textY: number;
  textAnchor: "start" | "middle" | "end";
  position: "right" | "left";
  bent: boolean;
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

const maxChartCallouts = 8;

type CalloutSeed = {
  item: AllocationItem;
  color: string;
  anchorX: number;
  anchorY: number;
  position: "right" | "left";
};

function spreadLabelYs(seeds: CalloutSeed[]): Map<string, number> {
  const minimumY = 22;
  const maximumY = 245;
  const preferredGap = 31;
  const sorted = [...seeds].sort((left, right) => left.anchorY - right.anchorY);
  if (sorted.length === 0) return new Map();

  const gap = sorted.length === 1
    ? preferredGap
    : Math.min(preferredGap, (maximumY - minimumY) / (sorted.length - 1));
  const originalYs = sorted.map((seed) => Math.min(maximumY, Math.max(minimumY, seed.anchorY - 3)));
  const labelYs = [...originalYs];

  for (let index = 1; index < labelYs.length; index += 1) {
    labelYs[index] = Math.max(labelYs[index], labelYs[index - 1] + gap);
  }

  const originalMean = originalYs.reduce((sum, value) => sum + value, 0) / originalYs.length;
  const spreadMean = labelYs.reduce((sum, value) => sum + value, 0) / labelYs.length;
  const minimumShift = minimumY - labelYs[0];
  const maximumShift = maximumY - labelYs[labelYs.length - 1];
  const shift = Math.min(maximumShift, Math.max(minimumShift, originalMean - spreadMean));

  return new Map(sorted.map((seed, index) => [seed.item.taskKey, labelYs[index] + shift]));
}

function chartCallouts(items: AllocationItem[], colors: Map<string, string>): ChartCallout[] {
  const centerX = 180;
  const centerY = 140;
  let startRatio = 0;
  const seeds = items.slice(0, maxChartCallouts).map((item): CalloutSeed => {
    const radians = (-90 + (startRatio + item.ratio / 2) * 360) * Math.PI / 180;
    const seed = {
      item,
      color: colors.get(item.taskKey) ?? allocationPalette[0],
      anchorX: centerX + Math.cos(radians) * 83,
      anchorY: centerY + Math.sin(radians) * 83,
      position: Math.cos(radians) < 0 ? "left" as const : "right" as const
    };
    startRatio += item.ratio;
    return seed;
  });

  const labelYs = new Map<string, number>();
  (["left", "right"] as const).forEach((position) => {
    spreadLabelYs(seeds.filter((seed) => seed.position === position)).forEach((value, key) => labelYs.set(key, value));
  });

  return seeds.map((seed): ChartCallout => {
    const direction = seed.position === "left" ? -1 : 1;
    const textY = labelYs.get(seed.item.taskKey) ?? seed.anchorY - 3;
    const endY = textY - 3;
    return {
      ...seed,
      elbowX: seed.anchorX + direction * 8,
      elbowY: seed.anchorY,
      endX: seed.anchorX + direction * 16,
      endY,
      textX: seed.anchorX + direction * 22,
      textY,
      textAnchor: seed.position === "left" ? "end" : "start",
      bent: Math.abs(endY - seed.anchorY) > 8
    };
  });
}

function shortChartLabel(title: string): string {
  const characters = Array.from(title);
  return characters.length > 8 ? `${characters.slice(0, 7).join("")}…` : title;
}

function TimeAllocationChart({ items, colors, totalMinutes }: { items: AllocationItem[]; colors: Map<string, string>; totalMinutes: number }) {
  const callouts = chartCallouts(items, colors);
  let segmentStartRatio = 0;
  return (
    <svg className="time-allocation-chart" viewBox="0 0 360 280" role="img" aria-label={`任务时间饼图，共 ${formatTrackedTime(totalMinutes)}`}>
      <circle className="time-allocation-chart__base" cx="180" cy="140" r="68" pathLength="100" />
      {items.map((item) => {
        const startRatio = segmentStartRatio;
        segmentStartRatio += item.ratio;
        return <circle className="time-allocation-chart__segment" key={`segment:${item.taskKey}`} cx="180" cy="140" r="68" pathLength="100" stroke={colors.get(item.taskKey)} strokeDasharray={`${Math.max(item.ratio * 100 - 0.7, 0.2)} 100`} strokeDashoffset={-startRatio * 100} />;
      })}
      {callouts.map(({ item, color, anchorX, anchorY, elbowX, elbowY, endX, endY, textX, textY, textAnchor, position, bent }) => (
          <g key={`callout:${item.taskKey}`} data-callout-position={position} data-callout-bent={bent} data-anchor-x={anchorX} data-end-x={endX} aria-label={`图例：${item.taskTitle}，${formatTrackedTime(item.minutes)}`}>
            {bent
              ? <polyline className="time-allocation-chart__line" points={`${anchorX},${anchorY} ${elbowX},${elbowY} ${endX},${endY}`} stroke={color} />
              : <line className="time-allocation-chart__line" x1={anchorX} y1={anchorY} x2={endX} y2={endY} stroke={color} />}
            <circle className="time-allocation-chart__dot" cx={anchorX} cy={anchorY} r="2.8" fill={color} />
            <text className="time-allocation-chart__label" x={textX} y={textY} textAnchor={textAnchor}>
              <tspan className="time-allocation-chart__label-title" x={textX}>{shortChartLabel(item.taskTitle)}</tspan>
              <tspan className="time-allocation-chart__label-time" x={textX} dy="13">{formatTrackedTime(item.minutes)}</tspan>
            </text>
          </g>
      ))}
      <circle className="time-allocation-chart__center" cx="180" cy="140" r="51" />
      <text className="time-allocation-chart__total" x="180" y="137" textAnchor="middle">
        <tspan x="180">{formatTrackedTime(totalMinutes)}</tspan>
        <tspan className="time-allocation-chart__total-caption" x="180" dy="17">总记录</tspan>
      </text>
      {items.length > maxChartCallouts && <text className="time-allocation-chart__more" x="180" y="278" textAnchor="middle">图中显示用时最多的 8 项，完整记录见下方</text>}
    </svg>
  );
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
      {period === "week" && allocation.items.length > 0 && <p className="time-allocation-card__hint">已按长期目标智能合并，并尝试识别过去未关联目标的记录。</p>}
      {allocation.items.length === 0 ? (
        <p className="time-allocation-card__empty">完成一次正计时，或在任务旁填写实际用时后，这里会按具体任务显示时间去向。</p>
      ) : (
        <div className="time-allocation-visual">
          <TimeAllocationChart items={allocation.items} colors={colors} totalMinutes={allocation.totalMinutes} />
          <div className="time-allocation-list">
            {allocation.items.map((item) => {
              const style = { "--allocation-color": colors.get(item.taskKey) } as AllocationStyle;
              const detail = item.groupType === "goal"
                ? `长期目标${item.groupedTaskCount > 1 ? ` · 合并 ${item.groupedTaskCount} 项任务` : ""}${item.inferredTaskCount > 0 ? ` · 智能归入 ${item.inferredTaskCount} 项` : ""}`
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
