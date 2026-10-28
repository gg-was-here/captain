import { deleteAppBundles } from "@captain/core/bundles";
import { getDb, schema } from "@captain/core/db";
import { and, eq, inArray } from "drizzle-orm";
import { findBuildThread, requireApp } from "@/lib/server/data";
import { endSession } from "@/lib/server/sessions";
import { HttpError, requireUser, route } from "@/lib/server/user";

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
  // The app's own chats go with it, conversations included. Anything that can fail runs before the rows
  // are deleted, so a failed delete can simply be retried.
  const chats = await db
    .select()
    .from(schema.threads)
    .where(and(eq(schema.threads.userId, user.id), eq(schema.threads.appId, app.id), eq(schema.threads.agent, "app-bot")));
  const origin = new URL(request.url).origin;
  const cookie = request.headers.get("cookie") ?? undefined;
  try {
    for (const chat of chats) if (chat.sessionId) await endSession(origin, chat.agent, chat.sessionId, cookie);
    await deleteAppBundles(app.id);
  } catch (error) {
    console.error("[apps] couldn't delete app", app.id, error);
    throw new HttpError(502, "Couldn't delete this app right now. Please try again.");
  }
  await db.batch([
    db.delete(schema.threadArchives).where(inArray(schema.threadArchives.threadId, chats.length ? chats.map((c) => c.id) : [""])),
    db.delete(schema.threads).where(inArray(schema.threads.id, chats.length ? chats.map((c) => c.id) : [""])),
    db.delete(schema.appVersions).where(eq(schema.appVersions.appId, app.id)),
    db.delete(schema.apps).where(and(eq(schema.apps.id, app.id), eq(schema.apps.userId, user.id))),
  ]);
  return new Response(null, { status: 204 });
});
