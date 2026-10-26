import "server-only";
import { getDb, schema } from "@captain/core/db";
import { DEFAULT_MODELS } from "@captain/core/models";
import { generateText, Output } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { anthropic } from "eve/models/anthropic";
import { z } from "zod";
import { HttpError } from "./user";

export async function listThreads(userId: string) {
  const db = await getDb();
  return db.select().from(schema.threads).where(eq(schema.threads.userId, userId)).orderBy(desc(schema.threads.updatedAt));
}

export async function getThread(userId: string, id: string) {
  const db = await getDb();
  const [thread] = await db
    .select()
    .from(schema.threads)
    .where(and(eq(schema.threads.id, id), eq(schema.threads.userId, userId)));
  return thread ?? null;
}

export async function listApps(userId: string) {
  const db = await getDb();
  return db.select().from(schema.apps).where(eq(schema.apps.userId, userId)).orderBy(desc(schema.apps.updatedAt));
}

export async function getApp(userId: string, id: string) {
  const db = await getDb();
  const [app] = await db
    .select()
    .from(schema.apps)
    .where(and(eq(schema.apps.id, id), eq(schema.apps.userId, userId)));
  return app ?? null;
}

export async function requireApp(userId: string, id: string) {
  const app = await getApp(userId, id);
  if (!app) throw new HttpError(404, "App not found");
  return app;
}

export async function getAppVersion(appId: string, version?: number) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.appVersions)
    .where(
      version === undefined
        ? eq(schema.appVersions.appId, appId)
        : and(eq(schema.appVersions.appId, appId), eq(schema.appVersions.version, version)),
    )
    .orderBy(desc(schema.appVersions.version))
    .limit(1);
  return row ?? null;
}

/** The thread where this app was made (its threadId column stores that thread's eve session id: Builder's, or Captain's when Captain delegated). */
export async function findBuildThread(userId: string, sessionId: string | null) {
  if (!sessionId) return null;
  const db = await getDb();
  const [thread] = await db
    .select()
    .from(schema.threads)
    .where(and(eq(schema.threads.userId, userId), eq(schema.threads.sessionId, sessionId)));
  return thread ?? null;
}

/** Apps already sent to the model this process, so a failed or skipped fill isn't retried on every sidebar load. */
const taglineAttempted = new Set<string>();

/**
 * Writes the sidebar taglines for apps built before Builder started supplying them, in one model
 * call. Runs after the response, so those apps show their tagline from the next sidebar load.
 */
export async function fillMissingTaglines(apps: (typeof schema.apps.$inferSelect)[]) {
  const missing = apps.filter((app) => !app.tagline && !taglineAttempted.has(app.id));
  if (missing.length === 0) return;
  for (const app of missing) taglineAttempted.add(app.id);
  const { output } = await generateText({
    model: anthropic(DEFAULT_MODELS.default),
    output: Output.object({
      schema: z.object({ taglines: z.array(z.object({ id: z.string(), tagline: z.string() })) }),
    }),
    prompt: `For each app, write exactly three words saying what it does, like "Turkish flashcard trainer". Keep each app's id.\n\n${JSON.stringify(
      missing.map(({ id, name, description }) => ({ id, name, description })),
    )}`,
  });
  const db = await getDb();
  for (const { id, tagline } of output.taglines) {
    if (!missing.some((app) => app.id === id)) continue;
    await db.update(schema.apps).set({ tagline: tagline.slice(0, 40) }).where(eq(schema.apps.id, id));
  }
}
