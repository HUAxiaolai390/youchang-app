import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createInitialState } from "../domain/defaults";
import { normalizeFeaturedAchievementIds } from "../domain/achievements";
import { toDateKey } from "../domain/date";
import {
  addCategory,
  addFixedTask,
  addScheduledTask,
  deleteCategory,
  deleteTask,
  setFixedTaskActive,
  setFixedTaskPausedUntil,
  toggleFixedTaskSkipDate,
  toggleFixedRecord,
  toggleFixedTaskForDate,
  toggleScheduledTask,
  updateFixedTask,
  updateScheduledTask
} from "../domain/tasks";
import { moveArchivedTaskToCurrentWeek, rescheduleTask, rollover } from "../domain/rollover";
import type { AppState } from "../domain/types";
import { completeFocusSession, configureFocus } from "../domain/focus";
import {
  addFixedActualMinutes,
  addScheduledActualMinutes,
  addTimeEntry,
  setFixedActualMinutes,
  setScheduledActualMinutes
} from "../domain/time";
import type { AppRepository } from "../storage/repository";
import type { AppAction } from "./app-actions";

export type AppStateContextValue = {
  state: AppState;
  dispatch(action: AppAction): boolean;
  error?: string;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);
const FALLBACK_ERROR_MESSAGE = "操作失败，请稍后重试";
const knownErrorMessages = new Set([
  "请输入任务名称",
  "请输入分类名称",
  "请选择有效分类",
  "分类名称已存在",
  "请输入有效用时",
  "请输入有效开始时间",
  "请输入有效预计用时",
  "请至少选择一个星期",
  "每周次数应为 1 到 7 次",
  "间隔天数应为 2 到 30 天",
  "暂停日期不能早于今天",
  "这个任务现在不能改期",
  "请选择本周内的日期",
  "备份文件格式无效",
  "备份文件版本不受支持",
  "保存失败，请立即导出备份"
]);

function getDisplayError(error: unknown): string {
  if (error instanceof Error && knownErrorMessages.has(error.message)) {
    return error.message;
  }

  return FALLBACK_ERROR_MESSAGE;
}

export function reduceAppState(state: AppState, action: AppAction, now: Date): AppState {
  switch (action.type) {
    case "scheduled/add":
      return addScheduledTask(state, action.input, now);
    case "scheduled/update":
      return updateScheduledTask(state, action.id, action.input);
    case "scheduled/toggle":
      return toggleScheduledTask(state, action.id, now);
    case "scheduled/delete":
      return deleteTask(state, "scheduled", action.id);
    case "scheduled/reschedule":
      return rescheduleTask(state, action.id, action.targetDate, now);
    case "scheduled/move-archived":
      return moveArchivedTaskToCurrentWeek(state, action.id, action.targetDate, now);
    case "fixed/add":
      return addFixedTask(state, action.input, now);
    case "fixed/update":
      return updateFixedTask(state, action.id, action.input, toDateKey(now));
    case "fixed/toggle":
      return toggleFixedRecord(state, action.recordId, now);
    case "fixed/toggle-date":
      return toggleFixedTaskForDate(state, action.templateId, action.date, now);
    case "fixed/set-active":
      return setFixedTaskActive(state, action.id, action.active, now);
    case "fixed/toggle-skip-date":
      return toggleFixedTaskSkipDate(state, action.id, action.date, now);
    case "fixed/set-paused-until":
      return setFixedTaskPausedUntil(state, action.id, action.date, now);
    case "category/add":
      return addCategory(state, { name: action.name, icon: action.icon }, now);
    case "category/delete":
      return deleteCategory(state, action.id);
    case "settings/name":
      return { ...state, settings: { ...state.settings, displayName: action.value } };
    case "settings/music-volume": {
      const musicVolume = Number.isFinite(action.value)
        ? Math.min(1, Math.max(0, action.value))
        : (state.settings.musicVolume ?? 0.35);
      return { ...state, settings: { ...state.settings, musicVolume } };
    }
    case "settings/featured-achievements":
      return {
        ...state,
        settings: {
          ...state.settings,
          featuredAchievementIds: normalizeFeaturedAchievementIds(action.ids)
        }
      };
    case "focus/configure":
      return configureFocus(state, action.focusMinutes, action.breakMinutes);
    case "focus/session-complete":
      return completeFocusSession(state, action.minutes);
    case "fixed/time-set":
      return setFixedActualMinutes(state, action.recordId, action.minutes);
    case "fixed/time-add":
      return addFixedActualMinutes(state, action.recordId, action.minutes);
    case "scheduled/time-set":
      return setScheduledActualMinutes(state, action.id, action.minutes);
    case "scheduled/time-add":
      return addScheduledActualMinutes(state, action.id, action.minutes);
    case "time-entry/add":
      return addTimeEntry(state, {
        title: action.title,
        categoryId: action.categoryId,
        date: action.date,
        minutes: action.minutes
      }, now);
    case "backup/import":
      return rollover(action.state, now);
    case "system/rollover":
      return rollover(state, action.now);
    case "data/clear":
    case "error/dismiss":
      return state;
  }
}

function readInitialState(repository: AppRepository): { state: AppState; error?: string } {
  try {
    return { state: repository.load() };
  } catch (error) {
    return {
      state: createInitialState(new Date()),
      error: getDisplayError(error)
    };
  }
}

export function AppStateProvider({ repository, children }: { repository: AppRepository; children: ReactNode }) {
  const [initial] = useState(() => readInitialState(repository));
  const [state, setState] = useState(initial.state);
  const [error, setError] = useState(initial.error);
  const stateRef = useRef(initial.state);

  const dispatch = useCallback((action: AppAction) => {
    if (action.type === "error/dismiss") {
      setError(undefined);
      return true;
    }

    try {
      const clearsRepository = action.type === "data/clear";
      const nextState = clearsRepository
        ? repository.clear()
        : reduceAppState(stateRef.current, action, new Date());
      if (!clearsRepository) repository.save(nextState);
      stateRef.current = nextState;
      setState(nextState);
      setError(undefined);
      return true;
    } catch (caught) {
      setError(getDisplayError(caught));
      return false;
    }
  }, [repository]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        dispatch({ type: "system/rollover", now: new Date() });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    let timer: number | undefined;
    const scheduleMidnightRollover = () => {
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 0, 0);
      timer = window.setTimeout(() => {
        dispatch({ type: "system/rollover", now: new Date() });
        scheduleMidnightRollover();
      }, nextMidnight.getTime() - Date.now());
    };
    scheduleMidnightRollover();

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [dispatch]);

  return (
    <AppStateContext.Provider value={{ state, dispatch, error }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useAppState 必须在 AppStateProvider 内使用");
  return value;
}
