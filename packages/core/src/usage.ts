import { sql } from "drizzle-orm";
import { getDb, schema } from "./db";

/**
 * Per-user daily caps on the things that cost money: messages to bots (model
 * tokens), AI calls from built apps, and new apps (Builder sandboxes). Override
 * a default with `CAPTAIN_DAILY_<KIND>_LIMIT`, e.g. `CAPTAIN_DAILY_MESSAGES_LIMIT=500`.
 */
const DEFAULTS = { messages: 200, ai: 500, builds: 20 } as const;

export type UsageKind = keyof typeof DEFAULTS;

const LABELS: Record<UsageKind, string> = {
  messages: "messages to Bambii's bots",
  ai: "AI requests from your apps",
  builds: "new apps",
};

export function dailyLimit(kind: UsageKind): number {
  const value = Number(process.env[`CAPTAIN_DAILY_${kind.toUpperCase()}_LIMIT`]);
  return Number.isFinite(value) && value > 0 ? value : DEFAULTS[kind];
}

export class UsageLimitError extends Error {
  constructor(readonly kind: UsageKind, readonly limit: number) {
    super(`You've reached today's limit of ${limit} ${LABELS[kind]}. It resets at midnight UTC.`);
  }
}

/** Counts one use for today and throws `UsageLimitError` once the user is over the daily limit. */
export async function consumeUsage(userId: string, kind: UsageKind): Promise<void> {
  const db = await getDb();
  const day = new Date().toISOString().slice(0, 10);
  const [row] = await db
    .insert(schema.usage)
    .values({ userId, day, kind, count: 1 })
    .onConflictDoUpdate({
      target: [schema.usage.userId, schema.usage.day, schema.usage.kind],
      set: { count: sql`${schema.usage.count} + 1` },
    })
    .returning({ count: schema.usage.count });
  const limit = dailyLimit(kind);
  if ((row?.count ?? 0) > limit) throw new UsageLimitError(kind, limit);
}
