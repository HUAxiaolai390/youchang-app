import { describe, expect, it } from "vitest";
import { dailyQuotes, getDailyQuote } from "./daily-quotes";

describe("daily quotes", () => {
  it("keeps a full month of bilingual attributed quotes available offline", () => {
    expect(dailyQuotes).toHaveLength(31);
    for (const quote of dailyQuotes) {
      expect(quote.zh.trim()).not.toBe("");
      expect(quote.en.trim()).not.toBe("");
      expect(quote.authorZh.trim()).not.toBe("");
      expect(quote.authorEn.trim()).not.toBe("");
    }
  });

  it("returns the same quote throughout one local calendar day", () => {
    expect(getDailyQuote(new Date(2026, 7, 5, 0, 0))).toBe(
      getDailyQuote(new Date(2026, 7, 5, 23, 59))
    );
  });

  it("moves to a different quote on the next local calendar day", () => {
    expect(getDailyQuote(new Date(2026, 7, 6))).not.toBe(getDailyQuote(new Date(2026, 7, 5)));
  });

  it("repeats only after every built-in quote has appeared", () => {
    expect(getDailyQuote(new Date(2026, 7, 5 + dailyQuotes.length))).toBe(
      getDailyQuote(new Date(2026, 7, 5))
    );
  });
});
