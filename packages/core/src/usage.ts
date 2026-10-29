import { and, eq, like, lt, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { inputPrice, type ModelId } from "./models";

/**
 * Per-user caps on the things that cost money. Daily caps reset at midnight UTC; override a default with
 * `CAPTAIN_DAILY_<KIND>_LIMIT`, e.g. `CAPTAIN_DAILY_MESSAGES_LIMIT=500`.
 *
 * - messages: messages to Bambii's bots
 * - ai: AI calls from built apps
 * - builds: new apps (Builder sandboxes)
 * - connector: Slack and Gmail calls from built apps
 *
 * Model spend has its own dollar budgets (see `BUDGETS`): counting messages alone doesn't bound spend,
 * since one message can run a long, expensive turn.
 */
const DAILY = { messages: 200, ai: 500, builds: 20, connector: 1000 } as const;

/** Per-minute caps that stop runaway loops in built apps or scripts. Override with `CAPTAIN_MINUTE_<KIND>_LIMIT`. */
const PER_MINUTE = { ai: 20, connector: 60, handoff: 5 } as const;

/**
 * Model spend caps in USD, per user and for the whole deployment, per UTC day and month. Override with
 * `CAPTAIN_USER_DAILY_USD`, `CAPTAIN_USER_MONTHLY_USD`, `CAPTAIN_GLOBAL_DAILY_USD` and
 * `CAPTAIN_GLOBAL_MONTHLY_USD`. The defaults keep the whole deployment under $200 a month.
 */
const BUDGETS = { userDaily: 1, userMonthly: 3, globalDaily: 12, globalMonthly: 180 } as const;

export type UsageKind = keyof typeof DAILY;
export type RateKind = keyof typeof PER_MINUTE;

const LABELS: Record<UsageKind, string> = {
  messages: "messages to Bambii's bots",
  ai: "AI requests from your apps",
  builds: "new apps",
  connector: "Slack and Gmail requests from your apps",
};

/** Usage rows for the whole deployment use this user id. */
const EVERYONE = "*";

/** Spend is stored as whole micro-dollars under usage kind `cost`. */
const MICROS = 1_000_000;

const envLimit = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export function dailyLimit(kind: UsageKind): number {
  return envLimit(`CAPTAIN_DAILY_${kind.toUpperCase()}_LIMIT`, DAILY[kind]);
}

/** The spend caps in USD, after env overrides. */
export function budgets() {
  return {
    userDaily: envLimit("CAPTAIN_USER_DAILY_USD", BUDGETS.userDaily),
    userMonthly: envLimit("CAPTAIN_USER_MONTHLY_USD", BUDGETS.userMonthly),
    globalDaily: envLimit("CAPTAIN_GLOBAL_DAILY_USD", BUDGETS.globalDaily),
    globalMonthly: envLimit("CAPTAIN_GLOBAL_MONTHLY_USD", BUDGETS.globalMonthly),
  };
}

export class UsageLimitError extends Error {
  constructor(
    readonly kind: UsageKind | RateKind | "cost",
    readonly limit: number,
    message = `You've reached today's limit of ${limit} ${LABELS[kind as UsageKind] ?? kind}. It resets at midnight UTC.`,
    /** Seconds until the limit resets, for a Retry-After header. */
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

/** The first day of next month (UTC), when monthly budgets reset. */
function nextMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

const monthDay = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

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

async function usedThisMonth(userId: string, kind: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.usage.count}), 0)` })
    .from(schema.usage)
    .where(and(eq(schema.usage.userId, userId), eq(schema.usage.kind, kind), like(schema.usage.day, `${thisMonth()}-%`)));
  return Number(row?.total ?? 0);
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

/** Throws `UsageLimitError` if the user has none of `kind` left today. */
export async function assertWithinLimit(userId: string, kind: UsageKind): Promise<void> {
  const limit = dailyLimit(kind);
  if ((await used(userId, kind)) >= limit) throw new UsageLimitError(kind, limit);
}

/** Token usage as reported by eve's `step.completed` or the AI SDK. */
export interface TokenUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly cacheReadTokens?: number;
  readonly cacheWriteTokens?: number;
}

/**
 * Usage in input-token equivalents: Claude output costs five times its input, cache reads a tenth and
 * cache writes a quarter more. `inputTokens` is the total input, cache reads and writes included (as eve
 * and the AI SDK report it), so only the rest is charged at the full rate.
 */
export function weightedTokens(usage: TokenUsage): number {
  const cacheRead = usage.cacheReadTokens ?? 0;
  const cacheWrite = usage.cacheWriteTokens ?? 0;
  const uncached = Math.max(0, (usage.inputTokens ?? 0) - cacheRead - cacheWrite);
  return Math.round(uncached + 5 * (usage.outputTokens ?? 0) + 0.1 * cacheRead + 1.25 * cacheWrite);
}

/** What a model call cost in micro-dollars: its input-token equivalents at the model's input price per million. */
export function costMicros(model: ModelId, usage: TokenUsage): number {
  return Math.round(weightedTokens(usage) * inputPrice(model));
}

/** Adds a model call's cost to the user's spend and the deployment's. */
export async function recordCost(userId: string, model: ModelId, usage: TokenUsage): Promise<void> {
  const amount = costMicros(model, usage);
  if (amount <= 0) return;
  const day = today();
  await Promise.all([add(userId, day, "cost", amount), add(EVERYONE, day, "cost", amount)]);
}

/**
 * Throws `UsageLimitError` once the whole deployment or the user has used up today's or this month's AI
 * budget. Checked before model work starts and after every model call, so one long turn stops part-way.
 */
export async function assertWithinBudget(userId: string): Promise<void> {
  const caps = budgets();
  const [allMonth, allDay, userMonth, userDay] = await Promise.all([
    usedThisMonth(EVERYONE, "cost"),
    used(EVERYONE, "cost"),
    usedThisMonth(userId, "cost"),
    used(userId, "cost"),
  ]);
  const resets = monthDay(nextMonth());
  if (allMonth >= caps.globalMonthly * MICROS) {
    console.error("[usage] deployment-wide monthly AI budget reached");
    throw new UsageLimitError("cost", caps.globalMonthly, `Bambii has reached this month's AI usage limit. It resets on ${resets}.`);
  }
  if (allDay >= caps.globalDaily * MICROS) {
    console.error("[usage] deployment-wide daily AI budget reached");
    throw new UsageLimitError("cost", caps.globalDaily, "Bambii has reached today's AI usage limit. It resets at midnight UTC.");
  }
  if (userMonth >= caps.userMonthly * MICROS) {
    throw new UsageLimitError("cost", caps.userMonthly, `You've used this month's AI allowance. It resets on ${resets}.`);
  }
  if (userDay >= caps.userDaily * MICROS) {
    throw new UsageLimitError("cost", caps.userDaily, "You've used today's AI allowance. It resets at midnight UTC.");
  }
}

/** A user's model spend so far in USD, against their budgets, for Settings. */
export async function budgetStatus(userId: string) {
  const [day, month] = await Promise.all([used(userId, "cost"), usedThisMonth(userId, "cost")]);
  const caps = budgets();
  return {
    usedToday: day / MICROS,
    dailyLimit: caps.userDaily,
    usedThisMonth: month / MICROS,
    monthlyLimit: caps.userMonthly,
    monthResetsAt: nextMonth().toISOString(),
  };
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
