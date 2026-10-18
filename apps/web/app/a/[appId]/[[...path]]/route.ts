import { loadBundle } from "@captain/core/bundles";
import { getAppVersion, getApp } from "@/lib/server/data";
import { currentUser } from "@/lib/server/user";

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  json: "application/json",
  woff2: "font/woff2",
};

/**
 * Web preview of a built app (the desktop app runs the same files from disk).
 * Apps may only talk to Captain's own API; everything else is blocked by CSP.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ appId: string; path?: string[] }> },
) {
  const { appId, path = [] } = await params;
  const url = new URL(request.url);
  if (path.length === 0 && !url.pathname.endsWith("/")) {
    return Response.redirect(new URL(`${url.pathname}/${url.search}`, url), 308);
  }
  const user = await currentUser(request);
  const app = user ? await getApp(user.id, appId) : null;
  if (!app) return new Response("Not found", { status: 404 });
  const version = await getAppVersion(app.id);
  const bundle = version ? await loadBundle(version.bundleKey) : null;
  if (!bundle) return new Response("This app has not been built yet", { status: 404 });

  const file = path.join("/") || "index.html";
  const content = bundle.dist[file] ?? (file.includes(".") ? undefined : bundle.dist["index.html"]);
  if (content === undefined) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(content, "base64"), {
    headers: {
      "content-type": TYPES[file.split(".").pop() ?? ""] ?? "application/octet-stream",
      "content-security-policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'self'",
      "cache-control": "private, no-cache",
    },
  });
}
