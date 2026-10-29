import { describe, expect, it } from "vitest";
import { formatElapsed, formatTypical, typicalReplyMs, withSample } from "./reply-timing";

describe("typicalReplyMs", () => {
  it("needs three replies before it guesses", () => {
    expect(typicalReplyMs([])).toBeUndefined();
    expect(typicalReplyMs([4000, 6000])).toBeUndefined();
  });

  it("takes the median, so one slow app build doesn't skew it", () => {
    expect(typicalReplyMs([3000, 900_000, 5000])).toBe(5000);
    expect(typicalReplyMs([2000, 4000, 6000, 8000])).toBe(5000);
  });
});

describe("withSample", () => {
  it("keeps the latest ten", () => {
    const samples = Array.from({ length: 10 }, (_, i) => (i + 1) * 1000);
    expect(withSample(samples, 99_000)).toEqual([...samples.slice(1), 99_000]);
  });

  it("ignores times that can't be a real reply", () => {
    expect(withSample([1000], 0)).toEqual([1000]);
    expect(withSample([1000], Number.NaN)).toEqual([1000]);
    expect(withSample([1000], 31 * 60_000)).toEqual([1000]);
  });
});

describe("formatting", () => {
  it("shows a running time in seconds, then minutes", () => {
    expect(formatElapsed(0)).toBe("0s");
    expect(formatElapsed(12_400)).toBe("12s");
    expect(formatElapsed(65_000)).toBe("1m 05s");
  });

  it("rounds the typical time so it doesn't look precise", () => {
    expect(formatTypical(400)).toBe("~1s");
    expect(formatTypical(7_600)).toBe("~8s");
    expect(formatTypical(23_000)).toBe("~25s");
    expect(formatTypical(130_000)).toBe("~2 min");
  });
});
