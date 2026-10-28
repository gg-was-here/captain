import "server-only";
import { connectSubject } from "@captain/core/auth";
import { deleteAppBundles } from "@captain/core/bundles";
import { CONNECTOR_NAMES, CONNECTORS } from "@captain/core/connectors";
import { getDb, schema } from "@captain/core/db";
import { revokeToken } from "@vercel/connect";
import { eq, inArray } from "drizzle-orm";
import { AGENTS, endSession } from "./sessions";
import { HttpError } from "./user";

/** Runs `work` on each item, a few at a time, and returns the failures. */
async function eachLimited<T>(items: T[], work: (item: T) => Promise<void>, limit = 4): Promise<unknown[]> {
  const failures: unknown[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const results = await Promise.allSettled(items.slice(i, i + limit).map(work));
    for (const result of results) if (result.status === "rejected") failures.push(result.reason);
  }
  return failures;
}

/**
 * Deletes everything Bambii stores for a user: their bot sessions (the conversations), connector tokens,
 * app bundles and database rows. Safe to run again after a partial failure: anything that must succeed
 * runs before the rows that lead to it are deleted. Used by account deletion and by Clerk's
 * `user.deleted` webhook (deletions made in Clerk itself).
 */
export async function deleteAccountData(userId: string, origin: string, cookie?: string): Promise<void> {
  const db = await getDb();
  const threads = await db.select().from(schema.threads).where(eq(schema.threads.userId, userId));
  const owned = await db.select().from(schema.sessionOwners).where(eq(schema.sessionOwners.userId, userId));

  // Every session the user started, not only those a chat points at (a chat whose save failed, say).
  const sessions = new Map<string, string>();
  for (const thread of threads) if (thread.sessionId) sessions.set(thread.sessionId, thread.agent);
  const unknown: string[] = [];
  for (const owner of owned) {
    if (sessions.has(owner.sessionId)) continue;
    if ((AGENTS as readonly string[]).includes(owner.agent)) sessions.set(owner.sessionId, owner.agent);
    else unknown.push(owner.sessionId);
  }
  const sessionFailures = await eachLimited([...sessions], ([sessionId, agent]) => endSession(origin, agent, sessionId, cookie));
  if (sessionFailures.length > 0) {
    console.error("[account] couldn't end every session", sessionFailures);
    throw new HttpError(502, "Couldn't delete all of your chats right now. Nothing else was removed; please try again.");
  }
  // Owners backfilled from chats deleted long ago don't say which bot; ask each, but don't let a bot
  // that never had the session block the deletion.
  const guesses = unknown.flatMap((sessionId) => AGENTS.map((agent) => ({ sessionId, agent })));
  const guessFailures = await eachLimited(guesses, ({ sessionId, agent }) => endSession(origin, agent, sessionId, cookie));
  if (guessFailures.length > 0) console.error("[account] couldn't end some older sessions", userId, guessFailures);

  // Connector tokens: retry once, then log any left for manual cleanup.
  const subject = connectSubject({ id: userId });
  const revoke = (name: (typeof CONNECTOR_NAMES)[number]) => revokeToken(CONNECTORS[name].uid, { subject });
  const failed = (await Promise.allSettled(CONNECTOR_NAMES.map(revoke)))
    .map((result, index) => (result.status === "rejected" ? CONNECTOR_NAMES[index] : undefined))
    .filter((name) => name !== undefined);
  const stillFailed = (await Promise.allSettled(failed.map(revoke))).filter((result) => result.status === "rejected");
  if (stillFailed.length > 0) console.error("[account] couldn't revoke connector tokens", userId, failed, stillFailed);

  // Bundles before rows: the app rows are how a retry finds them.
  const appIds = (await db.select({ id: schema.apps.id }).from(schema.apps).where(eq(schema.apps.userId, userId))).map((a) => a.id);
  const bundleFailures = await eachLimited(appIds, deleteAppBundles);
  if (bundleFailures.length > 0) {
    console.error("[account] couldn't delete every app bundle", userId, bundleFailures);
    throw new HttpError(502, "Couldn't delete all of your apps right now. Please try again.");
  }

  // Rows, in one batch so a failure leaves nothing half-deleted.
  await db.batch([
    db.delete(schema.appVersions).where(inArray(schema.appVersions.appId, appIds.length ? appIds : [""])),
    db.delete(schema.apps).where(eq(schema.apps.userId, userId)),
    db.delete(schema.threads).where(eq(schema.threads.userId, userId)),
    db.delete(schema.usage).where(eq(schema.usage.userId, userId)),
    db.delete(schema.userSettings).where(eq(schema.userSettings.userId, userId)),
    db.delete(schema.sessionOwners).where(eq(schema.sessionOwners.userId, userId)),
    db.delete(schema.sentActions).where(eq(schema.sentActions.userId, userId)),
  ]);
}
