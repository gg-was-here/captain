import { loadBundle } from "@captain/core/bundles";
import { getDb, schema } from "@captain/core/db";
import { and, desc, eq } from "drizzle-orm";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { TEMPLATE_DIR } from "../sandbox";

export default defineTool({
  description:
    "Load an existing app's latest source into /workspace/apps/<appId> so it can be edited. Use when asked to change an app that is not already in the workspace.",
  inputSchema: z.object({ appId: z.string() }),
  label: { start: () => "Open app source" },
  async execute({ appId }, ctx) {
    const userId = ctx.session.auth.current?.principalId ?? "";
    const db = await getDb();
    const [app] = await db
      .select()
      .from(schema.apps)
      .where(and(eq(schema.apps.id, appId), eq(schema.apps.userId, userId)));
    if (!app) throw new Error(`Unknown app ${appId}`);
    const [latest] = await db
      .select()
      .from(schema.appVersions)
      .where(eq(schema.appVersions.appId, appId))
      .orderBy(desc(schema.appVersions.version))
      .limit(1);
    const bundle = latest ? await loadBundle(latest.bundleKey) : null;

    const sandbox = await ctx.getSandbox();
    const dir = `/workspace/apps/${appId}`;
    await sandbox.run({ command: `rm -rf ${dir} && mkdir -p /workspace/apps && cp -R ${TEMPLATE_DIR} ${dir}` });
    for (const [path, content] of Object.entries(bundle?.source ?? {})) {
      await sandbox.writeTextFile({ path: `${dir}/${path}`, content });
    }
    return {
      appId,
      dir,
      name: app.name,
      description: app.description,
      connectors: app.connectors,
      dataSchema: app.dataSchema,
      version: app.currentVersion,
      files: Object.keys(bundle?.source ?? {}),
    };
  },
});
