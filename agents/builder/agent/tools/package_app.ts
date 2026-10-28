import { saveBundle, bundleKey, type AppBundle } from "@captain/core/bundles";
import { getDb, schema } from "@captain/core/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { defineTool } from "eve/tools";
import { nanoid } from "nanoid";
import { z } from "zod";

/** Comment in the template's placeholder `src/App.tsx` (packages/app-template). */
const PLACEHOLDER_MARKER = "The builder bot replaces this file.";

/**
 * Prints { dist, source, assets, skipped } for the app directory: the built files as base64, the source
 * files that rebuild the app (text as UTF-8, anything binary as base64), and what was left out and why.
 * Scratch files, data dumps and dotfiles (.env) are never collected.
 */
const COLLECT = `
const fs = require("fs"), path = require("path");
const walk = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.name.startsWith(".")) return [];
  if (e.isDirectory()) return ["node_modules", "dist"].includes(e.name) ? [] : walk(p, base);
  return [path.relative(base, p)];
});
const KEEP = /^(src\\/|public\\/|index\\.html$|package(-lock)?\\.json$|tsconfig[^/]*\\.json$|vite\\.config\\.[cm]?[jt]s$)/;
const MAX_FILE = 2_000_000, MAX_TOTAL = 20_000_000;
const dist = {}, source = {}, assets = {}, skipped = [];
let total = 0;
for (const f of walk("dist")) dist[f] = fs.readFileSync(path.join("dist", f)).toString("base64");
for (const f of walk(".")) {
  if (!KEEP.test(f)) { skipped.push(f + " (not app source)"); continue; }
  const bytes = fs.readFileSync(f);
  if (bytes.length > MAX_FILE || total + bytes.length > MAX_TOTAL) { skipped.push(f + " (too large)"); continue; }
  total += bytes.length;
  const text = bytes.toString("utf8");
  if (!bytes.includes(0) && Buffer.from(text, "utf8").equals(bytes)) source[f] = text;
  else assets[f] = bytes.toString("base64");
}
process.stdout.write(JSON.stringify({ dist, source, assets, skipped }));
`;

/** Another build took this version number. drizzle wraps the SQLite error, so look through the causes. */
function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if (/UNIQUE constraint failed|SQLITE_CONSTRAINT_(UNIQUE|PRIMARYKEY)/.test(`${String(e)} ${(e as { code?: unknown }).code ?? ""}`)) return true;
  }
  return false;
}

export default defineTool({
  description:
    "Type-check and build the app, then save it as a new version. On success the user's Bambii desktop app downloads it onto their Mac and opens it. On failure, fix the reported errors and call again.",
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
    // The sandbox may be a fresh one (a new session, or the old one expired): the files live in the last version.
    const present = await sandbox.run({ command: `test -f ${dir}/package.json` });
    if (present.exitCode !== 0) {
      return { ok: false as const, errors: `${appId} isn't in this workspace. Call open_app to load its last saved version, then make the changes again.` };
    }
    // Models sometimes call this in the same step as their file edits, which packages the untouched starter.
    const placeholder = await sandbox.run({ command: `grep -q "${PLACEHOLDER_MARKER}" src/App.tsx`, workingDirectory: dir });
    if (placeholder.exitCode === 0) {
      return {
        ok: false as const,
        errors:
          "src/App.tsx is still the starter placeholder, so nothing was packaged. Write the app first, wait for the edits to finish, then call package_app on its own (not in the same step as file edits).",
      };
    }
    const build = await sandbox.run({ command: "timeout 300 npm run build 2>&1", workingDirectory: dir });
    if (build.exitCode !== 0) {
      const errors = build.exitCode === 124 ? "The build took longer than 5 minutes and was stopped." : build.stdout.slice(-6000);
      return { ok: false as const, errors };
    }
    const collected = await sandbox.run({ command: `node -e '${COLLECT}'`, workingDirectory: dir });
    if (collected.exitCode !== 0) throw new Error(`Couldn't collect the built files: ${collected.stderr.slice(-2000)}`);
    let files: Pick<AppBundle, "dist" | "source"> & { assets: Record<string, string>; skipped: string[] };
    try {
      files = JSON.parse(collected.stdout);
    } catch {
      throw new Error("Couldn't read the built files back from the sandbox.");
    }

    // Reserve the next version number. Two builds of the same app can race; the unique index on
    // (app_id, version) lets only one have each number, and the other takes the next.
    let version = 0;
    let rowId = "";
    for (let attempt = 0; !rowId; attempt++) {
      const [latest] = await db
        .select({ version: schema.appVersions.version })
        .from(schema.appVersions)
        .where(eq(schema.appVersions.appId, appId))
        .orderBy(desc(schema.appVersions.version))
        .limit(1);
      version = Math.max(latest?.version ?? 0, app.currentVersion) + 1;
      const id = nanoid();
      try {
        await db.insert(schema.appVersions).values({ id, appId, version, bundleKey: bundleKey(appId, version), notes });
        rowId = id;
      } catch (error) {
        if (!isUniqueViolation(error) || attempt >= 4) throw error;
      }
    }
    try {
      await saveBundle({
        appId,
        version,
        name: app.name,
        icon: app.icon,
        connectors: app.connectors,
        dataSchema: app.dataSchema,
        dist: files.dist,
        source: files.source,
        assets: files.assets,
      });
    } catch (error) {
      await db
        .delete(schema.appVersions)
        .where(eq(schema.appVersions.id, rowId))
        .catch((cleanup: unknown) => console.error("[package_app] couldn't remove the unsaved version", rowId, cleanup));
      throw error;
    }
    await db
      .update(schema.apps)
      .set({ currentVersion: sql`max(${schema.apps.currentVersion}, ${version})` })
      .where(eq(schema.apps.id, appId));
    return {
      ok: true as const,
      appId,
      version,
      name: app.name,
      icon: app.icon,
      ...(files.skipped.length ? { skipped: files.skipped.slice(0, 50) } : {}),
    };
  },
  label: {
    start: () => "Build app",
    complete: (_input, output) => (output.ok ? `Built version ${output.version}` : "Build failed"),
  },
});
