import { describe, expect, it } from "vitest";
import { createInitialState } from "../domain/defaults";
import { createLocalRepository } from "./repository";

class MemoryStorage implements Storage {
  #values = new Map<string, string>();
  failWrites = false;

  get length() {
    return this.#values.size;
  }

  clear() {
    this.#values.clear();
  }

  getItem(key: string) {
    return this.#values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.#values.delete(key);
  }

  setItem(key: string, value: string) {
    if (this.failWrites) {
      throw new Error("quota exceeded");
    }
    this.#values.set(key, value);
  }
}

describe("local repository", () => {
  const today = new Date(2026, 6, 31, 9);

  it("returns initial state when storage is empty", () => {
    const repository = createLocalRepository(new MemoryStorage(), () => today);

    expect(repository.load().categories.map((item) => item.id))
      .toEqual(["study", "work", "exercise", "rest", "life", "other"]);
  });

  it("rolls valid saved state forward and saves the result", () => {
    const storage = new MemoryStorage();
    const state = createInitialState(new Date(2026, 6, 30, 9));
    state.scheduledTasks.push({
      id: "task-1",
      title: "完成数学练习",
      categoryId: "study",
      categoryNameSnapshot: "学习",
      scheduledDate: "2026-07-30",
      status: "pending",
      createdAt: "2026-07-30T01:00:00.000Z"
    });
    storage.setItem("youchang:state", JSON.stringify(state));
    const repository = createLocalRepository(storage, () => today);

    expect(repository.load().scheduledTasks[0]).toMatchObject({
      status: "backlog"
    });
    expect(JSON.parse(storage.getItem("youchang:state") ?? "{}").settings.lastOpenedDate)
      .toBe("2026-07-31");
  });

  it("keeps malformed saved data in a recovery copy before returning initial state", () => {
    const storage = new MemoryStorage();
    storage.setItem("youchang:state", "{");
    const repository = createLocalRepository(storage, () => today);

    expect(repository.load().schemaVersion).toBe(1);
    expect(storage.getItem("youchang:recovery:2026-07-31T01:00:00.000Z")).toBe("{");
  });

  it("reports a Chinese recovery warning when saving fails", () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const repository = createLocalRepository(storage, () => today);

    expect(() => repository.save(createInitialState(today)))
      .toThrow("保存失败，请立即导出备份");
  });

  it("reports the save warning when rollover cannot persist its result", () => {
    const storage = new MemoryStorage();
    storage.setItem("youchang:state", JSON.stringify(createInitialState(new Date(2026, 6, 30, 9))));
    storage.failWrites = true;
    const repository = createLocalRepository(storage, () => today);

    expect(() => repository.load()).toThrow("保存失败，请立即导出备份");
  });

  it("clears data by persisting a new initial state", () => {
    const storage = new MemoryStorage();
    const repository = createLocalRepository(storage, () => today);
    repository.save(createInitialState(new Date(2026, 6, 30, 9)));

    const cleared = repository.clear();

    expect(JSON.parse(storage.getItem("youchang:state") ?? "{}")).toEqual(cleared);
    expect(cleared.settings.lastOpenedDate).toBe("2026-07-31");
  });
});
