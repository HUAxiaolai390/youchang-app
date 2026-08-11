import type { AppState, FocusProgress, FocusTimerRuntime } from "./types";

export const defaultFocusProgress: Readonly<FocusProgress> = {
  focusMinutes: 25,
  breakMinutes: 5,
  completedSessions: 0,
  totalFocusMinutes: 0,
  experience: 0
};

export const experiencePerLevel = 100;

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function getFocusProgress(state: AppState): FocusProgress {
  return state.focus ?? { ...defaultFocusProgress };
}

export function createFocusTimerRuntime(
  focus: FocusProgress,
  categoryId = "other"
): FocusTimerRuntime {
  return {
    mode: "countdown",
    countdown: {
      phase: "focus",
      remainingSeconds: focus.focusMinutes * 60
    },
    stopwatch: {
      elapsedSeconds: 0,
      target: "",
      categoryId,
      title: "自由记录"
    }
  };
}

export function getFocusTimerRuntime(state: AppState): FocusTimerRuntime {
  const focus = getFocusProgress(state);
  const fallbackCategoryId = state.categories[0]?.id ?? "other";
  return focus.timer ?? createFocusTimerRuntime(focus, fallbackCategoryId);
}

export function saveFocusTimerRuntime(state: AppState, timer: FocusTimerRuntime): AppState {
  return {
    ...state,
    focus: {
      ...getFocusProgress(state),
      timer
    }
  };
}

export function configureFocus(
  state: AppState,
  focusMinutes: number,
  breakMinutes: number,
  timer?: FocusTimerRuntime
): AppState {
  return {
    ...state,
    focus: {
      ...getFocusProgress(state),
      focusMinutes: clampInteger(focusMinutes, 1, 180),
      breakMinutes: clampInteger(breakMinutes, 1, 60),
      ...(timer ? { timer } : {})
    }
  };
}

export function getFocusExperience(minutes: number): number {
  return clampInteger(minutes, 5, 50);
}

export function completeFocusSession(
  state: AppState,
  minutes: number,
  timer?: FocusTimerRuntime
): AppState {
  const focus = getFocusProgress(state);
  const completedMinutes = clampInteger(minutes, 1, 180);

  return {
    ...state,
    focus: {
      ...focus,
      completedSessions: focus.completedSessions + 1,
      totalFocusMinutes: focus.totalFocusMinutes + completedMinutes,
      experience: focus.experience + getFocusExperience(completedMinutes),
      ...(timer ? { timer } : {})
    }
  };
}

export function getFocusLevel(experience: number): number {
  return Math.floor(Math.max(0, experience) / experiencePerLevel) + 1;
}

export function getLevelExperience(experience: number): number {
  return Math.max(0, experience) % experiencePerLevel;
}
