import { defineDynamic } from "eve";
import { anthropic } from "eve/models/anthropic";

/**
 * The Claude models Bambii can run, with their list prices in USD per million tokens. Models are picked
 * by the operator, not users, so spend stays predictable: one model for chatting (Bambii, app bots, AI
 * calls from apps) and one for building apps (Builder, which writes the code).
 */
export const MODELS = [
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", input: 0.1, output: 0.5 },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", input: 2, output: 10 },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", input: 4, output: 20 },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];
export type ModelRole = "default" | "builder";

export const DEFAULT_MODELS: Record<ModelRole, ModelId> = { default: "claude-haiku-5-5", builder: "claude-sonnet-5-5" };

const ENV: Record<ModelRole, string> = { default: "CAPTAIN_CHAT_MODEL", builder: "CAPTAIN_BUILDER_MODEL" };

export const isModelId = (id: unknown): id is ModelId => MODELS.some((m) => m.id === id);

/** The model for `role`: `CAPTAIN_CHAT_MODEL` / `CAPTAIN_BUILDER_MODEL` when set to a listed model, else the default. */
export function serverModel(role: ModelRole): ModelId {
  const id = process.env[ENV[role]];
  if (id && !isModelId(id)) console.warn(`[models] ignoring ${ENV[role]}=${id}: not a listed model`);
  return isModelId(id) ? id : DEFAULT_MODELS[role];
}

/** Input price of `model` in USD per million tokens. */
export const inputPrice = (model: ModelId) => MODELS.find((m) => m.id === model)?.input ?? 0;

/** The model for `role`, resolved on every step so an env change applies without a rebuild of the agent. */
export function roleModel(role: ModelRole) {
  return defineDynamic({
    events: {
      // Live LanguageModel objects (direct Anthropic via ANTHROPIC_API_KEY) are only allowed at step scope.
      "step.started": async () => anthropic(serverModel(role)),
    },
  });
}
