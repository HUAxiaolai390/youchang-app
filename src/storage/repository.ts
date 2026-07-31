import { createInitialState } from "../domain/defaults";
import { rollover } from "../domain/rollover";
import type { AppState } from "../domain/types";
import { parseBackup, serializeBackup } from "./backup";

const STATE_KEY = "youchang:state";
const RECOVERY_PREFIX = "youchang:recovery:";
const SAVE_ERROR = "保存失败，请立即导出备份";

export interface AppRepository {
  load(): AppState;
  save(state: AppState): void;
  clear(): AppState;
}

export function createLocalRepository(storage: Storage, now: () => Date): AppRepository {
  const save = (state: AppState): void => {
    try {
      storage.setItem(STATE_KEY, serializeBackup(state));
    } catch {
      throw new Error(SAVE_ERROR);
    }
  };

  return {
    load(): AppState {
      const current = now();
      const raw = storage.getItem(STATE_KEY);
      if (raw === null) {
        return createInitialState(current);
      }

      let state: AppState;
      try {
        state = parseBackup(raw);
      } catch {
        try {
          storage.setItem(`${RECOVERY_PREFIX}${current.toISOString()}`, raw);
        } catch {
          // The primary data is still left untouched when recovery storage is unavailable.
        }
        return createInitialState(current);
      }

      const rolled = rollover(state, current);
      save(rolled);
      return rolled;
    },

    save,

    clear(): AppState {
      const initial = createInitialState(now());
      save(initial);
      return initial;
    }
  };
}
