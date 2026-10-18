import { getDb, schema } from "@captain/core/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getThread } from "@/lib/server/data";
import { HttpError, requireUser, route } from "@/lib/server/user";

type Params = { params: Promise<{ id: string }> };

export const GET = route(async (request: Request, { params }: Params) => {
  const user = await requireUser(request);
  const thread = await getThread(user.id, (await params).id);
  if (!thread) throw new HttpError(404, "Thread not found");
  return Response.json({ thread });
});

const updateThread = z.object({
  title: z.string().min(1).max(120).optional(),
  preview: z.string().max(200).optional(),
  sessionId: z.string().optional(),
  appId: z.string().nullable().optional(),
});

export const PATCH = route(async (request: Request, { params }: Params) => {
  const user = await requireUser(request);
  const { id } = await params;
  const db = await getDb();
  const [thread] = await db
    .update(schema.threads)
    .set({ ...updateThread.parse(await request.json()), updatedAt: new Date() })
    .where(and(eq(schema.threads.id, id), eq(schema.threads.userId, user.id)))
    .returning();
  if (!thread) throw new HttpError(404, "Thread not found");
  return Response.json({ thread });
});

export const DELETE = route(async (request: Request, { params }: Params) => {
  const user = await requireUser(request);
  const db = await getDb();
  await db
    .delete(schema.threads)
    .where(and(eq(schema.threads.id, (await params).id), eq(schema.threads.userId, user.id)));
  return new Response(null, { status: 204 });
});
