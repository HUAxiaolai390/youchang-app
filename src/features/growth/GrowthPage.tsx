import { useState, type CSSProperties } from "react";
import { useAppState } from "../../app/AppStateProvider";
import { AchievementMedal } from "../../components/AchievementMedal";
import { achievementTierLabels, getAchievements, normalizeFeaturedAchievementIds } from "../../domain/achievements";
import { toDateKey } from "../../domain/date";
import { experiencePerLevel, getFocusLevel, getFocusProgress, getLevelExperience } from "../../domain/focus";
import { getActivityHeatmap, getCurrentStreak, getPeriodStat, getSevenDayStats, getTotalCompleted } from "../../domain/stats";
import { formatTrackedTime, getTimeAllocation } from "../../domain/time";
import { getReviewWeekEnd, getWeeklyReview, getWeeklyReviewSnapshot, maximumWeeklyReviewLength } from "../../domain/weekly-review";
import type { DateKey } from "../../domain/types";
import { GoalSection } from "./GoalSection";

function formatDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function formatReviewRange(weekStart: DateKey): string {
  return `${formatDay(weekStart)}—${formatDay(getReviewWeekEnd(weekStart))}`;
}

const allocationColors = ["#e6a45c", "#8eaa7d", "#829db8", "#a787b5", "#bd8585", "#979084"];

