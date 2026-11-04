import { count, eq, sql } from "drizzle-orm";
import { alert } from "./alerts";
import { getDb, schema } from "./db";

/**
 * A cap on how many people can use Bambii, set with `CAPTAIN_MAX_USERS` (unset: no cap). Everyone who
 * signs in becomes a member while there's room, and stays one until they delete their account; anyone
 * past the cap can sign in but is kept on the waitlist, so they never reach the bots or spend anything.
 * Members are recorded even without a cap, so setting one later never locks out people already here.
 * The operator gets an alert the first time each person lands on the waitlist.
 */
export function maxUsers(): number | undefined {
  const value = Number(process.env.CAPTAIN_MAX_USERS);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

/** Members seen by this instance. Membership only ends with account deletion, which also ends the Clerk user. */
const known = new Set<string>();

/** Whether `userId` is a member, making them one if there's room. `email` is only for the waitlist alert. */
export async function admit(userId: string, email?: string): Promise<boolean> {
  if (known.has(userId)) return true;
  const db = await getDb();
  const cap = maxUsers() ?? null;
  // One statement, so two people signing up at once can't both take the last place.
  const joined = await db.run(sql`INSERT OR IGNORE INTO members (user_id, joined_at)
    SELECT ${userId}, ${Date.now()} WHERE ${cap} IS NULL OR (SELECT count(*) FROM members) < ${cap}`);
  // Someone let in from the waitlist (the cap went up, or a place freed) is no longer waiting.
  if (joined.rowsAffected > 0) await db.delete(schema.waitlist).where(eq(schema.waitlist.userId, userId));
  const [member] = await db.select({ userId: schema.members.userId }).from(schema.members).where(eq(schema.members.userId, userId));
  if (member) known.add(userId);
  else await joinWaitlist(userId, email);
  return Boolean(member);
}

/** Records `userId` on the waitlist, alerting the operator the first time only. */
async function joinWaitlist(userId: string, email?: string): Promise<void> {
  const db = await getDb();
  const added = await db.insert(schema.waitlist).values({ userId, email, joinedAt: new Date() }).onConflictDoNothing();
  if (added.rowsAffected === 0) return;
  const [waiting] = await db.select({ n: count() }).from(schema.waitlist);
  await alert(`waitlist:${userId}`, "Someone signed up but Bambii is full, so they're on the waitlist", {
    user: email ?? userId,
    waiting: waiting?.n,
    cap: maxUsers(),
  });
}

/** Frees `userId`'s place (or their spot on the waitlist), for account deletion. */
export async function removeMember(userId: string): Promise<void> {
  known.delete(userId);
  const db = await getDb();
  await db.batch([
    db.delete(schema.members).where(eq(schema.members.userId, userId)),
    db.delete(schema.waitlist).where(eq(schema.waitlist.userId, userId)),
  ]);
}
