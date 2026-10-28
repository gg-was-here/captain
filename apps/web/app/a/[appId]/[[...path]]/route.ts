import { loadBundle } from "@captain/core/bundles";
import { getAppVersion, getApp } from "@/lib/server/data";
import { signFrameToken, verifyFrameToken } from "@/lib/server/frame-token";
import { currentUser } from "@/lib/server/user";
import { BRIDGE_SCRIPT } from "./bridge";

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json",
  map: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  wasm: "application/wasm",
  txt: "text/plain; charset=utf-8",
};

/** Request destinations that render a response as its own document, outside Bambii's sandboxed frame. */
const TOP_LEVEL = new Set(["document", "frame", "embed", "object"]);

/**
 * Web preview of a built app (the desktop app runs the same files from disk).
 *
 * Apps are LLM-written code, so they never run with Bambii's origin or session:
 * - Bambii shows them in an iframe sandboxed without `allow-same-origin`, and every response here also
 *   carries a CSP `sandbox`, so a preview URL opened on its own gets an opaque origin too. Requests to
 *   open one as a top-level page are refused outright.
 * - The first navigation carries the cookie and is redirected to a signed `/a/<appId>/t/<token>/` path;
 *   files under it load with the token alone.
 * - The app has no network access of its own. It reaches data, AI and connectors only through the
 *   injected `window.captain` bridge, which relays to the embedding Bambii page.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ appId: string; path?: string[] }> },
) {
  if (TOP_LEVEL.has(request.headers.get("sec-fetch-dest") ?? "")) {
    return new Response("Open this app from Bambii.", { status: 404, headers: { "cache-control": "no-store" } });
  }
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
  const origin = url.origin;
  const headers = {
    "content-security-policy": [
      `default-src ${origin}`,
      `script-src ${origin}`,
      `style-src ${origin} 'unsafe-inline'`,
      // No remote images: an image URL can carry the app's data to any server.
      `img-src ${origin} data: blob:`,
      `font-src ${origin} data:`,
      "connect-src 'none'",
      "form-action 'none'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-src 'none'",
      `frame-ancestors ${origin}`,
      "sandbox allow-scripts allow-forms allow-modals allow-popups",
    ].join("; "),
    // Vite emits `<script type="module" crossorigin>`, fetched in CORS mode from the sandbox's opaque origin.
    "access-control-allow-origin": "null",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
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
    headers: { ...headers, "content-type": TYPES[file.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream" },
  });
}
