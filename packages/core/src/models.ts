import { eq } from "drizzle-orm";
import { defineDynamic } from "eve";
import { anthropic } from "eve/models/anthropic";
import { getDb, schema } from "./db";

/**
 * The Claude models a user can pick in Settings → Models. Each user has two
 * choices: a default model for chatting (Captain, app bots, AI calls from apps)
 * and a model for building apps (Builder, which writes the code).
 */
export const MODELS = [
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", description: "Fastest and cheapest" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", description: "Balanced speed and quality" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", description: "Most capable, best for code" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];
export type ModelRole = "default" | "builder";
export type ModelSettings = Record<ModelRole, ModelId>;

export const DEFAULT_MODELS: ModelSettings = { default: "claude-haiku-5-5", builder: "claude-opus-5-5" };

export const isModelId = (id: unknown): id is ModelId => MODELS.some((m) => m.id === id);

export async function getModelSettings(userId: string): Promise<ModelSettings> {
  const db = await getDb();
  const [row] = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId));
  return {
    default: isModelId(row?.defaultModel) ? row.defaultModel : DEFAULT_MODELS.default,
    builder: isModelId(row?.builderModel) ? row.builderModel : DEFAULT_MODELS.builder,
  };
}

export async function saveModelSettings(userId: string, settings: ModelSettings): Promise<void> {
  const db = await getDb();
  const values = { defaultModel: settings.default, builderModel: settings.builder };
  await db
    .insert(schema.userSettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: schema.userSettings.userId, set: values });
  modelCache.delete(userId);
}

/** Bots resolve the model on every step, so cache each user's choice briefly instead of hitting the DB each time. */
const modelCache = new Map<string, { settings: ModelSettings; expires: number }>();

async function cachedModelSettings(userId: string): Promise<ModelSettings> {
  const hit = modelCache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.settings;
  const settings = await getModelSettings(userId);
  modelCache.set(userId, { settings, expires: Date.now() + 15_000 });
  return settings;
}

/** The model for `role` chosen by the session's Captain user. Changes in Settings apply from the next step. */
export function userModel(role: ModelRole) {
  return defineDynamic({
    events: {
      // Live LanguageModel objects (direct Anthropic via ANTHROPIC_API_KEY) are only allowed at step scope.
      "step.started": async (_event, ctx) => {
        const userId = ctx.session.auth.current?.principalId;
        const settings = userId ? await cachedModelSettings(userId) : DEFAULT_MODELS;
        return anthropic(settings[role]);
      },
    },
  });
}
