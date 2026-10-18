/**
 * On-device storage for built apps:
 *
 *   ~/Library/Application Support/Captain/apps/<appId>/
 *     manifest.json      name, icon, connectors, data schema, installed version
 *     permissions.json   connectors the user approved for this app
 *     data.db            the app's records (SQLite)
 *     v<n>/dist/…        built files served at captain-app://<appId>/
 *     v<n>/source/…      source, kept so the app can be edited and re-built
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { app } from "electron";

export interface AppManifest {
  appId: string;
  version: number;
  name: string;
  icon: string;
  connectors: string[];
  dataSchema: Record<string, string>;
}

interface AppBundle extends AppManifest {
  dist: Record<string, string>;
  source: Record<string, string>;
}

export type AppRecord = { id: string; createdAt: string; updatedAt: string; [field: string]: unknown };
export type AppDataChange =
  | { op: "put"; collection: string; record: Record<string, unknown> }
  | { op: "remove"; collection: string; id: string };

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export const appsDir = () => join(app.getPath("userData"), "apps");

export function appDir(appId: string) {
  if (!SAFE_ID.test(appId)) throw new Error(`Invalid app id ${appId}`);
  return join(appsDir(), appId);
}

/** Resolve a file inside a version's dist folder, refusing path traversal. */
export function distFile(appId: string, version: number, path: string) {
  const root = join(appDir(appId), `v${version}`, "dist");
  const file = normalize(join(root, path));
  if (!file.startsWith(root + sep) && file !== root) throw new Error("Path outside app");
  return file;
}

export async function readManifest(appId: string): Promise<AppManifest | null> {
  try {
    return JSON.parse(await readFile(join(appDir(appId), "manifest.json"), "utf8"));
  } catch {
    return null;
  }
}

export function isInstalled(appId: string, version: number) {
  return existsSync(join(appDir(appId), `v${version}`, "dist", "index.html"));
}

/** Write a downloaded bundle to disk and make it the active version. */
export async function installBundle(bundle: AppBundle) {
  const versionDir = join(appDir(bundle.appId), `v${bundle.version}`);
  await rm(versionDir, { recursive: true, force: true });
  for (const [path, base64] of Object.entries(bundle.dist)) {
    const file = normalize(join(versionDir, "dist", path));
    if (!file.startsWith(versionDir + sep)) continue;
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(base64, "base64"));
  }
  for (const [path, text] of Object.entries(bundle.source)) {
    const file = normalize(join(versionDir, "source", path));
    if (!file.startsWith(versionDir + sep)) continue;
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, text);
  }
  const { dist: _d, source: _s, ...manifest } = bundle;
  await writeFile(join(appDir(bundle.appId), "manifest.json"), JSON.stringify(manifest, null, 2));
  await pruneOldVersions(bundle.appId, bundle.version);
}

/** Keep the active version and the one before it (for quick rollback). */
async function pruneOldVersions(appId: string, keep: number) {
  for (const entry of await readdir(appDir(appId))) {
    const match = entry.match(/^v(\d+)$/);
    if (match && Number(match[1]) < keep - 1) await rm(join(appDir(appId), entry), { recursive: true, force: true });
  }
}

export async function installedApps() {
  if (!existsSync(appsDir())) return [];
  const result: { appId: string; version: number; sizeBytes: number }[] = [];
  for (const appId of await readdir(appsDir())) {
    const manifest = await readManifest(appId).catch(() => null);
    if (!manifest) continue;
    result.push({ appId, version: manifest.version, sizeBytes: await dirSize(appDir(appId)) });
  }
  return result;
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    total += entry.isDirectory() ? await dirSize(path) : (await stat(path)).size;
  }
  return total;
}

// --- Permissions ---------------------------------------------------------

export async function approvedConnectors(appId: string): Promise<string[]> {
  try {
    return JSON.parse(await readFile(join(appDir(appId), "permissions.json"), "utf8")).connectors ?? [];
  } catch {
    return [];
  }
}

export async function approveConnectors(appId: string, connectors: string[]) {
  await writeFile(join(appDir(appId), "permissions.json"), JSON.stringify({ connectors }, null, 2));
}

// --- Data ----------------------------------------------------------------

const databases = new Map<string, DatabaseSync>();

function db(appId: string) {
  let database = databases.get(appId);
  if (!database) {
    database = new DatabaseSync(join(appDir(appId), "data.db"));
    database.exec(`CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY (collection, id))`);
    databases.set(appId, database);
  }
  return database;
}

const toRecord = (row: Record<string, unknown>): AppRecord => ({
  ...JSON.parse(String(row.data)),
  id: String(row.id),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

export function listRecords(appId: string, collection: string): AppRecord[] {
  return db(appId)
    .prepare("SELECT * FROM records WHERE collection = ? ORDER BY created_at")
    .all(collection)
    .map((row) => toRecord(row as Record<string, unknown>));
}

export function putRecord(appId: string, collection: string, record: Record<string, unknown>): AppRecord {
  const database = db(appId);
  const id = typeof record.id === "string" && record.id ? record.id : crypto.randomUUID();
  const existing = database.prepare("SELECT * FROM records WHERE collection = ? AND id = ?").get(collection, id) as
    | Record<string, unknown>
    | undefined;
  const now = new Date().toISOString();
  const { id: _id, createdAt: _c, updatedAt: _u, ...fields } = record;
  const merged = { ...(existing ? JSON.parse(String(existing.data)) : {}), ...fields };
  database
    .prepare(
      `INSERT INTO records (collection, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .run(collection, id, JSON.stringify(merged), existing ? String(existing.created_at) : now, now);
  return { ...merged, id, createdAt: existing ? String(existing.created_at) : now, updatedAt: now };
}

export function removeRecord(appId: string, collection: string, id: string) {
  db(appId).prepare("DELETE FROM records WHERE collection = ? AND id = ?").run(collection, id);
}

export function readAllData(appId: string): Record<string, AppRecord[]> {
  if (!existsSync(join(appDir(appId), "data.db"))) return {};
  const data: Record<string, AppRecord[]> = {};
  for (const row of db(appId).prepare("SELECT * FROM records ORDER BY created_at").all()) {
    const r = row as Record<string, unknown>;
    (data[String(r.collection)] ??= []).push(toRecord(r));
  }
  return data;
}

export function applyChanges(appId: string, changes: AppDataChange[]) {
  const touched = new Set<string>();
  for (const change of changes) {
    if (change.op === "put") putRecord(appId, change.collection, change.record);
    else removeRecord(appId, change.collection, change.id);
    touched.add(change.collection);
  }
  return [...touched];
}
