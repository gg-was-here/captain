import { afterEach, describe, expect, it, vi } from "vitest";
import { dailyLimit } from "./usage";

describe("dailyLimit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the built-in defaults", () => {
    expect(dailyLimit("messages")).toBe(200);
    expect(dailyLimit("ai")).toBe(500);
    expect(dailyLimit("builds")).toBe(20);
  });

  it("uses a positive override from the environment", () => {
    vi.stubEnv("CAPTAIN_DAILY_MESSAGES_LIMIT", "50");
    expect(dailyLimit("messages")).toBe(50);
  });

  it("ignores overrides that aren't positive numbers", () => {
    for (const value of ["", "0", "-5", "abc"]) {
      vi.stubEnv("CAPTAIN_DAILY_AI_LIMIT", value);
      expect(dailyLimit("ai")).toBe(500);
    }
  });
});
