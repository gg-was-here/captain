import { DEFAULT_MODELS, getModelSettings, MODELS, type ModelId, saveModelSettings } from "@captain/core/models";
import { z } from "zod";
import { requireUser, route } from "@/lib/server/user";

const modelId = z.enum(MODELS.map((m) => m.id) as [ModelId, ...ModelId[]]);
const body = z.object({ default: modelId, builder: modelId });

/** The models the user can pick, the defaults, and the user's current choices. */
export const GET = route(async (request: Request) => {
  const user = await requireUser(request);
  return Response.json({ models: MODELS, defaults: DEFAULT_MODELS, settings: await getModelSettings(user.id) });
});

export const PUT = route(async (request: Request) => {
  const user = await requireUser(request);
  const parsed = body.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Pick a model from the list." }, { status: 400 });
  await saveModelSettings(user.id, parsed.data);
  return Response.json({ settings: parsed.data });
});
