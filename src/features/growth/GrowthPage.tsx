import { useState } from "react";
import { useAppState } from "../../app/AppStateProvider";
import { toDateKey } from "../../domain/date";
import { experiencePerLevel, getFocusLevel, getFocusProgress, getLevelExperience } from "../../domain/focus";
import { getCurrentStreak, getSevenDayStats, getTotalCompleted } from "../../domain/stats";
import { formatTrackedTime, getTimeAllocation } from "../../domain/time";

function formatDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

export function GrowthPage() {
  const { state } = useAppState();
  const [timePeriod, setTimePeriod] = useState<"today" | "week">("today");
  const today = new Date();
  const todayKey = toDateKey(today);
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  const streak = getCurrentStreak(state, today);
  const days = getSevenDayStats(state, today);
  const totalCompleted = getTotalCompleted(state);
  const focus = getFocusProgress(state);
  const level = getFocusLevel(focus.experience);
  const levelExperience = getLevelExperience(focus.experience);
  const timeAllocation = getTimeAllocation(state, timePeriod === "today" ? todayKey : toDateKey(weekStart), todayKey);

  return (
    <section className="growth-page" aria-label="成长统计">
      <article className="surface-card growth-level-card">
        <div className="growth-level-card__badge" aria-hidden="true">Lv.{level}</div>
        <div className="growth-level-card__copy">
          <p>专注等级</p>
          <strong>等级 {level}</strong>
          <div className="growth-level-card__bar" aria-label={`本级经验 ${levelExperience}/${experiencePerLevel}`}>
            <span style={{ width: `${levelExperience}%` }} />
          </div>
          <small>再获得 {experiencePerLevel - levelExperience} EXP 升级</small>
        </div>
      </article>

      <section className="growth-focus-stats" aria-label="专注成长数据">
        <article className="surface-card growth-mini-card">
          <span aria-hidden="true">✦</span>
          <p>专注次数</p>
          <strong>{focus.completedSessions} 次</strong>
        </article>
        <article className="surface-card growth-mini-card">
          <span aria-hidden="true">◷</span>
          <p>累计专注</p>
          <strong>{formatTrackedTime(focus.totalFocusMinutes)}</strong>
        </article>
        <article className="surface-card growth-mini-card">
          <span aria-hidden="true">★</span>
          <p>累计经验</p>
          <strong>{focus.experience} EXP</strong>
        </article>
      </section>

      <section className="surface-card time-allocation-card" aria-labelledby="time-allocation-title">
        <div className="time-allocation-card__heading">
          <div>
            <p>TIME ALLOCATION</p>
            <h2 id="time-allocation-title">时间分配</h2>
          </div>
          <div className="time-period-switch" aria-label="时间分配范围">
            <button type="button" aria-pressed={timePeriod === "today"} onClick={() => setTimePeriod("today")}>今天</button>
            <button type="button" aria-pressed={timePeriod === "week"} onClick={() => setTimePeriod("week")}>近 7 天</button>
          </div>
        </div>
        <div className="time-allocation-card__total">
          <strong>{formatTrackedTime(timeAllocation.totalMinutes)}</strong>
          <span>{timePeriod === "today" ? "今天已记录" : "近七天已记录"}</span>
        </div>
        {timeAllocation.items.length === 0 ? (
          <p className="time-allocation-card__empty">完成一次正计时，或在任务旁填写实际用时后，这里就会显示时间去向。</p>
        ) : (
          <div className="time-allocation-list">
            {timeAllocation.items.map((item, index) => (
              <div className="time-allocation-row" key={item.categoryId} aria-label={`${item.categoryName} ${formatTrackedTime(item.minutes)}，占 ${Math.round(item.ratio * 100)}%`}>
                <span className={`time-allocation-row__icon time-allocation-row__icon--${index % 6}`} aria-hidden="true">{item.categoryIcon}</span>
                <div className="time-allocation-row__main">
                  <div><strong>{item.categoryName}</strong><span>{formatTrackedTime(item.minutes)} · {Math.round(item.ratio * 100)}%</span></div>
                  <div className="time-allocation-row__track" aria-hidden="true"><span className={`time-allocation-row__bar time-allocation-row__bar--${index % 6}`} style={{ width: `${item.ratio * 100}%` }} /></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <article className="surface-card growth-card growth-card--streak">
        <p>当前坚持</p>
        <strong>连续 {streak} 天</strong>
      </article>

      <section className="surface-card growth-card" aria-labelledby="seven-day-title">
        <div className="growth-card__heading">
          <h2 id="seven-day-title">最近七天</h2>
          <span>每日完成比例</span>
        </div>
        <div className="growth-bars">
          {days.map((day) => {
            const label = day.hasData
              ? `${formatDay(day.date)}，完成 ${day.completed}/${day.total}`
              : `${formatDay(day.date)}，无数据`;

            return (
              <div className="growth-bars__day" key={day.date} aria-label={label}>
                <div className="growth-bars__track" aria-hidden="true">
                  {day.hasData && <span style={{ height: `${Math.round(day.ratio * 100)}%` }} />}
                </div>
                <span className="growth-bars__fraction">{day.hasData ? `${day.completed}/${day.total}` : "—"}</span>
                <span className="growth-bars__date" aria-hidden="true">{formatDay(day.date).replace("日", "")}</span>
              </div>
            );
          })}
        </div>
      </section>

      <article className="surface-card growth-card growth-card--total">
        <p>累计完成 {totalCompleted} 项</p>
      </article>
    </section>
  );
}
