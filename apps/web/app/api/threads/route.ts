import { getDb, schema } from "@captain/core/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import { listThreads } from "@/lib/server/data";
import { requireUser, route } from "@/lib/server/user";

export const GET = route(async (request: Request) => {
  const user = await requireUser(request);
  return Response.json({ threads: await listThreads(user.id) });
});

const createThread = z.object({
  agent: z.string().min(1),
  sessionId: z.string().optional(),
  title: z.string().max(120).optional(),
  appId: z.string().optional(),
});

export const POST = route(async (request: Request) => {
  const user = await requireUser(request);
  const input = createThread.parse(await request.json());
  const db = await getDb();
  const [thread] = await db
    .insert(schema.threads)
    .values({ id: `t_${nanoid(12)}`, userId: user.id, ...input })
    .returning();
  return Response.json({ thread });
});
