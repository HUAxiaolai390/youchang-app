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
  const write = (key: string, value: string): void => {
    try {
      storage.setItem(key, value);
    } catch {
      throw new Error(SAVE_ERROR);
    }
  };

  const save = (state: AppState): void => write(STATE_KEY, serializeBackup(state));

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
        write(`${RECOVERY_PREFIX}${current.toISOString()}`, raw);
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
