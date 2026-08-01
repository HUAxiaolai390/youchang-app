import { describe, expect, it } from "vitest";
import tokens from "./tokens.css?raw";

function colorChannel(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const channels = hex.match(/[0-9a-f]{2}/gi)?.map((channel) => colorChannel(Number.parseInt(channel, 16)));
  if (!channels || channels.length !== 3) throw new Error(`无效颜色：${hex}`);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function colorToken(name: string): string {
  const value = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
  if (!value) throw new Error(`缺少颜色令牌：${name}`);
  return value;
}

describe("design-token accessibility", () => {
  it("keeps muted text at WCAG AA contrast on the darkest relevant light background", () => {
    expect(contrastRatio(colorToken("muted"), "#f0efea")).toBeGreaterThanOrEqual(4.5);
  });
});
