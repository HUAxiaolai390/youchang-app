import { describe, expect, it } from "vitest";
import { getWeek, isWithinWeek, toDateKey } from "./date";

describe("local date helpers", () => {
  it("formats a local date without UTC shifting", () => {
    expect(toDateKey(new Date(2026, 6, 31, 23, 30))).toBe("2026-07-31");
  });

  it("uses Monday through Sunday as a week", () => {
    expect(getWeek(new Date(2026, 6, 31))).toEqual({
      start: "2026-07-27",
      end: "2026-08-02"
    });
    expect(isWithinWeek("2026-08-02", new Date(2026, 6, 31))).toBe(true);
    expect(isWithinWeek("2026-08-03", new Date(2026, 6, 31))).toBe(false);
  });
});
