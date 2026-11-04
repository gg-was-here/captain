import { describe, expect, it } from "vitest";
import { BLOCK_MS, COOLDOWN_MS, WriteGuard } from "./write-guard";

describe("WriteGuard", () => {
  const setup = () => {
    let now = 0;
    const guard = new WriteGuard(() => now);
    return { guard, advance: (ms: number) => (now += ms) };
  };

  it("lets an app ask until the user cancels, then holds it off for a while", () => {
    const { guard, advance } = setup();
    expect(guard.refusal("app_1", "Notes")).toBeUndefined();
    guard.answered("app_1", false);
    expect(guard.refusal("app_1", "Notes")).toBe("You just cancelled a request from Notes. It can ask again in 30 seconds.");
    // Other apps aren't affected.
    expect(guard.refusal("app_2", "Todo")).toBeUndefined();
    advance(COOLDOWN_MS);
    expect(guard.refusal("app_1", "Notes")).toBeUndefined();
  });

  it("blocks an app for longer after three cancels in a row", () => {
    const { guard, advance } = setup();
    guard.answered("app_1", false);
    advance(COOLDOWN_MS);
    guard.answered("app_1", false);
    advance(COOLDOWN_MS);
    guard.answered("app_1", false);
    expect(guard.refusal("app_1", "Notes")).toBe("You cancelled Notes's last 3 requests, so Bambii won't ask again for 10 minutes.");
    advance(BLOCK_MS - 1000);
    expect(guard.refusal("app_1", "Notes")).toContain("for 1 second.");
    advance(1000);
    expect(guard.refusal("app_1", "Notes")).toBeUndefined();
  });

  it("starts the count over when the user allows a request", () => {
    const { guard, advance } = setup();
    guard.answered("app_1", false);
    advance(COOLDOWN_MS);
    guard.answered("app_1", false);
    advance(COOLDOWN_MS);
    guard.answered("app_1", true);
    expect(guard.refusal("app_1", "Notes")).toBeUndefined();
    guard.answered("app_1", false);
    expect(guard.refusal("app_1", "Notes")).toContain("30 seconds");
  });
});
