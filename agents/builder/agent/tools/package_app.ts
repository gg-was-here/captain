import { saveBundle, type AppBundle } from "@captain/core/bundles";
import { getDb, schema } from "@captain/core/db";
import { and, eq } from "drizzle-orm";
import { defineTool } from "eve/tools";
import { nanoid } from "nanoid";
import { z } from "zod";

/** Comment in the template's placeholder `src/App.tsx` (packages/app-template). */
const PLACEHOLDER_MARKER = "The builder bot replaces this file.";

/** Prints { dist: {path: base64}, source: {path: utf8} } for the app directory. */
const COLLECT = `
const fs = require("fs"), path = require("path");
const walk = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return ["node_modules", "dist", ".git"].includes(e.name) ? [] : walk(p, base);
  return [path.relative(base, p)];
});
const dist = {}, source = {};
for (const f of walk("dist")) dist[f] = fs.readFileSync(path.join("dist", f)).toString("base64");
for (const f of walk(".")) if (f !== "package-lock.json" && fs.statSync(f).size < 200000) source[f] = fs.readFileSync(f, "utf8");
process.stdout.write(JSON.stringify({ dist, source }));
`;

export default defineTool({
  description:
    "Type-check and build the app, then save it as a new version. On success the user's Captain desktop app downloads it onto their Mac and opens it. On failure, fix the reported errors and call again.",
  inputSchema: z.object({
    appId: z.string(),
    notes: z.string().max(200).describe("One line describing what changed in this version"),
  }),
  async execute({ appId, notes }, ctx) {
    const userId = ctx.session.auth.current?.principalId;
    const db = await getDb();
    const [app] = await db
      .select()
      .from(schema.apps)
      .where(and(eq(schema.apps.id, appId), eq(schema.apps.userId, userId ?? "")));
    if (!app) throw new Error(`Unknown app ${appId}`);

    const sandbox = await ctx.getSandbox();
    const dir = `/workspace/apps/${appId}`;
    // Models sometimes call this in the same step as their file edits, which packages the untouched starter.
    const placeholder = await sandbox.run({ command: `grep -q "${PLACEHOLDER_MARKER}" src/App.tsx`, workingDirectory: dir });
    if (placeholder.exitCode === 0) {
      return {
        ok: false as const,
        errors:
          "src/App.tsx is still the starter placeholder, so nothing was packaged. Write the app first, wait for the edits to finish, then call package_app on its own (not in the same step as file edits).",
      };
    }
    const build = await sandbox.run({ command: "npm run build 2>&1", workingDirectory: dir });
    if (build.exitCode !== 0) {
      return { ok: false as const, errors: build.stdout.slice(-6000) };
    }
    const collected = await sandbox.run({ command: `node -e '${COLLECT}'`, workingDirectory: dir });
    if (collected.exitCode !== 0) throw new Error(collected.stderr);
    const { dist, source } = JSON.parse(collected.stdout) as Pick<AppBundle, "dist" | "source">;

    const version = app.currentVersion + 1;
    const bundleKey = await saveBundle({
      appId,
      version,
      name: app.name,
      icon: app.icon,
      connectors: app.connectors,
      dataSchema: app.dataSchema,
      dist,
      source,
    });
    await db.insert(schema.appVersions).values({ id: nanoid(), appId, version, bundleKey, notes });
    await db.update(schema.apps).set({ currentVersion: version }).where(eq(schema.apps.id, appId));
    return { ok: true as const, appId, version, name: app.name, icon: app.icon };
  },
  label: {
    start: () => "Build app",
    complete: (_input, output) => (output.ok ? `Built version ${output.version}` : "Build failed"),
  },
});
