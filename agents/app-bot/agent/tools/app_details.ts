import { getDb, schema } from "@captain/core/db";
import { and, eq } from "drizzle-orm";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Get the app you belong to: name, purpose, connectors, data collections, version. The appId is in the client context of every turn.",
  inputSchema: z.object({ appId: z.string() }),
  label: { start: () => "Read app details" },
  async execute({ appId }, ctx) {
    const db = await getDb();
    const [app] = await db
      .select()
      .from(schema.apps)
      .where(and(eq(schema.apps.id, appId), eq(schema.apps.userId, ctx.session.auth.current?.principalId ?? "")));
    if (!app) throw new Error(`Unknown app ${appId}`);
    return {
      appId: app.id,
      name: app.name,
      description: app.description,
      connectors: app.connectors,
      dataSchema: app.dataSchema,
      version: app.currentVersion,
      buildThreadSessionId: app.threadId,
    };
  },
});
