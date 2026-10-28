import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";

/**
 * eve's HTTP routes don't check who owns a session, so anyone who learned a session id could read or
 * drive it. Captain records the user who started each session (the `session-owner` hook in every bot)
 * and the channel refuses requests for a session from anyone else.
 */
export async function recordSessionOwner(sessionId: string, userId: string, agent: string): Promise<void> {
  const db = await getDb();
  await db.insert(schema.sessionOwners).values({ sessionId, userId, agent }).onConflictDoNothing();
}

/**
 * The hook writes the owner just after the session starts, so the creator's first requests (such as
 * opening the stream) can arrive before it. Wait for it briefly before deciding.
 */
const OWNER_WAIT_MS = [0, 150, 300, 600];

/** Whether `userId` may use `sessionId`: they started it, or no owner was ever recorded for it. */
export async function mayUseSession(userId: string, sessionId: string): Promise<boolean> {
  const db = await getDb();
  for (const delay of OWNER_WAIT_MS) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const [owner] = await db
      .select({ userId: schema.sessionOwners.userId })
      .from(schema.sessionOwners)
      .where(eq(schema.sessionOwners.sessionId, sessionId));
    if (owner) return owner.userId === userId;
  }
  // No owner: a session the hook couldn't record, or one no thread ever referenced. Refusing would lock
  // its creator out, so allow it, and log so it shows up if it happens more than rarely.
  console.warn("[session-owners] no owner recorded for session", sessionId);
  return true;
}
