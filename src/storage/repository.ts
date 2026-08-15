import { createInitialState } from "../domain/defaults";
import { rollover } from "../domain/rollover";
import type { AppState } from "../domain/types";
import { parseBackup, serializeBackup } from "./backup";

const STATE_KEY = "youchang:state";
const RECOVERY_PREFIX = "youchang:recovery:";
const SAVE_ERROR = "保存失败，请立即导出备份";
const RECOVERY_ERROR = "检测到异常数据，已创建恢复副本并重置当前数据";

export interface RecoverySnapshot {
  key: string;
  createdAt: string;
  raw: string;
}

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
        save(createInitialState(current));
        throw new Error(RECOVERY_ERROR);
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

export function listRecoverySnapshots(storage: Storage): RecoverySnapshot[] {
  const snapshots: RecoverySnapshot[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(RECOVERY_PREFIX)) continue;
    const raw = storage.getItem(key);
    if (raw === null) continue;
    snapshots.push({ key, createdAt: key.slice(RECOVERY_PREFIX.length), raw });
  }
  return snapshots.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function removeRecoverySnapshot(storage: Storage, key: string): void {
  if (!key.startsWith(RECOVERY_PREFIX)) return;
  storage.removeItem(key);
}
