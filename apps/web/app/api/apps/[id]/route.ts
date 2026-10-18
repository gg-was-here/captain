import { getDb, schema } from "@captain/core/db";
import { and, eq } from "drizzle-orm";
import { findBuildThread, requireApp } from "@/lib/server/data";
import { requireUser, route } from "@/lib/server/user";

type Params = { params: Promise<{ id: string }> };

export const GET = route(async (request: Request, { params }: Params) => {
  const user = await requireUser(request);
  const app = await requireApp(user.id, (await params).id);
  const buildThread = await findBuildThread(user.id, app.threadId);
  return Response.json({ app, buildThreadId: buildThread?.id ?? null });
});

export const DELETE = route(async (request: Request, { params }: Params) => {
  const user = await requireUser(request);
  const { id } = await params;
  const db = await getDb();
  await db.delete(schema.apps).where(and(eq(schema.apps.id, id), eq(schema.apps.userId, user.id)));
  await db.delete(schema.appVersions).where(eq(schema.appVersions.appId, id));
  return new Response(null, { status: 204 });
});
