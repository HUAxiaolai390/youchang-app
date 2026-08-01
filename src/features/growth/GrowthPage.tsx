import { useAppState } from "../../app/AppStateProvider";
import { getCurrentStreak, getSevenDayStats, getTotalCompleted } from "../../domain/stats";

function formatDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

export function GrowthPage() {
  const { state } = useAppState();
  const today = new Date();
  const streak = getCurrentStreak(state, today);
  const days = getSevenDayStats(state, today);
  const totalCompleted = getTotalCompleted(state);

  return (
    <section className="growth-page" aria-label="成长统计">
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
