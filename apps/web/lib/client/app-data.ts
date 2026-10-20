import { type AppDataChange, type AppRecord, getDesktop } from "./desktop";

/**
 * Reads and writes a built app's on-device data. In the Mac app this is the
 * app's SQLite database; in a browser it is the same localStorage layout the
 * captain SDK's web fallback uses (`captain:<appId>:<collection>`).
 */
const prefix = (appId: string) => `captain:${appId}:`;

export async function readAppData(appId: string): Promise<Record<string, AppRecord[]>> {
  const desktop = getDesktop();
  if (desktop) return desktop.readAppData(appId);
  const data: Record<string, AppRecord[]> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix(appId))) {
      data[key.slice(prefix(appId).length)] = JSON.parse(localStorage.getItem(key) ?? "[]");
    }
  }
  return data;
}

const DATA_CHANGED = "captain:app-data-changed";

/** Fires when a browser-stored app collection changes outside the app (e.g. the app bot edited it). */
export function onAppDataChanged(listener: (appId: string, collection: string) => void) {
  const handler = (event: Event) => {
    const { appId, collection } = (event as CustomEvent<{ appId: string; collection: string }>).detail;
    listener(appId, collection);
  };
  window.addEventListener(DATA_CHANGED, handler);
  return () => window.removeEventListener(DATA_CHANGED, handler);
}

// Browser storage, shared by the web preview's `window.captain` bridge and the app bot.
const readCollection = (appId: string, collection: string): AppRecord[] =>
  JSON.parse(localStorage.getItem(prefix(appId) + collection) ?? "[]");
const writeCollection = (appId: string, collection: string, records: AppRecord[]) =>
  localStorage.setItem(prefix(appId) + collection, JSON.stringify(records));

export function listWebRecords(appId: string, collection: string) {
  return readCollection(appId, collection);
}

export function putWebRecord(appId: string, collection: string, record: Record<string, unknown>): AppRecord {
  const records = readCollection(appId, collection);
  const now = new Date().toISOString();
  const id = typeof record.id === "string" ? record.id : crypto.randomUUID();
  const existing = records.find((r) => r.id === id);
  const next = { ...existing, ...record, id, createdAt: existing?.createdAt ?? now, updatedAt: now } as AppRecord;
  writeCollection(appId, collection, existing ? records.map((r) => (r.id === id ? next : r)) : [...records, next]);
  return next;
}

export function removeWebRecord(appId: string, collection: string, id: string) {
  writeCollection(appId, collection, readCollection(appId, collection).filter((r) => r.id !== id));
}

export async function applyAppChanges(appId: string, changes: AppDataChange[]) {
  const desktop = getDesktop();
  if (desktop) return desktop.applyAppChanges(appId, changes);
  for (const change of changes) {
    if (change.op === "remove") removeWebRecord(appId, change.collection, change.id);
    else putWebRecord(appId, change.collection, change.record);
  }
  for (const collection of new Set(changes.map((c) => c.collection))) {
    window.dispatchEvent(new CustomEvent(DATA_CHANGED, { detail: { appId, collection } }));
  }
}

/** Snapshot for the app bot's per-turn context: newest records first, bounded in size. */
export async function appDataSnapshot(appId: string, maxChars = 60_000) {
  const data = await readAppData(appId);
  const snapshot: Record<string, { total: number; records: AppRecord[] }> = {};
  const perCollection = Math.floor(maxChars / Math.max(1, Object.keys(data).length));
  for (const [collection, records] of Object.entries(data)) {
    const sorted = [...records].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const kept: AppRecord[] = [];
    let size = 0;
    for (const record of sorted) {
      size += JSON.stringify(record).length;
      if (size > perCollection) break;
      kept.push(record);
    }
    snapshot[collection] = { total: records.length, records: kept };
  }
  return snapshot;
}

/** Apply each `update_app_data` tool result exactly once per device. */
export async function applyOnce(callId: string, appId: string, changes: AppDataChange[]) {
  const key = `captain:applied:${callId}`;
  if (localStorage.getItem(key)) return false;
  localStorage.setItem(key, "1");
  await applyAppChanges(appId, changes);
  return true;
}
