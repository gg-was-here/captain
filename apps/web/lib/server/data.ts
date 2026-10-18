import "server-only";
import { getDb, schema } from "@captain/core/db";
import { and, desc, eq } from "drizzle-orm";
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

/** The thread where Builder made this app (its threadId column stores the builder's eve session id). */
export async function findBuildThread(userId: string, sessionId: string | null) {
  if (!sessionId) return null;
  const db = await getDb();
  const [thread] = await db
    .select()
    .from(schema.threads)
    .where(and(eq(schema.threads.userId, userId), eq(schema.threads.sessionId, sessionId)));
  return thread ?? null;
}
