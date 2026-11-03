import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

process.env.CAPTAIN_DATA_DIR = mkdtempSync(join(tmpdir(), "captain-members-"));
delete process.env.DATABASE_URL;
delete process.env.TURSO_DATABASE_URL;

const members = await import("./members");

describe("user cap", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the cap from the environment, and has none by default", () => {
    expect(members.maxUsers()).toBeUndefined();
    vi.stubEnv("CAPTAIN_MAX_USERS", "100");
    expect(members.maxUsers()).toBe(100);
    for (const value of ["", "0", "-1", "2.5", "abc"]) {
      vi.stubEnv("CAPTAIN_MAX_USERS", value);
      expect(members.maxUsers()).toBeUndefined();
    }
  });

  it("admits everyone without a cap, and keeps them once a cap is set", async () => {
    expect(await members.admit("early_a")).toBe(true);
    expect(await members.admit("early_b")).toBe(true);
    vi.stubEnv("CAPTAIN_MAX_USERS", "1");
    expect(await members.admit("early_a")).toBe(true);
    expect(await members.admit("early_b")).toBe(true);
    expect(await members.admit("late")).toBe(false);
  });

  it("admits people only while there's room, and frees a place on deletion", async () => {
    vi.stubEnv("CAPTAIN_MAX_USERS", "3");
    expect(await members.admit("third")).toBe(true);
    expect(await members.admit("fourth")).toBe(false);
    // Signing in again doesn't help once full.
    expect(await members.admit("fourth")).toBe(false);
    await members.removeMember("third");
    expect(await members.admit("fourth")).toBe(true);
    expect(await members.admit("third")).toBe(false);
  });

  it("lets a raised cap admit people from the waitlist", async () => {
    // early_a, early_b and fourth are members.
    vi.stubEnv("CAPTAIN_MAX_USERS", "3");
    expect(await members.admit("fifth")).toBe(false);
    vi.stubEnv("CAPTAIN_MAX_USERS", "4");
    expect(await members.admit("fifth")).toBe(true);
  });

  it("never admits more than the cap when many sign up at once", async () => {
    vi.stubEnv("CAPTAIN_MAX_USERS", "8");
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => members.admit(`rush_${i}`)));
    // Four members already, so four places left.
    expect(results.filter(Boolean)).toHaveLength(4);
  });
});
