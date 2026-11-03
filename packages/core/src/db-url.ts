import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { isProduction, MissingEnvError } from "./env";

/**
 * Local data lives in `<repo>/.data` so the Next.js server and every eve dev
 * server (each runs from a different cwd) share one SQLite file.
 */
export function localDataDir(): string {
  if (process.env.CAPTAIN_DATA_DIR) return process.env.CAPTAIN_DATA_DIR;
  let dir = process.cwd();
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "agents")) && existsSync(join(dir, "packages", "core"))) break;
    dir = dirname(dir);
  }
  const dataDir = join(dir === dirname(dir) ? process.cwd() : dir, ".data");
  mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

/** Turso/libSQL in production (`DATABASE_URL`), a local SQLite file otherwise. */
export function databaseUrl(): string {
  // `||`, not `??`: a blanked-out variable (e.g. in .env.development.local) means "unset".
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
  if (url) return url;
  // A local file in production would be a fresh, empty database on every instance.
  if (isProduction()) throw new MissingEnvError(["TURSO_DATABASE_URL"]);
  return `file:${join(localDataDir(), "captain.db")}`;
}
