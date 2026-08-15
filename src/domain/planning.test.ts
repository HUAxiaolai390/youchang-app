import { describe, expect, it } from "vitest";
import { normalizePlannedStartTime } from "./planning";

describe("task planning", () => {
  it("accepts an optional clock time", () => {
    expect(normalizePlannedStartTime("")).toBeUndefined();
    expect(normalizePlannedStartTime("09:30")).toBe("09:30");
  });

  it("rejects an invalid clock time", () => {
    expect(() => normalizePlannedStartTime("25:00")).toThrow("请输入有效开始时间");
  });
});
