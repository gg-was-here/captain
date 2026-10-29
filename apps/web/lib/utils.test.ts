import { describe, expect, it } from "vitest";
import { fawnStyle } from "./utils";

const read = (seed: string) => {
  const style = fawnStyle(seed) as Record<string, string>;
  return { h: Number(style["--fawn-h"]), v1: Number(style["--fawn-v1"]), v2: Number(style["--fawn-v2"]) };
};

describe("fawnStyle", () => {
  it("gives a chat the same color every time", () => {
    expect(fawnStyle("t_LJUbhMRxNVK4")).toEqual(fawnStyle("t_LJUbhMRxNVK4"));
  });

  it("stays on the wheel and within the shade range", () => {
    for (let i = 0; i < 200; i++) {
      const { h, v1, v2 } = read(`t_${i}`);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
      for (const v of [v1, v2]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("spreads similar ids across the wheel", () => {
    const hues = Array.from({ length: 20 }, (_, i) => read(`t_abc${i}`).h);
    // Every 60° sixth of the wheel gets at least one of 20 neighbouring ids.
    const sixths = new Set(hues.map((h) => Math.floor(h / 60)));
    expect(sixths.size).toBe(6);
  });
});