function pieBackground(items: ReturnType<typeof getTimeAllocation>["items"]): string {
  let start = 0;
  const segments = items.map((item, index) => {
    const end = start + item.ratio * 100;
    const segment = `${allocationColors[index % allocationColors.length]} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

export function GrowthPage() {
  const { state, dispatch } = useAppState();
  const [timePeriod, setTimePeriod] = useState<"today" | "week">("today");
  const today = new Date();
  const todayKey = toDateKey(today);
  const rollingWeekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  const streak = getCurrentStreak(state, today);
  const days = getSevenDayStats(state, today);
  const totalCompleted = getTotalCompleted(state);
  const focus = getFocusProgress(state);
  const level = getFocusLevel(focus.experience);
  const levelExperience = getLevelExperience(focus.experience);
  const timeAllocation = getTimeAllocation(state, timePeriod === "today" ? todayKey : toDateKey(rollingWeekStart), todayKey);
  const todayStat = getPeriodStat(state, todayKey, todayKey);
  const weekStat = getPeriodStat(state, toDateKey(rollingWeekStart), todayKey);
  const reviewSnapshot = getWeeklyReviewSnapshot(state, today);
  const currentReview = getWeeklyReview(state, reviewSnapshot.weekStart);
  const [reviewSummary, setReviewSummary] = useState(() => currentReview?.summary ?? "");
  const [reviewAdjustment, setReviewAdjustment] = useState(() => currentReview?.adjustment ?? "");
  const [reviewSaveMessage, setReviewSaveMessage] = useState("");
  const recentReviews = [...(state.weeklyReviews ?? [])]
    .filter((review) => review.weekStart !== reviewSnapshot.weekStart)
    .sort((left, right) => right.weekStart.localeCompare(left.weekStart))
    .slice(0, 3);
  const heatmap = getActivityHeatmap(state, today);
  const achievements = getAchievements(state, today);
  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;
  const featuredIds = normalizeFeaturedAchievementIds(state.settings.featuredAchievementIds)
    .filter((id) => achievements.some((achievement) => achievement.id === id && achievement.unlocked));

  function toggleFeaturedAchievement(id: string) {
    const isFeatured = featuredIds.includes(id as typeof featuredIds[number]);
    if (!isFeatured && featuredIds.length >= 3) return;
    dispatch({
      type: "settings/featured-achievements",
      ids: isFeatured ? featuredIds.filter((featuredId) => featuredId !== id) : [...featuredIds, id]
    });
  }

  function saveReview() {
    const saved = dispatch({
      type: "weekly-review/save",
      weekStart: reviewSnapshot.weekStart,
      summary: reviewSummary,
      adjustment: reviewAdjustment
    });
    if (saved) setReviewSaveMessage(reviewSummary.trim() || reviewAdjustment.trim() ? "本周复盘已保存" : "本周复盘已清空");
  }

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

      <section className="growth-period-overview" aria-label="任务和时长概览">
        <article className="surface-card growth-period-card">
          <span>今天</span>
          <strong>{todayStat.completed}/{todayStat.total} 项</strong>
          <small>完成任务 · 记录 {formatTrackedTime(todayStat.trackedMinutes)}</small>
        </article>
        <article className="surface-card growth-period-card">
          <span>近 7 天</span>
          <strong>{weekStat.completed}/{weekStat.total} 项</strong>
          <small>活跃 {weekStat.activeDays} 天 · 记录 {formatTrackedTime(weekStat.trackedMinutes)}</small>
        </article>
      </section>

      <GoalSection now={today} />

      <section className="surface-card weekly-review-card" aria-labelledby="weekly-review-title">
        <div className="weekly-review-card__heading">
          <div>
            <p>WEEKLY REVIEW</p>
            <h2 id="weekly-review-title">本周复盘</h2>
          </div>
          <span>{formatReviewRange(reviewSnapshot.weekStart)}</span>
        </div>

        <div className="weekly-review-metrics" aria-label="本周复盘摘要">
          <article>
            <span>完成进度</span>
            <strong>{reviewSnapshot.completed}/{reviewSnapshot.total}</strong>
            <small>{reviewSnapshot.total ? `${Math.round(reviewSnapshot.ratio * 100)}% 已完成` : "还没有任务记录"}</small>
          </article>
          <article>
            <span>预计 / 实际</span>
            <strong>{formatTrackedTime(reviewSnapshot.estimatedMinutes)}</strong>
            <small>实际 {formatTrackedTime(reviewSnapshot.actualMinutes)}</small>
          </article>
          <article>
            <span>主要投入</span>
            <strong>{reviewSnapshot.topCategoryName ?? "暂无"}</strong>
            <small>本周记录 {formatTrackedTime(reviewSnapshot.trackedMinutes)}</small>
          </article>
        </div>

        <div className="weekly-review-form">
          <label>
            <span>本周总结</span>
            <textarea
              aria-label="本周总结"
              value={reviewSummary}
              maxLength={maximumWeeklyReviewLength}
              placeholder="例如：按计划完成了复习，运动也坚持得不错。"
              onChange={(event) => { setReviewSummary(event.target.value); setReviewSaveMessage(""); }}
            />
            <small>{reviewSummary.length}/{maximumWeeklyReviewLength}</small>
          </label>
          <label>
            <span>下周调整</span>
            <textarea
              aria-label="下周调整"
              value={reviewAdjustment}
              maxLength={maximumWeeklyReviewLength}
              placeholder="例如：少安排一项，把数学复习拆成更小的步骤。"
              onChange={(event) => { setReviewAdjustment(event.target.value); setReviewSaveMessage(""); }}
            />
            <small>{reviewAdjustment.length}/{maximumWeeklyReviewLength}</small>
          </label>
          <div className="weekly-review-form__actions">
            <span role="status">{reviewSaveMessage}</span>
            <button type="button" className="button button--primary" onClick={saveReview}>保存本周复盘</button>
          </div>
        </div>

        {recentReviews.length > 0 && <details className="weekly-review-history">
          <summary>查看最近的复盘（{recentReviews.length}）</summary>
          <div>
            {recentReviews.map((review) => <article key={review.weekStart}>
              <strong>{formatReviewRange(review.weekStart)}</strong>
              {review.summary && <p><span>总结</span>{review.summary}</p>}
              {review.adjustment && <p><span>调整</span>{review.adjustment}</p>}
            </article>)}
          </div>
        </details>}
      </section>

      <section className="surface-card activity-heatmap-card" aria-labelledby="activity-heatmap-title">
        <div className="growth-card__heading">
          <div>
            <h2 id="activity-heatmap-title">坚持热力图</h2>
            <span>近 12 周任务完成情况</span>
          </div>
          <strong>{weekStat.activeDays} 天活跃</strong>
        </div>
        <div className="activity-heatmap-scroll">
          <div className="activity-heatmap-weekdays" aria-hidden="true"><span>一</span><span>三</span><span>五</span><span>日</span></div>
          <div className="activity-heatmap" role="img" aria-label="近十二周任务完成热力图">
            {heatmap.map((day) => (
              <span
                key={day.date}
                className={`activity-heatmap__day activity-heatmap__day--${day.level}${day.isFuture ? " activity-heatmap__day--future" : ""}`}
                aria-label={`${formatDay(day.date)}，${day.total > 0 ? `完成 ${day.completed}/${day.total} 项` : "没有任务"}，记录 ${formatTrackedTime(day.trackedMinutes)}`}
                title={`${formatDay(day.date)} · ${day.completed}/${day.total} 项 · ${formatTrackedTime(day.trackedMinutes)}`}
              />
            ))}
          </div>
        </div>
        <div className="activity-heatmap-legend" aria-hidden="true"><span>少</span><i /><i /><i /><i /><i /><span>多</span></div>
      </section>

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
          <div className="time-allocation-visual">
            <div
              className="time-allocation-pie"
              style={{ "--pie-background": pieBackground(timeAllocation.items) } as CSSProperties}
              role="img"
              aria-label={`分类时间饼图，共 ${formatTrackedTime(timeAllocation.totalMinutes)}`}
            >
              <div><strong>{formatTrackedTime(timeAllocation.totalMinutes)}</strong><span>总记录</span></div>
            </div>
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

      <section className="surface-card achievement-wall" aria-labelledby="achievement-wall-title">
        <div className="achievement-wall__heading">
          <div>
            <p>ACHIEVEMENTS</p>
            <h2 id="achievement-wall-title" tabIndex={-1}>成就勋章</h2>
          </div>
          <div className="achievement-wall__summary">
            <strong>{unlockedCount} / {achievements.length}</strong>
            <span>已解锁 · 首页展示 {featuredIds.length}/3</span>
          </div>
        </div>
        <p className="achievement-wall__hint">
          点击已解锁的勋章，就能把它挂到首页。首页最多展示三枚；满三枚时先取消一枚。
        </p>
        <div className="achievement-grid">
          {achievements.map((achievement) => {
            const isFeatured = featuredIds.includes(achievement.id);
            const selectionFull = featuredIds.length >= 3 && !isFeatured;
            return (
              <article className={`achievement-card achievement-card--${achievement.tier}${achievement.unlocked ? "" : " achievement-card--locked"}${isFeatured ? " achievement-card--featured" : ""}`} key={achievement.id}>
                <div className="achievement-card__topline">
                  <span>{achievementTierLabels[achievement.tier]}</span>
                  {isFeatured && <strong>首页展示</strong>}
                </div>
                <AchievementMedal achievement={achievement} hideTier />
                <p>{achievement.description}</p>
                <div className="achievement-card__progress" aria-label={`${achievement.name}进度：${achievement.progressLabel}`}>
                  <span style={{ width: `${achievement.ratio * 100}%` }} />
                </div>
                <div className="achievement-card__footer">
                  <span>{achievement.progressLabel}</span>
                  <button
                    type="button"
                    aria-pressed={isFeatured}
                    disabled={!achievement.unlocked || selectionFull}
                    onClick={() => toggleFeaturedAchievement(achievement.id)}
                  >
                    {!achievement.unlocked ? "未解锁" : isFeatured ? "取消展示" : selectionFull ? "展示位已满" : "展示到首页"}
                  </button>
                </div>
              </article>
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
