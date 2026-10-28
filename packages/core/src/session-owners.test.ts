import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";

// A fresh local database that already holds threads from before owners were recorded.
const dataDir = mkdtempSync(join(tmpdir(), "captain-session-owners-"));
process.env.CAPTAIN_DATA_DIR = dataDir;
delete process.env.DATABASE_URL;
delete process.env.TURSO_DATABASE_URL;
const legacy = createClient({ url: `file:${join(dataDir, "captain.db")}` });
await legacy.batch([
  `CREATE TABLE threads (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, agent TEXT NOT NULL, session_id TEXT,
    title TEXT NOT NULL DEFAULT 'New thread', app_id TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `INSERT INTO threads (id, user_id, agent, session_id, created_at, updated_at) VALUES ('t_1', 'user_a', 'captain', 'wrun_legacy', 1, 1)`,
  // Someone later pointing their own thread at the same session doesn't make it theirs.
  `INSERT INTO threads (id, user_id, agent, session_id, created_at, updated_at) VALUES ('t_2', 'user_b', 'captain', 'wrun_legacy', 2, 2)`,
]);
legacy.close();

const { mayUseSession, recordSessionOwner } = await import("./session-owners");

describe("session owners", () => {
  it("lets only the recorded owner use a session", async () => {
    await recordSessionOwner("wrun_test_1", "user_a", "captain");
    expect(await mayUseSession("user_a", "wrun_test_1")).toBe(true);
    expect(await mayUseSession("user_b", "wrun_test_1")).toBe(false);
  });

  it("keeps the first owner recorded", async () => {
    await recordSessionOwner("wrun_test_2", "user_a", "captain");
    await recordSessionOwner("wrun_test_2", "user_b", "builder");
    expect(await mayUseSession("user_b", "wrun_test_2")).toBe(false);
  });

  it("backfills owners from the earliest thread that references a session", async () => {
    expect(await mayUseSession("user_a", "wrun_legacy")).toBe(true);
    expect(await mayUseSession("user_b", "wrun_legacy")).toBe(false);
  });

  it("lets the first user of an unrecorded session claim it", async () => {
    expect(await mayUseSession("user_a", "wrun_test_new")).toBe(true);
    expect(await mayUseSession("user_b", "wrun_test_new")).toBe(false);
    expect(await mayUseSession("user_a", "wrun_test_new")).toBe(true);
  });

  it("refuses ids that can't be eve session ids, without storing them", async () => {
    for (const id of ["", "short", "../x/../y", "x".repeat(200), "wrun_ok but spaced"]) {
      expect(await mayUseSession("user_a", id)).toBe(false);
    }
  });

  it("gives a session to only one of two simultaneous first users", async () => {
    const decisions = await Promise.all([mayUseSession("user_a", "wrun_test_race"), mayUseSession("user_b", "wrun_test_race")]);
    expect(decisions.filter(Boolean)).toHaveLength(1);
  });
});
