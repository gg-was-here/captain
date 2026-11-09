import { loadBundle } from "@captain/core/bundles";
import { strToU8, zipSync } from "fflate";
import { getAppVersion, requireApp } from "@/lib/server/data";
import { HttpError, requireUser, route } from "@/lib/server/user";

/** A file name safe on macOS and Windows, from the app's name. */
const fileName = (name: string, version: number) =>
  `${name.replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "app"}-v${version}`;

/**
 * The app's source code as a zip, for the user to keep or run on their own (`npm install && npm run dev`).
 * The data it stores stays on the device: only the code that's saved with each version is included.
 */
export const GET = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(request);
  const app = await requireApp(user.id, (await params).id);
  const row = await getAppVersion(app.id, app.currentVersion);
  if (!row) throw new HttpError(404, "This app has not been built yet");
  const bundle = await loadBundle(row.bundleKey);
  if (!bundle) throw new HttpError(404, "Bundle missing from storage");
  const folder = fileName(app.name, row.version);
  const files: Record<string, Uint8Array> = {};
  for (const [path, text] of Object.entries(bundle.source)) files[`${folder}/${path}`] = strToU8(text);
  for (const [path, base64] of Object.entries(bundle.assets ?? {})) files[`${folder}/${path}`] = Buffer.from(base64, "base64");
  const zip = zipSync(files, { level: 6 });
  return new Response(zip, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${folder}.zip"`,
      "cache-control": "private, no-store",
    },
  });
});
