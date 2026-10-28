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

  it("stops model work once today's token budget is used", async () => {
    vi.stubEnv("CAPTAIN_DAILY_TOKENS_LIMIT", "10000");
    await usage.assertWithinLimit("user_tokens", "tokens");
    await usage.recordTokens("user_tokens", { inputTokens: 5000, outputTokens: 1000 });
    await expect(usage.assertWithinLimit("user_tokens", "tokens")).rejects.toThrow("today's limit");
  });

  it("applies the deployment-wide token cap when it's set", async () => {
    vi.stubEnv("CAPTAIN_DAILY_GLOBAL_TOKENS_LIMIT", "1");
    await usage.recordTokens("user_global", { inputTokens: 10 });
    await expect(usage.assertWithinLimit("user_other", "tokens")).rejects.toThrow("Bambii has reached today's AI usage limit");
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
