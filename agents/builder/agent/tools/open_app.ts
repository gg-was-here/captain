import { loadBundle } from "@captain/core/bundles";
import { getDb, schema } from "@captain/core/db";
import { and, desc, eq, lte } from "drizzle-orm";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { TEMPLATE_FILES } from "../lib/template-files";
import { TEMPLATE_DIR } from "../sandbox";

export default defineTool({
  description:
    "Load an existing app's latest saved source into /workspace/apps/<appId> so it can be edited. Use when asked to change an app that is not already in the workspace.",
  inputSchema: z.object({
    appId: z.string(),
    replace: z
      .boolean()
      .optional()
      .describe("Discard the working copy already in /workspace/apps and restore the last saved version"),
  }),
  label: { start: () => "Open app source" },
  async execute({ appId, replace }, ctx) {
    const userId = ctx.session.auth.current?.principalId ?? "";
    const db = await getDb();
    const [app] = await db
      .select()
      .from(schema.apps)
      .where(and(eq(schema.apps.id, appId), eq(schema.apps.userId, userId)));
    if (!app) throw new Error(`Unknown app ${appId}`);
    const details = {
      appId,
      dir: `/workspace/apps/${appId}`,
      name: app.name,
      description: app.description,
      connectors: app.connectors,
      dataSchema: app.dataSchema,
      version: app.currentVersion,
    };

    const sandbox = await ctx.getSandbox();
    const dir = details.dir;
    // The working copy may hold edits made since the last package_app; don't throw them away unasked.
    const present = await sandbox.run({ command: `test -f ${dir}/package.json` });
    if (present.exitCode === 0 && !replace) {
      return {
        ...details,
        alreadyOpen: true,
        note: "The app is already in the workspace, with any edits made since it was last packaged. Edit it there. Call open_app with replace: true only to discard those edits.",
      };
    }

    const [latest] = await db
      .select()
      .from(schema.appVersions)
      // Up to the current version: a newer row may still be uploading its bundle.
      .where(and(eq(schema.appVersions.appId, appId), lte(schema.appVersions.version, app.currentVersion)))
      .orderBy(desc(schema.appVersions.version))
      .limit(1);
    const bundle = latest ? await loadBundle(latest.bundleKey) : null;
    if (latest && !bundle) throw new Error(`The saved copy of version ${latest.version} couldn't be found, so the app can't be opened.`);

    const reset = await sandbox.run({ command: `rm -rf ${dir} && mkdir -p /workspace/apps && cp -R ${TEMPLATE_DIR} ${dir}` });
    if (reset.exitCode !== 0) throw new Error(`Couldn't prepare the app directory: ${reset.stderr}`);
    for (const [path, content] of Object.entries(bundle?.source ?? {})) {
      await sandbox.writeTextFile({ path: `${dir}/${path}`, content });
    }
    for (const [path, base64] of Object.entries(bundle?.assets ?? {})) {
      await sandbox.writeBinaryFile({ path: `${dir}/${path}`, content: Buffer.from(base64, "base64") });
    }

    // Packages the app added aren't in the template's node_modules.
    let warning: string | undefined;
    if (bundle && bundle.source["package.json"] && bundle.source["package.json"] !== TEMPLATE_FILES["package.json"]) {
      const command = bundle.source["package-lock.json"]
        ? "npm ci --ignore-scripts --no-audit --no-fund"
        : "npm install --ignore-scripts --no-audit --no-fund";
      const install = await sandbox.run({ command, workingDirectory: dir });
      if (install.exitCode !== 0) warning = `Installing the app's packages failed, so the build may too: ${install.stderr.slice(-1500)}`;
    }
    return {
      ...details,
      files: [...Object.keys(bundle?.source ?? {}), ...Object.keys(bundle?.assets ?? {})],
      ...(bundle ? {} : { note: "This app has no saved version yet, so it starts from the template." }),
      ...(warning ? { warning } : {}),
    };
  },
});
