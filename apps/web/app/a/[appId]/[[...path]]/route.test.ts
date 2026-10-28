import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

process.env.CAPTAIN_DATA_DIR = mkdtempSync(join(tmpdir(), "captain-preview-"));
delete process.env.DATABASE_URL;
delete process.env.TURSO_DATABASE_URL;
delete process.env.BLOB_READ_WRITE_TOKEN;

const { getDb, schema } = await import("@captain/core/db");
const { saveBundle } = await import("@captain/core/bundles");
const { signFrameToken } = await import("@/lib/server/frame-token");
const { GET } = await import("./route");

const b64 = (text: string) => Buffer.from(text).toString("base64");
const db = await getDb();
await db.insert(schema.apps).values({ id: "app_1", userId: "user_1", name: "Tasks", connectors: [], dataSchema: {}, currentVersion: 1 });
const bundleKey = await saveBundle({
  appId: "app_1",
  version: 1,
  name: "Tasks",
  icon: "✅",
  connectors: [],
  dataSchema: {},
  dist: {
    "index.html": b64("<!doctype html><html><head><title>Tasks</title></head><body></body></html>"),
    "assets/logo.svg": b64('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
  },
  source: {},
});
await db.insert(schema.appVersions).values({ id: "v_1", appId: "app_1", version: 1, bundleKey });
const token = signFrameToken("user_1", "app_1");

const get = (path: string, dest?: string) =>
  GET(new Request(`https://bambii.ai/a/app_1/${path}`, { headers: dest ? { "sec-fetch-dest": dest } : {} }), {
    params: Promise.resolve({ appId: "app_1", path: path.split("/").filter(Boolean) }),
  });

describe("built-app preview", () => {
  it("serves the app sandboxed, with no network or remote images of its own", async () => {
    const response = await get(`t/${token}/`, "iframe");
    expect(response.status).toBe(200);
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("sandbox allow-scripts allow-forms allow-modals allow-popups");
    expect(csp).not.toMatch(/allow-same-origin/);
    expect(csp).toMatch(/img-src [^;]*data: blob:(;|$)/);
    expect(csp).not.toMatch(/img-src [^;]*\shttps:(\s|;|$)/);
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("access-control-allow-origin")).toBe("null");
    expect(await response.text()).toContain(`<script src="/a/app_1/t/${token}/__captain.js"></script>`);
  });

  it("sandboxes every file, not just the page", async () => {
    const response = await get(`t/${token}/assets/logo.svg`, "image");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("content-security-policy")).toContain("sandbox allow-scripts");
  });

  it("refuses to open a preview as a page of its own", async () => {
    for (const dest of ["document", "frame", "embed", "object"]) {
      expect((await get(`t/${token}/`, dest)).status).toBe(404);
      expect((await get(`t/${token}/assets/logo.svg`, dest)).status).toBe(404);
      expect((await get("", dest)).status).toBe(404);
    }
  });

  it("refuses tokens that are invalid or for another app", async () => {
    expect((await get("t/not-a-token/", "iframe")).status).toBe(404);
    const other = signFrameToken("user_1", "app_2");
    expect((await get(`t/${other}/`, "iframe")).status).toBe(404);
  });

  it("serves the bridge script", async () => {
    const response = await get(`t/${token}/__captain.js`, "script");
    expect(response.headers.get("content-type")).toContain("text/javascript");
    expect(await response.text()).toContain("window.captain");
  });
});
