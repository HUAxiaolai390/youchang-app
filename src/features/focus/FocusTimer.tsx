import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useAppState } from "../../app/AppStateProvider";
import { toDateKey } from "../../domain/date";
import {
  experiencePerLevel,
  getFocusExperience,
  getFocusLevel,
  getFocusProgress,
  getLevelExperience
} from "../../domain/focus";
import { stopwatchSecondsToMinutes } from "../../domain/time";

type TimerPhase = "focus" | "break";
type TimerMode = "countdown" | "stopwatch";

type FocusTimerProps = {
  onFocusComplete(): void;
};

const presets = [
  { focusMinutes: 25, breakMinutes: 5, label: "25 / 5" },
  { focusMinutes: 50, breakMinutes: 10, label: "50 / 10" }
] as const;

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function FocusTimer({ onFocusComplete }: FocusTimerProps) {
  const { state, dispatch } = useAppState();
  const focus = getFocusProgress(state);
  const today = toDateKey(new Date());
  const [mode, setMode] = useState<TimerMode>("countdown");
  const [phase, setPhase] = useState<TimerPhase>("focus");
  const [remainingSeconds, setRemainingSeconds] = useState(focus.focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [draftFocusMinutes, setDraftFocusMinutes] = useState(focus.focusMinutes);
  const [draftBreakMinutes, setDraftBreakMinutes] = useState(focus.breakMinutes);
  const [announcement, setAnnouncement] = useState("准备好就开始一小段专注吧");
  const deadline = useRef<number | null>(null);
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [stopwatchAccumulatedSeconds, setStopwatchAccumulatedSeconds] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const stopwatchStartedAt = useRef<number | null>(null);
  const [stopwatchTarget, setStopwatchTarget] = useState("");
  const [stopwatchCategoryId, setStopwatchCategoryId] = useState(state.categories[0]?.id ?? "other");
  const [stopwatchTitle, setStopwatchTitle] = useState("自由记录");

  const stopwatchTargets = useMemo(() => {
    const fixed = state.fixedRecords
      .filter((record) => record.date === today)
      .map((record) => ({ value: `fixed:${record.id}`, label: `每日固定 · ${record.titleSnapshot}` }));
    const scheduled = state.scheduledTasks
      .filter((task) => task.scheduledDate === today && !["rescheduled", "archived"].includes(task.status))
      .map((task) => ({ value: `scheduled:${task.id}`, label: `今日安排 · ${task.title}` }));
    return [...fixed, ...scheduled];
  }, [state.fixedRecords, state.scheduledTasks, today]);

  const phaseMinutes = phase === "focus" ? focus.focusMinutes : focus.breakMinutes;
  const totalSeconds = phaseMinutes * 60;
  const elapsedRatio = Math.min(1, Math.max(0, 1 - remainingSeconds / totalSeconds));
  const level = getFocusLevel(focus.experience);
  const levelExperience = getLevelExperience(focus.experience);
  const stopwatchRatio = (stopwatchSeconds % 3600) / 3600;
  const ringStyle = {
    "--timer-progress": `${(mode === "countdown" ? elapsedRatio : stopwatchRatio) * 360}deg`
  } as CSSProperties;

  useEffect(() => {
    if (isRunning) return;
    setDraftFocusMinutes(focus.focusMinutes);
    setDraftBreakMinutes(focus.breakMinutes);
  }, [focus.breakMinutes, focus.focusMinutes, isRunning]);

  useEffect(() => {
    if (!isRunning || deadline.current === null) return;

    const tick = () => {
      if (deadline.current === null) return;
      const next = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemainingSeconds(next);

      if (next > 0) return;

      deadline.current = null;
      setIsRunning(false);

      if (phase === "focus") {
        const saved = dispatch({ type: "focus/session-complete", minutes: focus.focusMinutes });
        setPhase("break");
        setRemainingSeconds(focus.breakMinutes * 60);
        setAnnouncement(saved
          ? `专注完成，获得 ${getFocusExperience(focus.focusMinutes)} 点经验。现在休息一下吧`
          : "专注完成，但成长记录保存失败了");
        if (saved) onFocusComplete();
      } else {
        setPhase("focus");
        setRemainingSeconds(focus.focusMinutes * 60);
        setAnnouncement("休息结束，可以开始下一轮专注了");
      }
    };

    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [dispatch, focus.breakMinutes, focus.focusMinutes, isRunning, onFocusComplete, phase]);

  useEffect(() => {
    if (!stopwatchRunning || stopwatchStartedAt.current === null) return;

    const tick = () => {
      if (stopwatchStartedAt.current === null) return;
      setStopwatchSeconds(stopwatchAccumulatedSeconds + Math.floor((Date.now() - stopwatchStartedAt.current) / 1000));
    };

    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [stopwatchAccumulatedSeconds, stopwatchRunning]);

  function startTimer() {
    deadline.current = Date.now() + remainingSeconds * 1000;
    setIsRunning(true);
    setAnnouncement(phase === "focus" ? "小猫正在陪你专注" : "安心休息，等会再继续");
  }

  function pauseTimer() {
    if (deadline.current !== null) {
      setRemainingSeconds(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    }
    deadline.current = null;
    setIsRunning(false);
    setAnnouncement("已经暂停，准备好再继续");
  }

  function resetTimer() {
    deadline.current = null;
    setIsRunning(false);
    setRemainingSeconds(phaseMinutes * 60);
    setAnnouncement("计时已重置");
  }

  function switchPhase() {
    const nextPhase: TimerPhase = phase === "focus" ? "break" : "focus";
    deadline.current = null;
    setIsRunning(false);
    setPhase(nextPhase);
    setRemainingSeconds((nextPhase === "focus" ? focus.focusMinutes : focus.breakMinutes) * 60);
    setAnnouncement(nextPhase === "focus" ? "回到专注时间" : "先休息一下吧");
  }

  function applyDurations(focusMinutes: number, breakMinutes: number) {
    const nextFocus = Math.min(180, Math.max(1, Math.round(focusMinutes || 1)));
    const nextBreak = Math.min(60, Math.max(1, Math.round(breakMinutes || 1)));
    if (!dispatch({ type: "focus/configure", focusMinutes: nextFocus, breakMinutes: nextBreak })) return;

    deadline.current = null;
    setIsRunning(false);
    setPhase("focus");
    setRemainingSeconds(nextFocus * 60);
    setDraftFocusMinutes(nextFocus);
    setDraftBreakMinutes(nextBreak);
    setAnnouncement(`已设为专注 ${nextFocus} 分钟，休息 ${nextBreak} 分钟`);
  }

  function changeMode(nextMode: TimerMode) {
    if (isRunning || stopwatchRunning) return;
    setMode(nextMode);
    setAnnouncement(nextMode === "countdown" ? "准备好就开始一小段专注吧" : "选择任务或分类，然后开始记录时间");
  }

  function readStopwatchSeconds(): number {
    if (!stopwatchRunning || stopwatchStartedAt.current === null) return stopwatchSeconds;
    return stopwatchAccumulatedSeconds + Math.floor((Date.now() - stopwatchStartedAt.current) / 1000);
  }

  function startStopwatch() {
    stopwatchStartedAt.current = Date.now();
    setStopwatchRunning(true);
    setAnnouncement("正在记录时间，小猫会一直陪着你");
  }

  function pauseStopwatch() {
    const seconds = readStopwatchSeconds();
    stopwatchStartedAt.current = null;
    setStopwatchSeconds(seconds);
    setStopwatchAccumulatedSeconds(seconds);
    setStopwatchRunning(false);
    setAnnouncement("正计时已暂停");
  }

  function resetStopwatch() {
    stopwatchStartedAt.current = null;
    setStopwatchSeconds(0);
    setStopwatchAccumulatedSeconds(0);
    setStopwatchRunning(false);
    setAnnouncement("正计时已重置");
  }

  function finishStopwatch() {
    const seconds = readStopwatchSeconds();
    const minutes = stopwatchSecondsToMinutes(seconds);
    if (minutes === 0) {
      setAnnouncement("至少计时 1 秒后才能记录");
      return;
    }

    let saved: boolean;
    if (stopwatchTarget.startsWith("fixed:")) {
      saved = dispatch({ type: "fixed/time-add", recordId: stopwatchTarget.slice(6), minutes });
    } else if (stopwatchTarget.startsWith("scheduled:")) {
      saved = dispatch({ type: "scheduled/time-add", id: stopwatchTarget.slice(10), minutes });
    } else {
      saved = dispatch({
        type: "time-entry/add",
        title: stopwatchTitle,
        categoryId: stopwatchCategoryId,
        date: today,
        minutes
      });
    }

    if (!saved) return;
    resetStopwatch();
    setAnnouncement(`本次 ${minutes} 分钟已经记入时间分配`);
    onFocusComplete();
  }

  return (
    <section className="focus-card surface-card" aria-label="专注计时器">
      <div className="focus-card__heading">
        <div className="focus-card__title">
          <span className="focus-card__eyebrow">FOCUS WITH CAT</span>
          <h2>{mode === "stopwatch" ? "正计时" : phase === "focus" ? "专注时间" : "休息时间"}</h2>
          <div className="timer-mode-switch" aria-label="计时方式">
            <button type="button" aria-pressed={mode === "countdown"} disabled={stopwatchRunning} onClick={() => changeMode("countdown")}>倒计时</button>
            <button type="button" aria-pressed={mode === "stopwatch"} disabled={isRunning} onClick={() => changeMode("stopwatch")}>正计时</button>
          </div>
        </div>
        <div className="level-chip" aria-label={`当前等级 ${level} 级`}>
          <span>Lv.{level}</span>
          <small>{levelExperience}/{experiencePerLevel} EXP</small>
        </div>
      </div>

      <div className="focus-card__body">
        <div className="focus-timer" style={ringStyle} aria-label={mode === "countdown" ? `剩余 ${formatTime(remainingSeconds)}` : `已计时 ${formatTime(stopwatchSeconds)}`}>
          <div>
            <span>{mode === "stopwatch" ? "已记录" : phase === "focus" ? "专注" : "休息"}</span>
            <strong>{formatTime(mode === "stopwatch" ? stopwatchSeconds : remainingSeconds)}</strong>
            <small>{mode === "stopwatch" ? stopwatchRunning ? "计时中" : "等待开始" : isRunning ? "进行中" : "等待开始"}</small>
          </div>
        </div>

        <div className="focus-card__controls">
          {mode === "countdown" ? <>
          <div className="focus-presets" aria-label="常用计时方案">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={isRunning}
                aria-pressed={focus.focusMinutes === preset.focusMinutes && focus.breakMinutes === preset.breakMinutes}
                onClick={() => applyDurations(preset.focusMinutes, preset.breakMinutes)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="focus-actions">
            <button type="button" className="button button--primary focus-actions__main" onClick={isRunning ? pauseTimer : startTimer}>
              {isRunning ? "暂停" : remainingSeconds === totalSeconds ? "开始专注" : "继续"}
            </button>
            <button type="button" className="button" onClick={resetTimer}>重置</button>
            <button type="button" className="focus-actions__switch" onClick={switchPhase}>
              {phase === "focus" ? "直接休息" : "返回专注"}
            </button>
          </div>
          </> : <div className="focus-actions focus-actions--stopwatch">
            <button type="button" className="button button--primary focus-actions__main" onClick={stopwatchRunning ? pauseStopwatch : startStopwatch}>
              {stopwatchRunning ? "暂停计时" : stopwatchSeconds > 0 ? "继续计时" : "开始计时"}
            </button>
            <button type="button" className="button" onClick={resetStopwatch}>重置</button>
            <button type="button" className="button focus-actions__finish" disabled={stopwatchSeconds === 0} onClick={finishStopwatch}>完成并记录</button>
          </div>}
        </div>
      </div>

      {mode === "stopwatch" && <div className="stopwatch-target" aria-label="正计时记录位置">
        <label>
          <span>记录到</span>
          <select value={stopwatchTarget} disabled={stopwatchRunning} onChange={(event) => setStopwatchTarget(event.target.value)}>
            <option value="">仅记录到分类</option>
            {stopwatchTargets.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}
          </select>
        </label>
        {!stopwatchTarget && <>
          <label>
            <span>记录名称</span>
            <input value={stopwatchTitle} disabled={stopwatchRunning} onChange={(event) => setStopwatchTitle(event.target.value)} />
          </label>
          <label>
            <span>分类</span>
            <select value={stopwatchCategoryId} disabled={stopwatchRunning} onChange={(event) => setStopwatchCategoryId(event.target.value)}>
              {state.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        </>}
      </div>}

      {mode === "countdown" && <details className="focus-custom">
        <summary>自定义时长</summary>
        <div className="focus-custom__fields">
          <label>
            <span>专注分钟</span>
            <input
              type="number"
              min="1"
              max="180"
              value={draftFocusMinutes}
              disabled={isRunning}
              onChange={(event) => setDraftFocusMinutes(Number(event.target.value))}
            />
          </label>
          <label>
            <span>休息分钟</span>
            <input
              type="number"
              min="1"
              max="60"
              value={draftBreakMinutes}
              disabled={isRunning}
              onChange={(event) => setDraftBreakMinutes(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            className="button"
            disabled={isRunning}
            onClick={() => applyDurations(draftFocusMinutes, draftBreakMinutes)}
          >
            应用设置
          </button>
        </div>
      </details>}
      <p className="focus-card__announcement" role="status">{announcement}</p>
    </section>
  );
}
