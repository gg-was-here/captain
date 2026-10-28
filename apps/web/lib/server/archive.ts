import "server-only";
import { getDb, schema } from "@captain/core/db";
import { eq, isNotNull } from "drizzle-orm";
import { readTranscript } from "./sessions";

/**
 * Sessions started before this time still have eve's 30-day deadline (`sessionTimeoutMs: false` applies
 * only to sessions created after it shipped). Override with `CAPTAIN_SESSIONS_EXPIRE_BEFORE` (an ISO date)
 * if that deploy lands later.
 */
const EXPIRING_BEFORE = Date.parse(process.env.CAPTAIN_SESSIONS_EXPIRE_BEFORE ?? "2026-11-05T00:00:00Z");

/** Most chats saved per run, so one run stays well inside the function's time limit. */
const MAX_PER_RUN = 300;

/**
 * Saves the text of every chat whose session will expire: Builder's (which keep the 30-day limit) and
 * any started before sessions stopped expiring. Runs daily, and re-saves each one until its session has
 * ended, so the copy includes its last messages. Once a chat has moved to a new session its saved copy
 * is kept as it is.
 */
export async function archiveExpiringChats(origin: string): Promise<{ saved: number; failed: number; skipped: number }> {
  const db = await getDb();
  const threads = await db
    .select({
      id: schema.threads.id,
      userId: schema.threads.userId,
      agent: schema.threads.agent,
      sessionId: schema.threads.sessionId,
      createdAt: schema.threads.createdAt,
      sessionStarted: schema.sessionOwners.createdAt,
    })
    .from(schema.threads)
    .leftJoin(schema.sessionOwners, eq(schema.sessionOwners.sessionId, schema.threads.sessionId))
    .where(isNotNull(schema.threads.sessionId));
  const archives = new Map(
    (await db.select({ threadId: schema.threadArchives.threadId, sessionId: schema.threadArchives.sessionId, final: schema.threadArchives.final }).from(schema.threadArchives)).map(
      (a) => [a.threadId, a],
    ),
  );
  const due = threads.filter((thread) => {
    const archive = archives.get(thread.id);
    if (archive && (archive.final || archive.sessionId !== thread.sessionId)) return false;
    const started = (thread.sessionStarted ?? thread.createdAt).getTime();
    return thread.agent === "builder" || started < EXPIRING_BEFORE;
  });
  const batch = due.slice(0, MAX_PER_RUN);
  let saved = 0;
  let failed = 0;
  for (const thread of batch) {
    try {
      const { messages, ended } = await readTranscript(origin, thread.agent, thread.sessionId as string);
      // An ended session may have nothing left to read; keep what an earlier run saved.
      const set = messages.length > 0 ? { messages, final: ended } : { final: ended };
      await db
        .insert(schema.threadArchives)
        .values({ threadId: thread.id, userId: thread.userId, sessionId: thread.sessionId as string, messages, final: ended })
        .onConflictDoUpdate({ target: schema.threadArchives.threadId, set });
      saved++;
    } catch (error) {
      failed++;
      console.error("[archive] couldn't save chat", thread.id, error);
    }
  }
  if (due.length > batch.length) console.warn(`[archive] ${due.length - batch.length} chats left for the next run`);
  return { saved, failed, skipped: due.length - batch.length };
}

/** The saved copy of a chat, if it has one. */
export async function getThreadArchive(userId: string, threadId: string) {
  const db = await getDb();
  const [archive] = await db.select().from(schema.threadArchives).where(eq(schema.threadArchives.threadId, threadId));
  return archive && archive.userId === userId ? archive : null;
}
