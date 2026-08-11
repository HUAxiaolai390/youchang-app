import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { useAppState } from "../../app/AppStateProvider";
import { fromDateKey } from "../../domain/date";
import { getHabitStats } from "../../domain/habits";
import { formatFixedRepeatRule } from "../../domain/repeat";

const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

function formatDayLabel(dateKey: string): string {
  const date = fromDateKey(dateKey as `${number}-${number}-${number}`);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function HabitDetailDialog({ templateId, now = new Date(), onClose }: {
  templateId: string;
  now?: Date;
  onClose(): void;
}) {
  const { state } = useAppState();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const stats = useMemo(() => getHabitStats(state, templateId, now), [now, state, templateId]);
  const template = state.fixedTasks.find((task) => task.id === templateId);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => {
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
    };
  }, []);

  if (!stats || !template) return null;

  const completionPercent = Math.round(stats.completionRate30Days * 100);
  const firstWeekday = (fromDateKey(stats.days[0]!.date).getDay() + 6) % 7;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Tab") {
      event.preventDefault();
      closeButtonRef.current?.focus();
    }
  }

  return (
    <div className="habit-detail-backdrop">
      <section className="habit-detail" role="dialog" aria-modal="true" aria-labelledby="habit-detail-title" onKeyDown={handleKeyDown}>
        <header className="habit-detail__header">
          <div>
            <p>HABIT DETAIL · 习惯详情</p>
            <h2 id="habit-detail-title">{stats.title}</h2>
            <span>{formatFixedRepeatRule(template.repeatRule)} · 最近 30 天</span>
          </div>
          <button ref={closeButtonRef} type="button" aria-label="关闭习惯详情" onClick={onClose}>×</button>
        </header>

        <div className="habit-detail__metrics" aria-label={`${stats.title}习惯统计`}>
          <article><span>当前连续</span><strong>{stats.currentStreak}<small> 次</small></strong></article>
          <article><span>最长连续</span><strong>{stats.longestStreak}<small> 次</small></strong></article>
          <article><span>30 天完成率</span><strong>{completionPercent}<small>%</small></strong></article>
          <article><span>累计投入</span><strong>{stats.totalActualTimeLabel}</strong></article>
        </div>

        <section className="habit-detail__calendar" aria-labelledby="habit-calendar-title">
          <div className="habit-detail__calendar-heading">
            <div>
              <strong id="habit-calendar-title">近 30 天记录</strong>
              <small>{stats.completed30Days}/{stats.due30Days} 次按计划完成</small>
            </div>
            <span>{completionPercent}%</span>
          </div>
          <div className="habit-detail__progress" aria-label={`近30天完成率 ${completionPercent}%`}>
            <span style={{ width: `${completionPercent}%` }} />
          </div>
          <div className="habit-detail__weekdays" aria-hidden="true">
            {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="habit-detail__days">
            {Array.from({ length: firstWeekday }, (_, index) => <i key={`pad-${index}`} aria-hidden="true" />)}
            {stats.days.map((day) => {
              const status = day.due ? day.completed ? "已完成" : day.isToday ? "待完成" : "未完成" : "无需完成";
              const date = fromDateKey(day.date);
              return (
                <span
                  key={day.date}
                  className={`habit-detail__day${day.due ? day.completed ? " habit-detail__day--done" : " habit-detail__day--missed" : ""}${day.isToday ? " habit-detail__day--today" : ""}`}
                  aria-label={`${formatDayLabel(day.date)}，${status}${day.actualMinutes ? `，实际 ${day.actualMinutes} 分钟` : ""}`}
                  title={`${formatDayLabel(day.date)} · ${status}`}
                >{date.getDate()}</span>
              );
            })}
          </div>
          <div className="habit-detail__legend" aria-label="记录颜色说明">
            <span><i className="habit-detail__legend-dot habit-detail__legend-dot--done" />完成</span>
            <span><i className="habit-detail__legend-dot habit-detail__legend-dot--missed" />未完成</span>
            <span><i className="habit-detail__legend-dot" />无需完成</span>
          </div>
        </section>

        <p className="habit-detail__note">连续次数按这项任务实际需要完成的日期计算，休息日和跳过日期不会打断连续记录。</p>
      </section>
    </div>
  );
}
