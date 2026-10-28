import { getDb, schema } from "@captain/core/db";
import { mayUseSession, SESSION_ID } from "@captain/core/session-owners";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getThread } from "@/lib/server/data";
import { HttpError, readJson, requireUser, route } from "@/lib/server/user";

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
  instructions: z.string().max(4000).optional(),
  sessionId: z.string().regex(SESSION_ID).optional(),
  appId: z.string().max(64).nullable().optional(),
});

export const PATCH = route(async (request: Request, { params }: Params) => {
  const user = await requireUser(request);
  const { id } = await params;
  const input = updateThread.parse(await readJson(request));
  if (input.sessionId && !(await mayUseSession(user.id, input.sessionId))) {
    throw new HttpError(403, "That chat belongs to another account");
  }
  // Editing a thread's instructions alone shouldn't move it to the top of the sidebar.
  const instructionsOnly = Object.keys(input).every((key) => key === "instructions");
  const db = await getDb();
  const [thread] = await db
    .update(schema.threads)
    .set({ ...input, updatedAt: instructionsOnly ? sql`${schema.threads.updatedAt}` : new Date() })
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
