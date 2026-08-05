import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useAppState } from "../../app/AppStateProvider";
import {
  experiencePerLevel,
  getFocusExperience,
  getFocusLevel,
  getFocusProgress,
  getLevelExperience
} from "../../domain/focus";

type TimerPhase = "focus" | "break";

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
  const [phase, setPhase] = useState<TimerPhase>("focus");
  const [remainingSeconds, setRemainingSeconds] = useState(focus.focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [draftFocusMinutes, setDraftFocusMinutes] = useState(focus.focusMinutes);
  const [draftBreakMinutes, setDraftBreakMinutes] = useState(focus.breakMinutes);
  const [announcement, setAnnouncement] = useState("准备好就开始一小段专注吧");
  const deadline = useRef<number | null>(null);

  const phaseMinutes = phase === "focus" ? focus.focusMinutes : focus.breakMinutes;
  const totalSeconds = phaseMinutes * 60;
  const elapsedRatio = Math.min(1, Math.max(0, 1 - remainingSeconds / totalSeconds));
  const level = getFocusLevel(focus.experience);
  const levelExperience = getLevelExperience(focus.experience);
  const ringStyle = { "--timer-progress": `${elapsedRatio * 360}deg` } as CSSProperties;

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

  return (
    <section className="focus-card surface-card" aria-label="专注计时器">
      <div className="focus-card__heading">
        <div>
          <span className="focus-card__eyebrow">FOCUS WITH CAT</span>
          <h2>{phase === "focus" ? "专注时间" : "休息时间"}</h2>
        </div>
        <div className="level-chip" aria-label={`当前等级 ${level} 级`}>
          <span>Lv.{level}</span>
          <small>{levelExperience}/{experiencePerLevel} EXP</small>
        </div>
      </div>

      <div className="focus-card__body">
        <div className="focus-timer" style={ringStyle} aria-label={`剩余 ${formatTime(remainingSeconds)}`}>
          <div>
            <span>{phase === "focus" ? "专注" : "休息"}</span>
            <strong>{formatTime(remainingSeconds)}</strong>
            <small>{isRunning ? "进行中" : "等待开始"}</small>
          </div>
        </div>

        <div className="focus-card__controls">
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
        </div>
      </div>

      <details className="focus-custom">
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
      </details>
      <p className="focus-card__announcement" role="status">{announcement}</p>
    </section>
  );
}
