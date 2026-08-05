import { useAppState } from "../../app/AppStateProvider";
import { experiencePerLevel, getFocusLevel, getFocusProgress, getLevelExperience } from "../../domain/focus";
import { getCurrentStreak, getSevenDayStats, getTotalCompleted } from "../../domain/stats";

function formatDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function formatFocusTime(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} 小时` : `${hours} 小时 ${remainder} 分`;
}

export function GrowthPage() {
  const { state } = useAppState();
  const today = new Date();
  const streak = getCurrentStreak(state, today);
  const days = getSevenDayStats(state, today);
  const totalCompleted = getTotalCompleted(state);
  const focus = getFocusProgress(state);
  const level = getFocusLevel(focus.experience);
  const levelExperience = getLevelExperience(focus.experience);

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
          <strong>{formatFocusTime(focus.totalFocusMinutes)}</strong>
        </article>
        <article className="surface-card growth-mini-card">
          <span aria-hidden="true">★</span>
          <p>累计经验</p>
          <strong>{focus.experience} EXP</strong>
        </article>
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
