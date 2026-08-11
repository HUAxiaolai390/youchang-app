import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../app/AppStateProvider";
import { toDateKey } from "../domain/date";
import {
  describeReminderOverviewItem,
  getTaskReminderOverview,
  type ReminderOverviewStatus,
  type TaskReminderOverviewItem
} from "../domain/reminders";

const readSystemTime = () => new Date();
const groupOrder: ReminderOverviewStatus[] = ["missed", "snoozed", "upcoming"];
const groupLabels: Record<ReminderOverviewStatus, string> = {
  missed: "已错过",
  snoozed: "已推迟",
  upcoming: "即将开始"
};

export function TaskReminderOverview({
  now: readNow = readSystemTime,
  tickMilliseconds = 30_000
}: {
  now?(): Date;
  tickMilliseconds?: number;
}) {
  const { state, dispatch } = useAppState();
  const [currentTime, setCurrentTime] = useState(readNow);
  const [expanded, setExpanded] = useState(false);
  const items = useMemo(
    () => getTaskReminderOverview(state, currentTime),
    [currentTime, state]
  );
  const groups = useMemo(() => Object.fromEntries(groupOrder.map((status) => [
    status,
    items.filter((item) => item.status === status)
  ])) as Record<ReminderOverviewStatus, TaskReminderOverviewItem[]>, [items]);

  useEffect(() => {
    const refresh = () => setCurrentTime(readNow());
    const timer = window.setInterval(refresh, tickMilliseconds);
    const refreshWhenVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [readNow, tickMilliseconds]);

  function complete(item: TaskReminderOverviewItem) {
    dispatch(item.kind === "fixed"
      ? { type: "fixed/toggle", recordId: item.id }
      : { type: "scheduled/toggle", id: item.id });
  }

  function snooze(item: TaskReminderOverviewItem) {
    const until = new Date(readNow().getTime() + 10 * 60_000).toISOString();
    if (dispatch({ type: "reminder/snooze", kind: item.kind, id: item.id, until })) {
      setCurrentTime(readNow());
    }
  }

  function moveOrSkip(item: TaskReminderOverviewItem) {
    if (item.kind === "scheduled") {
      dispatch({ type: "scheduled/postpone-tomorrow", id: item.id });
      return;
    }
    const record = state.fixedRecords.find((candidate) => candidate.id === item.id);
    if (record) {
      dispatch({ type: "fixed/toggle-skip-date", id: record.templateId, date: record.date });
    }
  }

  return (
    <section className={`surface-card reminder-overview${expanded ? " reminder-overview--open" : ""}`} aria-labelledby="reminder-overview-title">
      <button
        type="button"
        className="reminder-overview__toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="reminder-overview__icon" aria-hidden="true">◷</span>
        <span className="reminder-overview__heading">
          <strong id="reminder-overview-title">提醒中心</strong>
          <small>{items.length ? `${items.length} 项需要留意` : "今天还没有设置提醒"}</small>
        </span>
        <span className="reminder-overview__counts" aria-label="提醒数量">
          <span><b>{groups.upcoming.length}</b> 即将</span>
          <span><b>{groups.missed.length}</b> 错过</span>
          <span><b>{groups.snoozed.length}</b> 推迟</span>
        </span>
        <span className="reminder-overview__action">{expanded ? "收起" : "展开"}</span>
      </button>
      {expanded && (
        <div className="reminder-overview__content">
          {items.length === 0 ? (
            <p className="reminder-overview__empty">给任务填写开始时间并选择提醒后，会集中显示在这里。</p>
          ) : groupOrder.map((status) => groups[status].length > 0 && (
            <section className="reminder-group" key={status} aria-labelledby={`reminder-group-${status}`}>
              <div className="reminder-group__heading">
                <h3 id={`reminder-group-${status}`}>{groupLabels[status]}</h3>
                <span>{groups[status].length} 项</span>
              </div>
              <ul>
                {groups[status].map((item) => (
                  <li className={`reminder-item reminder-item--${status}`} key={`${item.kind}-${item.id}`}>
                    <span className="reminder-item__time">{item.plannedStartTime}</span>
                    <span className="reminder-item__copy">
                      <strong>{item.title}</strong>
                      <small>{describeReminderOverviewItem(item, currentTime)}</small>
                    </span>
                    <span className="reminder-item__actions">
                      <button type="button" className="reminder-item__complete" onClick={() => complete(item)} aria-label={`完成提醒任务：${item.title}`}>完成</button>
                      {status !== "upcoming" && <button type="button" onClick={() => snooze(item)} aria-label={`10 分钟后提醒：${item.title}`}>10 分钟后</button>}
                      <button type="button" onClick={() => moveOrSkip(item)}>
                        {item.kind === "scheduled" ? "改到明天" : item.date === toDateKey(currentTime) ? "今天跳过" : "跳过这次"}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
