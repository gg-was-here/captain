import { deleteAppBundles } from "@captain/core/bundles";
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
  const app = await requireApp(user.id, (await params).id);
  const db = await getDb();
  await db.batch([
    db.delete(schema.appVersions).where(eq(schema.appVersions.appId, app.id)),
    db.delete(schema.apps).where(and(eq(schema.apps.id, app.id), eq(schema.apps.userId, user.id))),
  ]);
  // The app is gone either way; bundles left by a storage error are logged, not reported as a failed delete.
  await deleteAppBundles(app.id).catch((error: unknown) => console.error("[apps] couldn't delete bundles", app.id, error));
  return new Response(null, { status: 204 });
});
