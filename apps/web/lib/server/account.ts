import "server-only";
import { connectSubject } from "@captain/core/auth";
import { deleteAppBundles } from "@captain/core/bundles";
import { CONNECTOR_NAMES, CONNECTORS } from "@captain/core/connectors";
import { getDb, schema } from "@captain/core/db";
import { revokeToken } from "@vercel/connect";
import { eq, inArray } from "drizzle-orm";
import { endSession } from "./sessions";
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
 * Deletes everything Bambii stores for a user: their chats' conversations (eve sessions), connector tokens,
 * database rows and app bundles. Safe to run again after a partial failure. Used by account deletion and
 * by Clerk's `user.deleted` webhook (deletions made in Clerk itself).
 */
export async function deleteAccountData(userId: string, origin: string, cookie?: string): Promise<void> {
  const db = await getDb();
  const threads = await db.select().from(schema.threads).where(eq(schema.threads.userId, userId));

  // Conversations first: if they can't all be ended, stop before deleting the rows that point at them.
  const sessionFailures = await eachLimited(
    threads.filter((thread) => thread.sessionId),
    (thread) => endSession(origin, thread.agent, thread.sessionId as string, cookie),
  );
  if (sessionFailures.length > 0) {
    console.error("[account] couldn't end every session", sessionFailures);
    throw new HttpError(502, "Couldn't delete all of your chats right now. Nothing else was removed; please try again.");
  }

  // Connector tokens: retry once, then log any left for manual cleanup.
  const subject = connectSubject({ id: userId });
  const revoke = (name: (typeof CONNECTOR_NAMES)[number]) => revokeToken(CONNECTORS[name].uid, { subject });
  const failed = (await Promise.allSettled(CONNECTOR_NAMES.map(revoke)))
    .map((result, index) => (result.status === "rejected" ? CONNECTOR_NAMES[index] : undefined))
    .filter((name) => name !== undefined);
  const stillFailed = (await Promise.allSettled(failed.map(revoke))).filter((result) => result.status === "rejected");
  if (stillFailed.length > 0) console.error("[account] couldn't revoke connector tokens", userId, failed, stillFailed);

  // Rows, in one batch so a failure leaves nothing half-deleted.
  const appIds = (await db.select({ id: schema.apps.id }).from(schema.apps).where(eq(schema.apps.userId, userId))).map((a) => a.id);
  await db.batch([
    db.delete(schema.appVersions).where(inArray(schema.appVersions.appId, appIds.length ? appIds : [""])),
    db.delete(schema.apps).where(eq(schema.apps.userId, userId)),
    db.delete(schema.threads).where(eq(schema.threads.userId, userId)),
    db.delete(schema.usage).where(eq(schema.usage.userId, userId)),
    db.delete(schema.userSettings).where(eq(schema.userSettings.userId, userId)),
    db.delete(schema.sessionOwners).where(eq(schema.sessionOwners.userId, userId)),
  ]);

  // Bundles last: listing by prefix finds them even after an earlier attempt removed the rows.
  const bundleFailures = await eachLimited(appIds, deleteAppBundles);
  if (bundleFailures.length > 0) console.error("[account] couldn't delete every app bundle", userId, bundleFailures);
}
