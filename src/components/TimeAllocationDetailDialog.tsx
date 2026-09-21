import { useAppState } from "../app/AppStateProvider";
import { formatTrackedTime, type TaskTimeAllocationItem, type TaskTimeAllocationSource } from "../domain/time";

function sourceLabel(source: TaskTimeAllocationSource): string {
  if (source.kind === "fixed") return "固定任务";
  if (source.kind === "scheduled") return "临时任务";
  return "自由记录";
}

export function TimeAllocationDetailDialog({
  item,
  onCancel
}: {
  item: TaskTimeAllocationItem;
  onCancel(): void;
}) {
  const { state, dispatch } = useAppState();
  const goals = state.goals ?? [];

  return (
    <div className="confirm-backdrop">
      <section className="confirm-dialog time-allocation-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="time-allocation-detail-title">
        <div className="time-allocation-detail-dialog__heading">
          <div>
            <h2 id="time-allocation-detail-title">{item.taskTitle}</h2>
            <p>{formatTrackedTime(item.minutes)} · {item.sources.length} 条记录</p>
          </div>
          <button type="button" className="button" onClick={onCancel}>关闭</button>
        </div>
        <p className="settings-muted">下面是这段时间的来源。修改长期目标后，之后的统计会按你的选择合并。</p>
        <div className="time-allocation-detail-list">
          {item.sources.map((source) => (
            <div className="time-allocation-detail-row" key={`${source.kind}:${source.id}`}>
              <div>
                <strong>{source.title}</strong>
                <small>{sourceLabel(source)} · {source.date} · {formatTrackedTime(source.minutes)}</small>
              </div>
              {goals.length === 0 ? <span className="settings-muted">暂无目标</span> : (
                <label className="time-allocation-detail-goal">
                  <span>归入目标</span>
                  <select
                    aria-label={`调整：${source.title}`}
                    value={source.goalId ?? ""}
                    onChange={(event) => {
                      const goalId = event.target.value;
                      if (!goalId) return;
                      dispatch(source.kind === "fixed"
                        ? { type: "fixed/set-goal", recordId: source.id, goalId }
                        : source.kind === "scheduled"
                          ? { type: "scheduled/set-goal", id: source.id, goalId }
                          : { type: "time-entry/set-goal", id: source.id, goalId });
                    }}
                  >
                    <option value="">未关联</option>
                    {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                  </select>
                </label>
              )}
            </div>
          ))}
        </div>
        <div className="confirm-dialog__actions">
          <button type="button" className="button button--primary" onClick={onCancel}>完成</button>
        </div>
      </section>
    </div>
  );
}
