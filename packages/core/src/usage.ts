import { and, eq, like, lt, sql } from "drizzle-orm";
import { getDb, schema } from "./db";

/**
 * Per-user caps on the things that cost money. Daily caps reset at midnight UTC; override a default with
 * `CAPTAIN_DAILY_<KIND>_LIMIT`, e.g. `CAPTAIN_DAILY_MESSAGES_LIMIT=500`.
 *
 * - messages: messages to Bambii's bots
 * - ai: AI calls from built apps
 * - builds: new apps (Builder sandboxes)
 * - connector: Slack and Gmail calls from built apps
 * - tokens: model usage by the bots and built apps, in input-token equivalents (see `weightedTokens`).
 *   Counting messages alone doesn't bound spend: one message can run a long, expensive turn.
 */
const DAILY = { messages: 200, ai: 500, builds: 20, connector: 1000, tokens: 10_000_000 } as const;

/** Per-minute caps that stop runaway loops in built apps or scripts. Override with `CAPTAIN_MINUTE_<KIND>_LIMIT`. */
const PER_MINUTE = { ai: 20, connector: 60, handoff: 5 } as const;

export type UsageKind = keyof typeof DAILY;
export type RateKind = keyof typeof PER_MINUTE;

const LABELS: Record<UsageKind, string> = {
  messages: "messages to Bambii's bots",
  ai: "AI requests from your apps",
  builds: "new apps",
  connector: "Slack and Gmail requests from your apps",
  tokens: "AI usage",
};

/** Usage rows for the whole deployment use this user id (see `CAPTAIN_DAILY_GLOBAL_TOKENS_LIMIT`). */
const EVERYONE = "*";

const envLimit = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export function dailyLimit(kind: UsageKind): number {
  return envLimit(`CAPTAIN_DAILY_${kind.toUpperCase()}_LIMIT`, DAILY[kind]);
}

/** A deployment-wide daily token cap, off unless `CAPTAIN_DAILY_GLOBAL_TOKENS_LIMIT` is set. */
const globalTokenLimit = () => envLimit("CAPTAIN_DAILY_GLOBAL_TOKENS_LIMIT", Number.POSITIVE_INFINITY);

export class UsageLimitError extends Error {
  constructor(
    readonly kind: UsageKind | RateKind,
    readonly limit: number,
    message = `You've reached today's limit of ${limit} ${LABELS[kind as UsageKind] ?? kind}. It resets at midnight UTC.`,
    /** Seconds until the limit resets, for a Retry-After header. */
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

const today = () => new Date().toISOString().slice(0, 10);

async function add(userId: string, day: string, kind: string, amount: number): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .insert(schema.usage)
    .values({ userId, day, kind, count: amount })
    .onConflictDoUpdate({
      target: [schema.usage.userId, schema.usage.day, schema.usage.kind],
      set: { count: sql`${schema.usage.count} + ${amount}` },
    })
    .returning({ count: schema.usage.count });
  return row?.count ?? 0;
}

async function used(userId: string, kind: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ count: schema.usage.count })
    .from(schema.usage)
    .where(and(eq(schema.usage.userId, userId), eq(schema.usage.day, today()), eq(schema.usage.kind, kind)));
  return row?.count ?? 0;
}

/** Counts `amount` uses for today and throws `UsageLimitError` once the user is over the daily limit. */
export async function consumeUsage(userId: string, kind: UsageKind, amount = 1): Promise<void> {
  const limit = dailyLimit(kind);
  if ((await add(userId, today(), kind, amount)) > limit) throw new UsageLimitError(kind, limit);
}

/** Gives back a use that produced nothing (the work failed before it ran). */
export async function refundUsage(userId: string, kind: UsageKind, amount = 1): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.usage)
    .set({ count: sql`max(${schema.usage.count} - ${amount}, 0)` })
    .where(and(eq(schema.usage.userId, userId), eq(schema.usage.day, today()), eq(schema.usage.kind, kind)));
}

/** Throws `UsageLimitError` if the user (or the whole deployment, for tokens) has no budget left today. */
export async function assertWithinLimit(userId: string, kind: UsageKind): Promise<void> {
  const limit = dailyLimit(kind);
  if ((await used(userId, kind)) >= limit) throw new UsageLimitError(kind, limit);
  if (kind === "tokens" && (await used(EVERYONE, "tokens")) >= globalTokenLimit()) {
    console.error("[usage] deployment-wide daily token limit reached");
    throw new UsageLimitError("tokens", globalTokenLimit(), "Bambii has reached today's AI usage limit. It resets at midnight UTC.");
  }
}

/** Token usage as reported by eve's `step.completed` or the AI SDK. */
export interface TokenUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly cacheReadTokens?: number;
  readonly cacheWriteTokens?: number;
}

/**
 * Usage in input-token equivalents, so one budget covers every model: Claude output costs five times its
 * input, cache reads a tenth and cache writes a quarter more.
 */
export function weightedTokens(usage: TokenUsage): number {
  return Math.round(
    (usage.inputTokens ?? 0) +
      5 * (usage.outputTokens ?? 0) +
      0.1 * (usage.cacheReadTokens ?? 0) +
      1.25 * (usage.cacheWriteTokens ?? 0),
  );
}

/** Adds a model call's usage to the user's daily token budget and the deployment's total. */
export async function recordTokens(userId: string, usage: TokenUsage): Promise<void> {
  const amount = weightedTokens(usage);
  if (amount <= 0) return;
  const day = today();
  await Promise.all([add(userId, day, "tokens", amount), add(EVERYONE, day, "tokens", amount)]);
}

/**
 * Counts one request in the current minute and throws `UsageLimitError` past the per-minute cap. Minute
 * counters live in the same table under `rate:<kind>`; old ones are cleared now and then.
 */
export async function consumeRate(userId: string, kind: RateKind): Promise<void> {
  const limit = envLimit(`CAPTAIN_MINUTE_${kind.toUpperCase()}_LIMIT`, PER_MINUTE[kind]);
  const now = new Date();
  const minute = now.toISOString().slice(0, 16);
  if (Math.random() < 0.01) {
    const db = await getDb();
    await db.delete(schema.usage).where(and(like(schema.usage.kind, "rate:%"), lt(schema.usage.day, minute)));
  }
  if ((await add(userId, minute, `rate:${kind}`, 1)) > limit) {
    throw new UsageLimitError(kind, limit, "Too many requests in a short time. Wait a minute and try again.", 60 - now.getUTCSeconds());
  }
}
