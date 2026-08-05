import type { TimeKey } from "./types";

export const maximumEstimatedMinutes = 1_440;

export function isTimeKey(value: unknown): value is TimeKey {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function normalizePlannedStartTime(value?: string): TimeKey | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  if (!isTimeKey(value)) throw new Error("请输入有效开始时间");
  return value;
}

export function normalizeEstimatedMinutes(value?: number): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1 || value > maximumEstimatedMinutes) {
    throw new Error("请输入有效预计用时");
  }
  return value;
}

export function formatPlanComparison(estimatedMinutes?: number, actualMinutes?: number): string {
  if (!estimatedMinutes && !actualMinutes) return "暂未填写预计和实际用时";

  const parts: string[] = [];
  if (estimatedMinutes) parts.push(`预计 ${estimatedMinutes} 分钟`);
  if (actualMinutes) parts.push(`实际 ${actualMinutes} 分钟`);
  if (estimatedMinutes && actualMinutes) {
    const difference = actualMinutes - estimatedMinutes;
    if (difference === 0) parts.push("刚好完成");
    else parts.push(`${difference > 0 ? "多" : "少"} ${Math.abs(difference)} 分钟`);
  }
  return parts.join(" · ");
}
