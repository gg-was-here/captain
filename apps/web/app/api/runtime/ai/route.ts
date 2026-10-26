import { getModelSettings } from "@captain/core/models";
import { consumeUsage } from "@captain/core/usage";
import { generateText, Output } from "ai";
import { anthropic } from "eve/models/anthropic";
import { z } from "zod";
import { requireApp } from "@/lib/server/data";
import { requireUser, route } from "@/lib/server/user";

const body = z.object({
  appId: z.string(),
  prompt: z.string().min(1).max(200_000),
  system: z.string().max(20_000).optional(),
  json: z.boolean().optional(),
});

/** `captain.ai.generate()` for apps the user built. Billed to the Captain account, never exposes keys. */
export const POST = route(async (request: Request) => {
  const user = await requireUser(request);
  const input = body.parse(await request.json());
  const app = await requireApp(user.id, input.appId);
  await consumeUsage(user.id, "ai");
  // The user's default model from Settings → Models (`CAPTAIN_APP_MODEL` overrides it for every user).
  // Direct Anthropic call via ANTHROPIC_API_KEY; anthropic() rejects non-Anthropic model IDs.
  const model = anthropic(process.env.CAPTAIN_APP_MODEL || (await getModelSettings(user.id)).default);
  const system = [
    `You are the AI engine inside "${app.name}", a small app the user built: ${app.description}`,
    input.system,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (input.json) {
    const { output, text } = await generateText({
      model,
      system,
      prompt: input.prompt,
      output: Output.json(),
    });
    return Response.json({ text, object: output });
  }
  const { text } = await generateText({ model, system, prompt: input.prompt });
  return Response.json({ text });
});
