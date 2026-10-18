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

export async function applyAppChanges(appId: string, changes: AppDataChange[]) {
  const desktop = getDesktop();
  if (desktop) return desktop.applyAppChanges(appId, changes);
  const now = new Date().toISOString();
  for (const change of changes) {
    const key = prefix(appId) + change.collection;
    const records: AppRecord[] = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (change.op === "remove") {
      localStorage.setItem(key, JSON.stringify(records.filter((r) => r.id !== change.id)));
      continue;
    }
    const id = typeof change.record.id === "string" ? change.record.id : crypto.randomUUID();
    const existing = records.find((r) => r.id === id);
    const next = { ...existing, ...change.record, id, createdAt: existing?.createdAt ?? now, updatedAt: now };
    localStorage.setItem(
      key,
      JSON.stringify(existing ? records.map((r) => (r.id === id ? next : r)) : [...records, next]),
    );
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
