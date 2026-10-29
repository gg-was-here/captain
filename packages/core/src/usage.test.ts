import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

process.env.CAPTAIN_DATA_DIR = mkdtempSync(join(tmpdir(), "captain-usage-"));
delete process.env.DATABASE_URL;
delete process.env.TURSO_DATABASE_URL;

const usage = await import("./usage");

describe("dailyLimit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the built-in defaults", () => {
    expect(usage.dailyLimit("messages")).toBe(200);
    expect(usage.dailyLimit("ai")).toBe(500);
    expect(usage.dailyLimit("builds")).toBe(20);
  });

  it("uses a positive override from the environment", () => {
    vi.stubEnv("CAPTAIN_DAILY_MESSAGES_LIMIT", "50");
    expect(usage.dailyLimit("messages")).toBe(50);
  });

  it("ignores overrides that aren't positive numbers", () => {
    for (const value of ["", "0", "-5", "abc"]) {
      vi.stubEnv("CAPTAIN_DAILY_AI_LIMIT", value);
      expect(usage.dailyLimit("ai")).toBe(500);
    }
  });
});

describe("usage limits", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("weights tokens by what they cost", () => {
    // 2,100 input tokens in all: 1,000 uncached, 1,000 read from the cache, 100 written to it.
    expect(usage.weightedTokens({ inputTokens: 2100, outputTokens: 100, cacheReadTokens: 1000, cacheWriteTokens: 100 })).toBe(1725);
    expect(usage.weightedTokens({ inputTokens: 100_000, cacheReadTokens: 100_000 })).toBe(10_000);
  });

  it("prices each call at its model's rate, in micro-dollars", () => {
    const call = { inputTokens: 1_000_000, outputTokens: 100_000 };
    expect(usage.costMicros("claude-haiku-5-5", call)).toBe(150_000); // $0.10 + $0.05
    expect(usage.costMicros("claude-sonnet-5-5", call)).toBe(3_000_000); // $2 + $1
    expect(usage.costMicros("claude-opus-5-5", call)).toBe(6_000_000); // $4 + $2
  });

  it("stops model work once today's allowance is used", async () => {
    vi.stubEnv("CAPTAIN_USER_DAILY_USD", "0.5");
    await usage.assertWithinBudget("user_day");
    await usage.recordCost("user_day", "claude-sonnet-5-5", { inputTokens: 250_000 });
    await expect(usage.assertWithinBudget("user_day")).rejects.toThrow("today's AI allowance");
    // Someone else still has their own allowance.
    await usage.assertWithinBudget("user_day_other");
  });

  it("stops model work once this month's allowance is used", async () => {
    vi.stubEnv("CAPTAIN_USER_MONTHLY_USD", "0.5");
    await usage.recordCost("user_month", "claude-opus-5-5", { inputTokens: 125_000 });
    await expect(usage.assertWithinBudget("user_month")).rejects.toThrow("this month's AI allowance");
  });

  it("applies the deployment-wide daily and monthly caps to everyone", async () => {
    await usage.recordCost("user_global", "claude-haiku-5-5", { inputTokens: 1_000_000 }); // $0.10
    vi.stubEnv("CAPTAIN_GLOBAL_DAILY_USD", "0.1");
    await expect(usage.assertWithinBudget("user_global_other")).rejects.toThrow("Bambii has reached today's AI usage limit");
    vi.stubEnv("CAPTAIN_GLOBAL_MONTHLY_USD", "0.1");
    await expect(usage.assertWithinBudget("user_global_other")).rejects.toThrow("Bambii has reached this month's AI usage limit");
  });

  it("reports a user's spend against their allowance", async () => {
    await usage.recordCost("user_status", "claude-sonnet-5-5", { inputTokens: 100_000, outputTokens: 10_000 });
    const status = await usage.budgetStatus("user_status");
    expect(status.usedToday).toBeCloseTo(0.3);
    expect(status.usedThisMonth).toBeCloseTo(0.3);
    expect(status.dailyLimit).toBe(1);
    expect(status.monthlyLimit).toBe(3);
    expect(new Date(status.monthResetsAt).getUTCDate()).toBe(1);
  });

  it("refunds a use that produced nothing", async () => {
    vi.stubEnv("CAPTAIN_DAILY_AI_LIMIT", "1");
    await usage.consumeUsage("user_refund", "ai");
    await usage.refundUsage("user_refund", "ai");
    await usage.consumeUsage("user_refund", "ai");
    await expect(usage.consumeUsage("user_refund", "ai")).rejects.toThrow("today's limit");
  });

  it("limits requests per minute, with a retry hint", async () => {
    vi.stubEnv("CAPTAIN_MINUTE_HANDOFF_LIMIT", "2");
    await usage.consumeRate("user_rate", "handoff");
    await usage.consumeRate("user_rate", "handoff");
    const error = await usage.consumeRate("user_rate", "handoff").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(usage.UsageLimitError);
    expect((error as InstanceType<typeof usage.UsageLimitError>).retryAfter).toBeGreaterThan(0);
  });
});
