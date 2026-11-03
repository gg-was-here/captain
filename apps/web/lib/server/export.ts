import "server-only";
import { loadBundle } from "@captain/core/bundles";
import { getDb, schema } from "@captain/core/db";
import { and, eq, inArray, like, not } from "drizzle-orm";
import { readTranscript } from "./sessions";

/** Chats read at once. Each read streams a session's history from its bot. */
const CONCURRENCY = 4;

async function mapLimited<T, R>(items: T[], work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    results.push(...(await Promise.all(items.slice(i, i + CONCURRENCY).map(work))));
  }
  return results;
}

/**
 * Everything Bambii stores for a user, as one JSON document: chats with their messages (text only, as
 * the sidebar and archive show them), apps with their versions and the current version's source,
 * settings and usage. Connector tokens aren't included: they're held by Vercel Connect, not Bambii.
 */
export async function exportAccountData(user: { id: string; name?: string | null; email?: string | null }, origin: string) {
  const db = await getDb();
  const [threads, apps, archives, settings, usage] = await Promise.all([
    db.select().from(schema.threads).where(eq(schema.threads.userId, user.id)),
    db.select().from(schema.apps).where(eq(schema.apps.userId, user.id)),
    db.select().from(schema.threadArchives).where(eq(schema.threadArchives.userId, user.id)),
    db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, user.id)),
    db
      .select({ day: schema.usage.day, kind: schema.usage.kind, count: schema.usage.count })
      .from(schema.usage)
      .where(and(eq(schema.usage.userId, user.id), not(like(schema.usage.kind, "rate:%")))),
  ]);
  const archiveByThread = new Map(archives.map((archive) => [archive.threadId, archive]));
  const versions = apps.length
    ? await db.select().from(schema.appVersions).where(inArray(schema.appVersions.appId, apps.map((app) => app.id)))
    : [];

  const chats = await mapLimited(threads, async (thread) => {
    const archive = archiveByThread.get(thread.id);
    let messages: { role: string; text: string }[] = [];
    let note: string | undefined;
    if (thread.sessionId) {
      try {
        messages = (await readTranscript(origin, thread.agent, thread.sessionId)).messages.map(({ role, text }) => ({ role, text }));
      } catch (error) {
        console.error("[export] couldn't read chat", thread.id, error);
        note = "This chat's messages couldn't be read right now. Try the export again later.";
      }
    }
    // An ended or older session's messages may survive only in its saved copy.
    if (messages.length === 0 && archive) {
      messages = archive.messages;
      note = undefined;
    }
    return {
      id: thread.id,
      title: thread.title,
      bot: thread.agent,
      appId: thread.appId,
      instructions: thread.instructions,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      messages,
      ...(note ? { note } : {}),
    };
  });

  const exportedApps = await mapLimited(apps, async (app) => {
    const appVersions = versions.filter((v) => v.appId === app.id).sort((a, b) => a.version - b.version);
    const current = appVersions.find((v) => v.version === app.currentVersion);
    let source: Record<string, string> | undefined;
    let note: string | undefined;
    if (current) {
      try {
        source = (await loadBundle(current.bundleKey))?.source;
      } catch (error) {
        console.error("[export] couldn't load app source", app.id, error);
        note = "This app's source couldn't be loaded right now. Try the export again later.";
      }
    }
    return {
      id: app.id,
      name: app.name,
      description: app.description,
      icon: app.icon,
      connectors: app.connectors,
      dataSchema: app.dataSchema,
      currentVersion: app.currentVersion,
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
      versions: appVersions.map((v) => ({ version: v.version, notes: v.notes, createdAt: v.createdAt.toISOString() })),
      ...(source ? { source } : {}),
      ...(note ? { note } : {}),
    };
  });

  const [setting] = settings;
  return {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, name: user.name ?? null, email: user.email ?? null },
    chats,
    apps: exportedApps,
    settings: setting ? { defaultModel: setting.defaultModel, builderModel: setting.builderModel } : {},
    usage: usage.map((row) => (row.kind === "cost" ? { day: row.day, kind: "aiSpendUsd", amount: row.count / 1_000_000 } : { day: row.day, kind: row.kind, amount: row.count })),
    notes: [
      "What you saved inside your apps is stored on your device (your Mac, or the browser you opened the app in), not by Bambii, so it isn't here.",
      "Gmail and Slack access tokens are held by Vercel Connect and aren't included.",
    ],
  };
}
