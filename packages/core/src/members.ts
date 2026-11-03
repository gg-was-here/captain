import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "./db";

/**
 * A cap on how many people can use Bambii, set with `CAPTAIN_MAX_USERS` (unset: no cap). Everyone who
 * signs in becomes a member while there's room, and stays one until they delete their account; anyone
 * past the cap can sign in but is kept on the waitlist, so they never reach the bots or spend anything.
 * Members are recorded even without a cap, so setting one later never locks out people already here.
 */
export function maxUsers(): number | undefined {
  const value = Number(process.env.CAPTAIN_MAX_USERS);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

/** Members seen by this instance. Membership only ends with account deletion, which also ends the Clerk user. */
const known = new Set<string>();

/** Whether `userId` is a member, making them one if there's room. */
export async function admit(userId: string): Promise<boolean> {
  if (known.has(userId)) return true;
  const db = await getDb();
  const cap = maxUsers() ?? null;
  // One statement, so two people signing up at once can't both take the last place.
  await db.run(sql`INSERT OR IGNORE INTO members (user_id, joined_at)
    SELECT ${userId}, ${Date.now()} WHERE ${cap} IS NULL OR (SELECT count(*) FROM members) < ${cap}`);
  const [member] = await db.select({ userId: schema.members.userId }).from(schema.members).where(eq(schema.members.userId, userId));
  if (member) known.add(userId);
  return Boolean(member);
}

/** Frees `userId`'s place, for account deletion. */
export async function removeMember(userId: string): Promise<void> {
  known.delete(userId);
  const db = await getDb();
  await db.delete(schema.members).where(eq(schema.members.userId, userId));
}
