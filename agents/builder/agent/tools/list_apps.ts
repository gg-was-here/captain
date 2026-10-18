import { getDb, schema } from "@captain/core/db";
import { desc, eq } from "drizzle-orm";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "List the apps this user has built (id, name, description, version).",
  inputSchema: z.object({}),
  label: { start: () => "List your apps" },
  async execute(_input, ctx) {
    const db = await getDb();
    return db
      .select({
        appId: schema.apps.id,
        name: schema.apps.name,
        description: schema.apps.description,
        version: schema.apps.currentVersion,
      })
      .from(schema.apps)
      .where(eq(schema.apps.userId, ctx.session.auth.current?.principalId ?? ""))
      .orderBy(desc(schema.apps.updatedAt));
  },
});
