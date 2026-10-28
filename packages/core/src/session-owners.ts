import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";

/**
 * eve's HTTP routes don't check who owns a session, so anyone who learned a session id could read or
 * drive it. Captain records an owner for each session and the channel refuses everyone else.
 */
export async function recordSessionOwner(sessionId: string, userId: string, agent: string): Promise<void> {
  const db = await getDb();
  await db.insert(schema.sessionOwners).values({ sessionId, userId, agent }).onConflictDoNothing();
}

async function ownerOf(sessionId: string): Promise<string | undefined> {
  const db = await getDb();
  const [owner] = await db
    .select({ userId: schema.sessionOwners.userId })
    .from(schema.sessionOwners)
    .where(eq(schema.sessionOwners.sessionId, sessionId));
  return owner?.userId;
}

/**
 * Whether `userId` may use `sessionId`. A session without an owner yet is claimed by the first user who
 * uses it: eve returns a new session's id only to its creator, who uses it right away (a prewarmed
 * session isn't recorded by the `session-owner` hook until its first message). A claim never replaces
 * an owner that is already recorded.
 */
export async function mayUseSession(userId: string, sessionId: string, agent = "unknown"): Promise<boolean> {
  const owner = await ownerOf(sessionId);
  if (owner !== undefined) return owner === userId;
  await recordSessionOwner(sessionId, userId, agent);
  return (await ownerOf(sessionId)) === userId;
}
