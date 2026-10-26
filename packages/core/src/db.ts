import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { databaseUrl } from "./db-url";
import * as schema from "./schema";

export { schema };

const globalForDb = globalThis as unknown as { __captainDb?: ReturnType<typeof createDb> };

function createDb() {
  // `timeout` is the busy timeout for local files. Unlike `PRAGMA busy_timeout`, it applies to every
  // connection in the client's pool, not just the one that ran the pragma.
  const client = createClient({ url: databaseUrl(), authToken: process.env.TURSO_AUTH_TOKEN, timeout: 5000 });
  return { client, db: drizzle(client, { schema }), ready: migrate(client) };
}

/**
 * Idempotent bootstrap so a fresh checkout works without a migration step.
 * Keep in sync with `schema.ts`; production uses `drizzle-kit push`.
 */
async function migrate(client: ReturnType<typeof createClient>) {
  if (databaseUrl().startsWith("file:")) {
    // Local dev: the web server and every bot server share this file. WAL lets readers and a writer
    // overlap; the client's `timeout` waits for another process's write instead of failing with SQLITE_BUSY.
    await client.execute("PRAGMA journal_mode = WAL");
  }
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, agent TEXT NOT NULL, session_id TEXT,
        title TEXT NOT NULL DEFAULT 'New thread', app_id TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS threads_user_idx ON threads (user_id, updated_at)`,
      `CREATE TABLE IF NOT EXISTS apps (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT '✨', thread_id TEXT,
        connectors TEXT NOT NULL DEFAULT '[]', data_schema TEXT NOT NULL DEFAULT '{}',
        current_version INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS apps_user_idx ON apps (user_id)`,
      `CREATE TABLE IF NOT EXISTS app_versions (
        id TEXT PRIMARY KEY, app_id TEXT NOT NULL, version INTEGER NOT NULL,
        bundle_key TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS usage (
        user_id TEXT NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, day, kind))`,
      `CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY, default_model TEXT, builder_model TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
    ],
    "write",
  );
  // Columns added after the first release.
  for (const statement of [
    `ALTER TABLE threads ADD COLUMN preview TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE threads ADD COLUMN instructions TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE apps ADD COLUMN tagline TEXT NOT NULL DEFAULT ''`,
  ]) {
    await client.execute(statement).catch(() => {});
  }
}

export async function getDb() {
  globalForDb.__captainDb ??= createDb();
  await globalForDb.__captainDb.ready;
  return globalForDb.__captainDb.db;
}
