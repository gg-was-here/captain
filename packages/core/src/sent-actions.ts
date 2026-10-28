import { and, eq, lt } from "drizzle-orm";
import { UpstreamError } from "./connectors/http";
import { getDb, schema } from "./db";

const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A send failed in a way that may still have reached the service: it timed out, or the connection
 * dropped or the service errored before answering.
 */
const outcomeUnknown = (error: unknown) => error instanceof UpstreamError && (error.status === 503 || error.status === 504);

/**
 * Runs a send (an email, a Slack post) at most once per tool call. eve runs a tool call again when its
 * step was interrupted, even if the first attempt already reached Slack or Gmail; this records each call's
 * result and returns it instead of sending again. When an earlier attempt's outcome is unknown, it
 * refuses rather than risk sending twice. A send that clearly failed (an expired sign-in, a bad channel)
 * releases the call, so retrying it after reconnecting works.
 */
export async function sendOnce<T>(userId: string, callId: string, tool: string, send: () => Promise<T>): Promise<T> {
  const db = await getDb();
  const call = and(eq(schema.sentActions.userId, userId), eq(schema.sentActions.callId, callId));
  if (Math.random() < 0.01) {
    await db.delete(schema.sentActions).where(lt(schema.sentActions.createdAt, new Date(Date.now() - KEEP_MS)));
  }
  const claimed = await db
    .insert(schema.sentActions)
    .values({ userId, callId, tool, status: "pending" })
    .onConflictDoNothing()
    .returning({ callId: schema.sentActions.callId });
  if (claimed.length === 0) {
    const [earlier] = await db.select().from(schema.sentActions).where(call);
    if (earlier?.status === "done") return JSON.parse(earlier.result ?? "null") as T;
    throw new Error("An earlier attempt at this was interrupted and may have gone through. Check before sending it again.");
  }
  let result: T;
  try {
    result = await send();
  } catch (error) {
    if (!outcomeUnknown(error)) {
      await db
        .delete(schema.sentActions)
        .where(call)
        .catch((cleanup: unknown) => console.error("[sendOnce] couldn't release the call", callId, cleanup));
    }
    throw error;
  }
  // It went out. If recording that fails, the call stays pending, so a re-run refuses rather than resends.
  await db
    .update(schema.sentActions)
    .set({ status: "done", result: JSON.stringify(result ?? null) })
    .where(call)
    .catch((error: unknown) => console.error("[sendOnce] couldn't record a send", callId, error));
  return result;
}
