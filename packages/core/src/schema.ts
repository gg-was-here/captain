import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
};

/** A chat thread: one durable eve session with one bot. */
export const threads = sqliteTable(
  "threads",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    /** eve workspace agent name, e.g. `captain`, `slack`, `app-bot`. */
    agent: text("agent").notNull(),
    sessionId: text("session_id"),
    title: text("title").notNull().default("New thread"),
    /** Snippet of the latest assistant reply, shown under the title in the sidebar. */
    preview: text("preview").notNull().default(""),
    /** Extra instructions the user added for this thread, sent as context with every message. */
    instructions: text("instructions").notNull().default(""),
    /** Set when this thread built an app, or is chatting with an app's bot. */
    appId: text("app_id"),
    ...timestamps,
  },
  (t) => [index("threads_user_idx").on(t.userId, t.updatedAt)],
);

/** An app built by the builder bot. The bundle itself is stored on device. */
export const apps = sqliteTable(
  "apps",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** About three words, shown under the app's thread in the sidebar. */
    tagline: text("tagline").notNull().default(""),
    icon: text("icon").notNull().default("✨"),
    /** Thread where the app was built. */
    threadId: text("thread_id"),
    /** Connectors the app may call through the captain SDK (user approves on first launch). */
    connectors: text("connectors", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** Collections the app stores in its local database, with a short field description. */
    dataSchema: text("data_schema", { mode: "json" })
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    currentVersion: integer("current_version").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("apps_user_idx").on(t.userId)],
);

export const appVersions = sqliteTable("app_versions", {
  id: text("id").primaryKey(),
  appId: text("app_id").notNull(),
  version: integer("version").notNull(),
  /** Key in bundle storage (Vercel Blob in production, `.data/bundles` locally). */
  bundleKey: text("bundle_key").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamps.createdAt,
});

/** Per-user daily usage counters, for the limits in `usage.ts`. */
export const usage = sqliteTable(
  "usage",
  {
    userId: text("user_id").notNull(),
    /** UTC date, `YYYY-MM-DD`. */
    day: text("day").notNull(),
    kind: text("kind").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.kind] })],
);

/** Who started each eve session. eve doesn't check session ownership, so the channel does (see `session-owners.ts`). */
export const sessionOwners = sqliteTable("session_owners", {
  sessionId: text("session_id").primaryKey(),
  userId: text("user_id").notNull(),
  /** eve agent the session belongs to, e.g. `captain`, or `unknown` for owners backfilled from threads. */
  agent: text("agent").notNull(),
  createdAt: timestamps.createdAt,
});

/**
 * Emails and Slack posts by tool call, so a call eve runs again after an interruption doesn't send twice
 * (see `sendOnce` in `sent-actions.ts`). Rows are kept for a week.
 */
export const sentActions = sqliteTable(
  "sent_actions",
  {
    userId: text("user_id").notNull(),
    callId: text("call_id").notNull(),
    tool: text("tool").notNull(),
    /** `pending` while sending (or when it's unknown whether the send went out), then `done`. */
    status: text("status", { enum: ["pending", "done"] }).notNull(),
    /** The send's result as JSON, once done. */
    result: text("result"),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.userId, t.callId] })],
);

/** Per-user preferences. Model ids are validated against `MODELS` in `models.ts` when read. */
export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id").primaryKey(),
  /** Model for chatting: Captain, app bots and AI calls from apps. */
  defaultModel: text("default_model"),
  /** Model for building apps (Builder). */
  builderModel: text("builder_model"),
  ...timestamps,
});

export type Thread = typeof threads.$inferSelect;
export type App = typeof apps.$inferSelect;
export type AppVersion = typeof appVersions.$inferSelect;
