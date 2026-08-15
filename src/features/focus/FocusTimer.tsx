import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useAppState } from "../../app/AppStateProvider";
import { toDateKey } from "../../domain/date";
import {
  getFocusTimerRuntime,
  experiencePerLevel,
  getFocusExperience,
  getFocusLevel,
  getFocusProgress,
  getLevelExperience
} from "../../domain/focus";
import { stopwatchSecondsToMinutes } from "../../domain/time";
import type { FocusTimerMode, FocusTimerPhase, FocusTimerRuntime } from "../../domain/types";
import {
  cancelFocusPhaseNotification,
  scheduleFocusPhaseNotification
} from "../../native/task-notifications";

type FocusTimerProps = {
  onFocusComplete(): void;
  onRunningChange?(running: boolean): void;
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

function readTimestamp(value?: string): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

type TimerRuntimeOverrides = {
  mode?: FocusTimerMode;
  countdown?: Partial<FocusTimerRuntime["countdown"]>;
  stopwatch?: Partial<FocusTimerRuntime["stopwatch"]>;
};

export function FocusTimer({ onFocusComplete, onRunningChange }: FocusTimerProps) {
  const { state, dispatch } = useAppState();
  const focus = getFocusProgress(state);
  const today = toDateKey(new Date());
  const [initialRuntime] = useState(() => getFocusTimerRuntime(state));
  const initialDeadline = readTimestamp(initialRuntime.countdown.deadlineAt);
  const initialStopwatchStartedAt = readTimestamp(initialRuntime.stopwatch.startedAt);
  const [mode, setMode] = useState<FocusTimerMode>(initialRuntime.mode);
  const [phase, setPhase] = useState<FocusTimerPhase>(initialRuntime.countdown.phase);
  const [remainingSeconds, setRemainingSeconds] = useState(() => initialDeadline === null
    ? initialRuntime.countdown.remainingSeconds
    : Math.max(0, Math.ceil((initialDeadline - Date.now()) / 1000)));
  const [isRunning, setIsRunning] = useState(initialDeadline !== null);
  const [draftFocusMinutes, setDraftFocusMinutes] = useState(focus.focusMinutes);
  const [draftBreakMinutes, setDraftBreakMinutes] = useState(focus.breakMinutes);
  const [announcement, setAnnouncement] = useState(() => initialDeadline !== null || initialStopwatchStartedAt !== null
    ? "已恢复上次未结束的计时"
    : "准备好就开始一小段专注吧");
  const deadline = useRef<number | null>(initialDeadline);
  const [stopwatchSeconds, setStopwatchSeconds] = useState(() => initialRuntime.stopwatch.elapsedSeconds
    + (initialStopwatchStartedAt === null
      ? 0
      : Math.max(0, Math.floor((Date.now() - initialStopwatchStartedAt) / 1000))));
  const [stopwatchAccumulatedSeconds, setStopwatchAccumulatedSeconds] = useState(initialRuntime.stopwatch.elapsedSeconds);
  const [stopwatchRunning, setStopwatchRunning] = useState(initialStopwatchStartedAt !== null);
  const stopwatchStartedAt = useRef<number | null>(initialStopwatchStartedAt);
  const [stopwatchTarget, setStopwatchTarget] = useState(initialRuntime.stopwatch.target);
  const [stopwatchCategoryId, setStopwatchCategoryId] = useState(initialRuntime.stopwatch.categoryId);
  const [stopwatchTitle, setStopwatchTitle] = useState(initialRuntime.stopwatch.title);

  const stopwatchTargets = useMemo(() => {
    const fixed = state.fixedRecords
      .filter((record) => record.date === today)
      .map((record) => ({ value: `fixed:${record.id}`, label: `固定任务 · ${record.titleSnapshot}` }));
    const scheduled = state.scheduledTasks
      .filter((task) => task.scheduledDate === today && !["rescheduled", "archived"].includes(task.status))
      .map((task) => ({ value: `scheduled:${task.id}`, label: `今日安排 · ${task.title}` }));
    return [...fixed, ...scheduled];
  }, [state.fixedRecords, state.scheduledTasks, today]);

  function readStopwatchSeconds(): number {
    if (!stopwatchRunning || stopwatchStartedAt.current === null) return stopwatchSeconds;
    return stopwatchAccumulatedSeconds + Math.floor((Date.now() - stopwatchStartedAt.current) / 1000);
  }

  function createRuntimeSnapshot(overrides: TimerRuntimeOverrides = {}): FocusTimerRuntime {
    const liveRemainingSeconds = deadline.current === null
      ? remainingSeconds
      : Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
    const liveStopwatchSeconds = stopwatchStartedAt.current === null
      ? stopwatchAccumulatedSeconds
      : stopwatchAccumulatedSeconds + Math.max(0, Math.floor((Date.now() - stopwatchStartedAt.current) / 1000));

    return {
      mode: overrides.mode ?? mode,
      countdown: {
        phase,
        remainingSeconds: liveRemainingSeconds,
        ...(deadline.current === null ? {} : { deadlineAt: new Date(deadline.current).toISOString() }),
        ...overrides.countdown
      },
      stopwatch: {
        elapsedSeconds: liveStopwatchSeconds,
        target: stopwatchTarget,
        categoryId: stopwatchCategoryId,
        title: stopwatchTitle,
        ...(stopwatchStartedAt.current === null ? {} : { startedAt: new Date(stopwatchStartedAt.current).toISOString() }),
        ...overrides.stopwatch
      }
    };
  }

  function persistRuntime(overrides: TimerRuntimeOverrides = {}): boolean {
    return dispatch({ type: "focus/timer-save", timer: createRuntimeSnapshot(overrides) });
  }

  useEffect(() => {
    onRunningChange?.(isRunning || stopwatchRunning);
  }, [isRunning, onRunningChange, stopwatchRunning]);

  useEffect(() => {
    if (!state.settings.systemNotificationsEnabled || !isRunning || deadline.current === null) {
      void cancelFocusPhaseNotification().catch(() => undefined);
      return;
    }
    void scheduleFocusPhaseNotification(
      phase,
      deadline.current,
      phase === "focus" ? focus.breakMinutes : focus.focusMinutes,
      state.settings.wakeScreenForReminders !== false
    ).catch(() => undefined);
  }, [
    focus.breakMinutes,
    focus.focusMinutes,
    isRunning,
    phase,
    state.settings.systemNotificationsEnabled,
    state.settings.wakeScreenForReminders
  ]);

  const phaseMinutes = phase === "focus" ? focus.focusMinutes : focus.breakMinutes;
  const totalSeconds = phaseMinutes * 60;
  const elapsedRatio = Math.min(1, Math.max(0, 1 - remainingSeconds / totalSeconds));
  const level = getFocusLevel(focus.experience);
  const levelExperience = getLevelExperience(focus.experience);
  const stopwatchRatio = (stopwatchSeconds % 3600) / 3600;
  const ringStyle = {
    "--timer-progress": `${(mode === "countdown" ? elapsedRatio : stopwatchRatio) * 360}deg`
  } as CSSProperties;
  const countdownActionLabel = isRunning
    ? "暂停"
    : phase === "focus"
      ? remainingSeconds === totalSeconds ? "开始专注" : "继续专注"
      : remainingSeconds === totalSeconds ? "开始休息" : "继续休息";

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

      if (phase === "focus") {
        const nextTimer = createRuntimeSnapshot({
          countdown: {
            phase: "break",
            remainingSeconds: focus.breakMinutes * 60,
            deadlineAt: undefined
          }
        });
        const saved = dispatch({
          type: "focus/session-complete",
          minutes: focus.focusMinutes,
          timer: nextTimer
        });
        deadline.current = null;
        setIsRunning(false);
        setPhase("break");
        setRemainingSeconds(focus.breakMinutes * 60);
        setAnnouncement(saved
          ? `专注完成，获得 ${getFocusExperience(focus.focusMinutes)} 点经验。现在休息一下吧`
          : "专注完成，但成长记录保存失败了");
        if (saved) onFocusComplete();
      } else {
        const saved = persistRuntime({
          countdown: {
            phase: "focus",
            remainingSeconds: focus.focusMinutes * 60,
            deadlineAt: undefined
          }
        });
        deadline.current = null;
        setIsRunning(false);
        setPhase("focus");
        setRemainingSeconds(focus.focusMinutes * 60);
        setAnnouncement(saved ? "休息结束，可以开始下一轮专注了" : "休息结束，但状态保存失败了");
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
    const nextDeadline = Date.now() + remainingSeconds * 1000;
    if (!persistRuntime({ countdown: { deadlineAt: new Date(nextDeadline).toISOString() } })) return;
    deadline.current = nextDeadline;
    setIsRunning(true);
    setAnnouncement(phase === "focus" ? "小猫正在陪你专注" : "安心休息，等会再继续");
  }

  function pauseTimer() {
    const nextRemaining = deadline.current === null
      ? remainingSeconds
      : Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
    if (!persistRuntime({ countdown: { remainingSeconds: nextRemaining, deadlineAt: undefined } })) return;
    setRemainingSeconds(nextRemaining);
    deadline.current = null;
    setIsRunning(false);
    setAnnouncement("已经暂停，准备好再继续");
  }

  function resetTimer() {
    if (!persistRuntime({ countdown: { remainingSeconds: phaseMinutes * 60, deadlineAt: undefined } })) return;
    deadline.current = null;
    setIsRunning(false);
    setRemainingSeconds(phaseMinutes * 60);
    setAnnouncement("计时已重置");
  }

  function switchPhase() {
    const nextPhase: FocusTimerPhase = phase === "focus" ? "break" : "focus";
    const nextRemaining = (nextPhase === "focus" ? focus.focusMinutes : focus.breakMinutes) * 60;
    if (!persistRuntime({
      countdown: { phase: nextPhase, remainingSeconds: nextRemaining, deadlineAt: undefined }
    })) return;
    deadline.current = null;
    setIsRunning(false);
    setPhase(nextPhase);
    setRemainingSeconds(nextRemaining);
    setAnnouncement(nextPhase === "focus" ? "回到专注时间" : "先休息一下吧");
  }

  function applyDurations(focusMinutes: number, breakMinutes: number) {
    const nextFocus = Math.min(180, Math.max(1, Math.round(focusMinutes || 1)));
    const nextBreak = Math.min(60, Math.max(1, Math.round(breakMinutes || 1)));
    const nextTimer = createRuntimeSnapshot({
      countdown: { phase: "focus", remainingSeconds: nextFocus * 60, deadlineAt: undefined }
    });
    if (!dispatch({
      type: "focus/configure",
      focusMinutes: nextFocus,
      breakMinutes: nextBreak,
      timer: nextTimer
    })) return;

    deadline.current = null;
    setIsRunning(false);
    setPhase("focus");
    setRemainingSeconds(nextFocus * 60);
    setDraftFocusMinutes(nextFocus);
    setDraftBreakMinutes(nextBreak);
    setAnnouncement(`已设为专注 ${nextFocus} 分钟，休息 ${nextBreak} 分钟`);
  }

  function changeMode(nextMode: FocusTimerMode) {
    if (isRunning || stopwatchRunning) return;
    if (!persistRuntime({ mode: nextMode })) return;
    setMode(nextMode);
    setAnnouncement(nextMode === "countdown" ? "准备好就开始一小段专注吧" : "选择任务或分类，然后开始记录时间");
  }

  function startStopwatch() {
    const startedAt = Date.now();
    if (!persistRuntime({ stopwatch: { elapsedSeconds: stopwatchAccumulatedSeconds, startedAt: new Date(startedAt).toISOString() } })) return;
    stopwatchStartedAt.current = startedAt;
    setStopwatchRunning(true);
    setAnnouncement("正在记录时间，小猫会一直陪着你");
  }

  function pauseStopwatch() {
    const seconds = readStopwatchSeconds();
    if (!persistRuntime({ stopwatch: { elapsedSeconds: seconds, startedAt: undefined } })) return;
    stopwatchStartedAt.current = null;
    setStopwatchSeconds(seconds);
    setStopwatchAccumulatedSeconds(seconds);
    setStopwatchRunning(false);
    setAnnouncement("正计时已暂停");
  }

  function resetStopwatch(): boolean {
    if (!persistRuntime({ stopwatch: { elapsedSeconds: 0, startedAt: undefined } })) return false;
    stopwatchStartedAt.current = null;
    setStopwatchSeconds(0);
    setStopwatchAccumulatedSeconds(0);
    setStopwatchRunning(false);
    setAnnouncement("正计时已重置");
    return true;
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
    if (!resetStopwatch()) {
      setAnnouncement(`本次 ${minutes} 分钟已经记入时间分配，但计时状态清空失败`);
      return;
    }
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
              {countdownActionLabel}
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
          <select
            value={stopwatchTarget}
            disabled={stopwatchRunning}
            onChange={(event) => {
              const target = event.target.value;
              if (persistRuntime({ stopwatch: { target } })) setStopwatchTarget(target);
            }}
          >
            <option value="">仅记录到分类</option>
            {stopwatchTargets.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}
          </select>
        </label>
        {!stopwatchTarget && <>
          <label>
            <span>记录名称</span>
            <input
              value={stopwatchTitle}
              disabled={stopwatchRunning}
              onChange={(event) => {
                const title = event.target.value;
                if (persistRuntime({ stopwatch: { title } })) setStopwatchTitle(title);
              }}
            />
          </label>
          <label>
            <span>分类</span>
            <select
              value={stopwatchCategoryId}
              disabled={stopwatchRunning}
              onChange={(event) => {
                const categoryId = event.target.value;
                if (persistRuntime({ stopwatch: { categoryId } })) setStopwatchCategoryId(categoryId);
              }}
            >
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
