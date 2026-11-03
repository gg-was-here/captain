import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.CAPTAIN_DATA_DIR = mkdtempSync(join(tmpdir(), "captain-alerts-"));
delete process.env.DATABASE_URL;
delete process.env.TURSO_DATABASE_URL;

const { alert, resetAlerts } = await import("./alerts");
const usage = await import("./usage");

/** The keys of the alerts logged so far. */
const logged = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.filter((call) => call[0] === "[alert]").map((call) => JSON.parse(String(call[1])).key as string);

describe("alert", () => {
  let errors: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetAlerts();
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("logs an alert and sends the same one at most once per ten minutes", async () => {
    expect(await alert("server-error", "A request failed")).toBe(true);
    expect(await alert("server-error", "A request failed")).toBe(false);
    expect(await alert("other", "Something else")).toBe(true);
    expect(logged(errors)).toEqual(["server-error", "other"]);
  });

  it("posts to the webhook in a shape Slack and Discord both read", async () => {
    vi.stubEnv("CAPTAIN_ALERT_WEBHOOK_URL", "https://hooks.example.com/x");
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    await alert("server-error", "A request failed", { path: "/api/apps", skipped: undefined });
    expect(fetch).toHaveBeenCalledOnce();
    const body = JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.text).toBe("Bambii: A request failed\npath: /api/apps");
    expect(body.content).toBe(body.text);
  });

  it("never throws when the webhook fails", async () => {
    vi.stubEnv("CAPTAIN_ALERT_WEBHOOK_URL", "https://hooks.example.com/x");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(alert("server-error", "A request failed")).resolves.toBe(true);
  });

  it("alerts once as deployment spend passes each level of the daily budget", async () => {
    vi.stubEnv("CAPTAIN_GLOBAL_DAILY_USD", "1");
    vi.stubEnv("CAPTAIN_GLOBAL_MONTHLY_USD", "1000");
    const sonnet = (usd: number) => ({ inputTokens: usd * 500_000 }); // Sonnet input is $2 per million
    await usage.recordCost("user_a", "claude-sonnet-5-5", sonnet(0.4));
    expect(logged(errors)).toEqual([]);
    await usage.recordCost("user_b", "claude-sonnet-5-5", sonnet(0.2)); // $0.60: past 50%
    await usage.recordCost("user_a", "claude-sonnet-5-5", sonnet(0.1)); // $0.70: no new level
    await usage.recordCost("user_a", "claude-sonnet-5-5", sonnet(0.5)); // $1.20: past 80% and 100% at once
    const day = new Date().toISOString().slice(0, 10);
    expect(logged(errors)).toEqual([`spend:day:${day}:0.5`, `spend:day:${day}:1`]);
  });
});
