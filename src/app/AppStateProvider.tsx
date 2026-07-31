import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createInitialState } from "../domain/defaults";
import { toDateKey } from "../domain/date";
import {
  addCategory,
  addFixedTask,
  addScheduledTask,
  deleteCategory,
  deleteTask,
  setFixedTaskActive,
  toggleFixedRecord,
  toggleScheduledTask,
  updateFixedTask,
  updateScheduledTask
} from "../domain/tasks";
import { rescheduleTask, rollover } from "../domain/rollover";
import type { AppState } from "../domain/types";
import type { AppRepository } from "../storage/repository";
import type { AppAction } from "./app-actions";

export type AppStateContextValue = {
  state: AppState;
  dispatch(action: AppAction): void;
  error?: string;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

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
    case "fixed/add":
      return addFixedTask(state, action.input, now);
    case "fixed/update":
      return updateFixedTask(state, action.id, action.input, toDateKey(now));
    case "fixed/toggle":
      return toggleFixedRecord(state, action.recordId, now);
    case "fixed/set-active":
      return setFixedTaskActive(state, action.id, action.active, toDateKey(now));
    case "category/add":
      return addCategory(state, { name: action.name, icon: action.icon }, now);
    case "category/delete":
      return deleteCategory(state, action.id);
    case "settings/name":
      return { ...state, settings: { ...state.settings, displayName: action.value } };
    case "backup/import":
      return action.state;
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
      error: error instanceof Error ? error.message : "读取数据失败"
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
      return;
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "操作失败");
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
