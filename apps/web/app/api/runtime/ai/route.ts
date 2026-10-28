import { getModelSettings } from "@captain/core/models";
import { assertWithinLimit, consumeRate, consumeUsage, recordTokens, refundUsage } from "@captain/core/usage";
import { APICallError, generateText, RetryError } from "ai";
import { anthropic } from "eve/models/anthropic";
import { z } from "zod";
import { requireApp } from "@/lib/server/data";
import { HttpError, readJson, requireUser, route } from "@/lib/server/user";

/** Room for the longest answer an app can ask for (16,000 tokens); the model call stops a little before this. */
export const maxDuration = 300;
const MODEL_TIMEOUT_MS = 285_000;

const body = z.object({
  appId: z.string(),
  prompt: z.string().min(1).max(50_000),
  system: z.string().max(10_000).optional(),
  json: z.boolean().optional(),
  /** Output limit for this call: 4,000 tokens unless the app asks for more, up to 16,000. */
  maxTokens: z.number().int().min(1).max(16_000).optional(),
});

/** Anthropic models ignore a schema-less JSON response format, so JSON mode asks for it in words. */
const JSON_INSTRUCTION = "Reply with only a JSON value: no prose, no explanation and no code fences.";

/** `captain.ai.generate()` for apps the user built. Billed to the Captain account, never exposes keys. */
export const POST = route(async (request: Request) => {
  const user = await requireUser(request);
  const input = body.parse(await readJson(request));
  const app = await requireApp(user.id, input.appId);
  await consumeRate(user.id, "ai");
  await assertWithinLimit(user.id, "tokens");
  await consumeUsage(user.id, "ai");
  // The user's default model from Settings → Models (`CAPTAIN_APP_MODEL` overrides it for every user).
  // Direct Anthropic call via ANTHROPIC_API_KEY; anthropic() rejects non-Anthropic model IDs.
  const model = anthropic(process.env.CAPTAIN_APP_MODEL || (await getModelSettings(user.id)).default);
  const system = [
    `You are the AI engine inside "${app.name}", a small app the user built: ${app.description}`,
    input.system,
    input.json ? JSON_INSTRUCTION : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");

  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
      model,
      system,
      prompt: input.prompt,
      maxOutputTokens: input.maxTokens ?? 4000,
      // Stop the model when the app goes away or the call runs too long, so neither keeps billing.
      abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(MODEL_TIMEOUT_MS)]),
    });
  } catch (error) {
    if (providerRefused(error)) {
      // The model never ran, so the call doesn't count against the app's daily AI requests.
      await refundUsage(user.id, "ai").catch(() => {});
    } else {
      // Stopped part-way (the app went away, or it ran too long): the model did bill, but reported no
      // usage. Count the prompt and the most it could have written, so dropping connections can't dodge
      // the daily budget.
      await recordTokens(user.id, {
        inputTokens: Math.ceil((system.length + input.prompt.length) / 4),
        outputTokens: input.maxTokens ?? 4000,
      }).catch((e: unknown) => console.error("[runtime/ai] couldn't record token usage", e));
    }
    throw error;
  }
  await recordTokens(user.id, { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens }).catch(
    (error: unknown) => console.error("[runtime/ai] couldn't record token usage", error),
  );

  if (!input.json) return Response.json({ text: result.text });
  const object = parseJson(result.text);
  if (object === undefined) {
    throw new HttpError(502, "The AI didn't reply with valid JSON. Try again, or ask for a simpler shape.");
  }
  return Response.json({ text: result.text, object });
});

/** The provider answered with an error before generating anything (a rejected request, a rate limit, an outage). */
function providerRefused(error: unknown): boolean {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  return APICallError.isInstance(cause);
}

/** The JSON value in a model reply, allowing for a code fence around it. */
function parseJson(text: string): unknown {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(unfenced);
  } catch {
    return undefined;
  }
}
