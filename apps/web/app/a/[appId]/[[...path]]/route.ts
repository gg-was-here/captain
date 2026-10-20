import { loadBundle } from "@captain/core/bundles";
import { getAppVersion, getApp } from "@/lib/server/data";
import { signFrameToken, verifyFrameToken } from "@/lib/server/frame-token";
import { currentUser } from "@/lib/server/user";
import { BRIDGE_SCRIPT } from "./bridge";

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
 *
 * The iframe is sandboxed without `allow-same-origin`, so the app never sees
 * Captain's session. The first navigation carries the cookie and is redirected
 * to a signed `/a/<appId>/t/<token>/` path; files under it load with the token
 * alone. The app reaches data, AI and connectors only through the injected
 * `window.captain` bridge, which relays to the embedding Captain page.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ appId: string; path?: string[] }> },
) {
  const { appId, path = [] } = await params;
  const url = new URL(request.url);
  const [marker, token, ...rest] = path;

  if (marker !== "t" || !token) {
    const user = await currentUser(request);
    const app = user ? await getApp(user.id, appId) : null;
    if (!user || !app) return new Response("Not found", { status: 404 });
    const location = new URL(`/a/${app.id}/t/${signFrameToken(user.id, app.id)}/${path.join("/")}${url.search}`, url);
    return new Response(null, { status: 302, headers: { location: location.toString(), "cache-control": "no-store" } });
  }

  const userId = verifyFrameToken(token, appId);
  const app = userId ? await getApp(userId, appId) : null;
  if (!app) return new Response("This preview has expired. Reload the app.", { status: 404 });
  const headers = {
    "content-security-policy": `default-src ${url.origin}; script-src ${url.origin}; style-src ${url.origin} 'unsafe-inline'; img-src ${url.origin} data: https:; connect-src ${url.origin}; frame-ancestors ${url.origin}`,
    // Vite emits `<script type="module" crossorigin>`, fetched in CORS mode from the sandbox's opaque origin.
    "access-control-allow-origin": "*",
    "cache-control": "private, no-cache",
  };
  const base = `/a/${app.id}/t/${token}/`;
  const file = rest.join("/") || "index.html";
  if (file === "__captain.js") {
    return new Response(BRIDGE_SCRIPT, { headers: { ...headers, "content-type": TYPES.js } });
  }

  const version = await getAppVersion(app.id);
  const bundle = version ? await loadBundle(version.bundleKey) : null;
  if (!bundle) return new Response("This app has not been built yet", { status: 404 });
  const isPage = !file.includes(".") || file === "index.html";
  const content = isPage ? bundle.dist["index.html"] : bundle.dist[file];
  if (content === undefined) return new Response("Not found", { status: 404 });
  if (isPage) {
    const html = Buffer.from(content, "base64").toString("utf8");
    const tag = `<script src="${base}__captain.js"></script>`;
    const injected = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (head) => head + tag) : tag + html;
    return new Response(injected, { headers: { ...headers, "content-type": TYPES.html } });
  }
  return new Response(Buffer.from(content, "base64"), {
    headers: { ...headers, "content-type": TYPES[file.split(".").pop() ?? ""] ?? "application/octet-stream" },
  });
}
