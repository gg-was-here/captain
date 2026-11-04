import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

process.env.CAPTAIN_DATA_DIR = mkdtempSync(join(tmpdir(), "captain-members-"));
delete process.env.DATABASE_URL;
delete process.env.TURSO_DATABASE_URL;

const members = await import("./members");
const { resetAlerts } = await import("./alerts");

/** The waitlist alerts logged so far, as `[user, waiting]`. */
const waitlistAlerts = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls
    .filter((call) => call[0] === "[alert]")
    .map((call) => JSON.parse(String(call[1])))
    .filter((alert) => alert.key.startsWith("waitlist:"))
    .map((alert) => [alert.user, alert.waiting]);

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

  it("alerts once per person who lands on the waitlist", async () => {
    resetAlerts();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    // Eight members, all places taken.
    vi.stubEnv("CAPTAIN_MAX_USERS", "8");
    expect(await members.admit("early_a")).toBe(true);
    expect(await members.admit("waiting_1", "one@example.com")).toBe(false);
    // Coming back, even after the alert throttle is forgotten (another server instance), doesn't alert again.
    resetAlerts();
    expect(await members.admit("waiting_1", "one@example.com")).toBe(false);
    expect(await members.admit("waiting_2")).toBe(false);
    const alerts = waitlistAlerts(errors);
    expect(alerts.map(([user]) => user)).toEqual(["one@example.com", "waiting_2"]);
    // The count of people waiting goes up by one with each.
    expect(alerts[1][1]).toBe(alerts[0][1] + 1);
    errors.mockRestore();
  });

  it("takes people off the waitlist once they're let in, or delete their account", async () => {
    resetAlerts();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("CAPTAIN_MAX_USERS", "8");
    expect(await members.admit("waiting_3")).toBe(false);
    const [[, before]] = waitlistAlerts(errors);
    // A freed place lets waiting_1 in; deleting waiting_2's account takes them off the waitlist too.
    await members.removeMember("early_a");
    expect(await members.admit("waiting_1")).toBe(true);
    await members.removeMember("waiting_2");
    expect(await members.admit("waiting_4")).toBe(false);
    const [, [, after]] = waitlistAlerts(errors);
    // Since waiting_3's alert: waiting_4 joined, waiting_1 and waiting_2 left.
    expect(after).toBe(before - 1);
    errors.mockRestore();
  });
});
