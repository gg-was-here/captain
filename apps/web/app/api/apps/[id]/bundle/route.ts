import { loadBundle } from "@captain/core/bundles";
import { getAppVersion, requireApp } from "@/lib/server/data";
import { HttpError, requireUser, route } from "@/lib/server/user";

/** The full app bundle (built dist + source) that the desktop app stores on device. */
export const GET = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(request);
  const app = await requireApp(user.id, (await params).id);
  const versionParam = new URL(request.url).searchParams.get("version");
  const row = await getAppVersion(app.id, versionParam ? Number(versionParam) : app.currentVersion);
  if (!row) throw new HttpError(404, "This app has not been built yet");
  const bundle = await loadBundle(row.bundleKey);
  if (!bundle) throw new HttpError(404, "Bundle missing from storage");
  return Response.json(bundle, { headers: { "cache-control": "private, max-age=31536000, immutable" } });
});
