import { getDb, schema } from "@captain/core/db";
import { mayUseSession, SESSION_ID } from "@captain/core/session-owners";
import { nanoid } from "nanoid";
import { z } from "zod";
import { listThreads } from "@/lib/server/data";
import { HttpError, readJson, requireUser, route } from "@/lib/server/user";

export const GET = route(async (request: Request) => {
  const user = await requireUser(request);
  return Response.json({ threads: await listThreads(user.id) });
});

const createThread = z.object({
  agent: z.string().min(1).max(64),
  sessionId: z.string().regex(SESSION_ID).optional(),
  title: z.string().max(120).optional(),
  preview: z.string().max(200).optional(),
  instructions: z.string().max(4000).optional(),
  appId: z.string().max(64).optional(),
});

export const POST = route(async (request: Request) => {
  const user = await requireUser(request);
  const input = createThread.parse(await readJson(request));
  if (input.sessionId && !(await mayUseSession(user.id, input.sessionId))) {
    throw new HttpError(403, "That chat belongs to another account");
  }
  const db = await getDb();
  const [thread] = await db
    .insert(schema.threads)
    .values({ id: `t_${nanoid(12)}`, userId: user.id, ...input })
    .returning();
  return Response.json({ thread });
});
