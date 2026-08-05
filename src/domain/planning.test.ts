import { describe, expect, it } from "vitest";
import {
  formatPlanComparison,
  normalizeEstimatedMinutes,
  normalizePlannedStartTime
} from "./planning";

describe("task planning", () => {
  it("accepts optional clock time and estimated minutes", () => {
    expect(normalizePlannedStartTime("")).toBeUndefined();
    expect(normalizePlannedStartTime("09:30")).toBe("09:30");
    expect(normalizeEstimatedMinutes(undefined)).toBeUndefined();
    expect(normalizeEstimatedMinutes(45)).toBe(45);
  });

  it("rejects invalid planning values", () => {
    expect(() => normalizePlannedStartTime("25:00")).toThrow("请输入有效开始时间");
    expect(() => normalizeEstimatedMinutes(0)).toThrow("请输入有效预计用时");
    expect(() => normalizeEstimatedMinutes(1_441)).toThrow("请输入有效预计用时");
  });

  it("compares the planned and actual duration in plain language", () => {
    expect(formatPlanComparison(30, 45)).toBe("预计 30 分钟 · 实际 45 分钟 · 多 15 分钟");
    expect(formatPlanComparison(45, 30)).toContain("少 15 分钟");
    expect(formatPlanComparison(30, 30)).toContain("刚好完成");
  });
});
