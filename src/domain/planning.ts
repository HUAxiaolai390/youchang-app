import type { TimeKey } from "./types";

export function isTimeKey(value: unknown): value is TimeKey {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function normalizePlannedStartTime(value?: string): TimeKey | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  if (!isTimeKey(value)) throw new Error("请输入有效开始时间");
  return value;
}
