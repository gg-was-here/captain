import { clerkConfigured } from "@captain/core/auth";
import { deleteBundles } from "@captain/core/bundles";
import { CONNECTOR_NAMES } from "@captain/core/connectors";
import { getDb, schema } from "@captain/core/db";
import { clerkClient } from "@clerk/nextjs/server";
import { eq, inArray } from "drizzle-orm";
import { disconnect } from "@/lib/server/connect";
import { requireUser, route } from "@/lib/server/user";

export const GET = route(async (request: Request) => {
  const user = await requireUser(request);
  return Response.json({ user: { id: user.id, name: user.name ?? null, email: user.email ?? null } });
});

/** Delete the account: connector tokens, threads, apps and their bundles, usage, then the Clerk user. */
export const DELETE = route(async (request: Request) => {
  const user = await requireUser(request);
  await Promise.allSettled(CONNECTOR_NAMES.map((name) => disconnect(user, name)));

  const db = await getDb();
  const appIds = (await db.select({ id: schema.apps.id }).from(schema.apps).where(eq(schema.apps.userId, user.id))).map(
    (a) => a.id,
  );
  if (appIds.length > 0) {
    const versions = await db
      .delete(schema.appVersions)
      .where(inArray(schema.appVersions.appId, appIds))
      .returning({ bundleKey: schema.appVersions.bundleKey });
    await deleteBundles(versions.map((v) => v.bundleKey));
  }
  await db.delete(schema.apps).where(eq(schema.apps.userId, user.id));
  await db.delete(schema.threads).where(eq(schema.threads.userId, user.id));
  await db.delete(schema.usage).where(eq(schema.usage.userId, user.id));

  if (clerkConfigured()) await (await clerkClient()).users.deleteUser(user.id);
  return new Response(null, { status: 204 });
});
