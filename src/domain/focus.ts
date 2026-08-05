import type { AppState, FocusProgress } from "./types";

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

export function configureFocus(state: AppState, focusMinutes: number, breakMinutes: number): AppState {
  return {
    ...state,
    focus: {
      ...getFocusProgress(state),
      focusMinutes: clampInteger(focusMinutes, 1, 180),
      breakMinutes: clampInteger(breakMinutes, 1, 60)
    }
  };
}

export function getFocusExperience(minutes: number): number {
  return clampInteger(minutes, 5, 50);
}

export function completeFocusSession(state: AppState, minutes: number): AppState {
  const focus = getFocusProgress(state);
  const completedMinutes = clampInteger(minutes, 1, 180);

  return {
    ...state,
    focus: {
      ...focus,
      completedSessions: focus.completedSessions + 1,
      totalFocusMinutes: focus.totalFocusMinutes + completedMinutes,
      experience: focus.experience + getFocusExperience(completedMinutes)
    }
  };
}

export function getFocusLevel(experience: number): number {
  return Math.floor(Math.max(0, experience) / experiencePerLevel) + 1;
}

export function getLevelExperience(experience: number): number {
  return Math.max(0, experience) % experiencePerLevel;
}
