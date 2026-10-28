import { afterEach, describe, expect, it, vi } from "vitest";
import { signFrameToken, verifyFrameToken } from "./frame-token";

describe("frame tokens", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the user the token was issued to", () => {
    expect(verifyFrameToken(signFrameToken("user_1", "app_1"), "app_1")).toBe("user_1");
  });

  it("rejects a token issued for another app", () => {
    expect(verifyFrameToken(signFrameToken("user_1", "app_1"), "app_2")).toBeNull();
  });

  it("rejects a tampered payload or signature", () => {
    const [payload, signature] = signFrameToken("user_1", "app_1").split(".");
    const forged = Buffer.from(JSON.stringify({ u: "user_2", a: "app_1", e: Date.now() + 60_000 })).toString("base64url");
    expect(verifyFrameToken(`${forged}.${signature}`, "app_1")).toBeNull();
    expect(verifyFrameToken(`${payload}.${signature.slice(0, -2)}xx`, "app_1")).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T00:00:00Z"));
    const token = signFrameToken("user_1", "app_1");
    vi.setSystemTime(new Date("2026-10-28T12:00:01Z"));
    expect(verifyFrameToken(token, "app_1")).toBeNull();
  });

  it("rejects malformed tokens without throwing", () => {
    for (const token of ["", "abc", "a.b", ".", "a.b.c"]) {
      expect(verifyFrameToken(token, "app_1")).toBeNull();
    }
  });
});
