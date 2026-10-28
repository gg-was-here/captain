/**
 * The Space: a native view beside the chat that runs one built app from disk.
 *
 * Each app runs in its own session partition under the `captain-app://<appId>/`
 * origin, with no network access of its own: its CSP blocks requests, remote
 * images and form posts, and its session routes everything else (such as WebRTC)
 * to a proxy that doesn't exist. Its only way out is the `window.captain` bridge
 * (preload/space.ts), whose requests are handled here: data goes to the app's
 * SQLite file, and AI and connector calls are proxied to the Captain backend with
 * the signed-in user's session, limited to the connectors the user approved for
 * that app. Links the app opens go to the browser only after the user agrees.
 */
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { type BrowserWindow, dialog, ipcMain, net, protocol, session, shell, WebContentsView } from "electron";
import * as store from "./store";

export const APP_SCHEME = "captain-app";

/** Must run before `app.whenReady()`. */
export function registerAppScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/** Matches the `rounded-2xl` card the Space sits in (apps/web/app/_components/thread-panel.tsx). */
const CORNER_RADIUS = 16;

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  // No remote images: an image URL can carry the app's data to any server.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-src 'none'",
].join("; ");

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  json: "application/json",
  woff2: "font/woff2",
};

const partitionsWithProtocol = new Set<string>();

function appSession(appId: string) {
  const partition = `persist:app-${appId}`;
  const ses = session.fromPartition(partition);
  if (!partitionsWithProtocol.has(partition)) {
    ses.protocol.handle(APP_SCHEME, async (request) => {
      const url = new URL(request.url);
      if (url.hostname !== appId.toLowerCase()) return new Response("Forbidden", { status: 403 });
      const manifest = await store.readManifest(appId);
      if (!manifest) return new Response("Not installed", { status: 404 });
      const path = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
      try {
        const file = store.distFile(appId, manifest.version, path);
        const response = await net.fetch(pathToFileURL(file).toString());
        if (!response.ok) throw new Error("missing");
        return new Response(response.body, {
          headers: {
            "content-type": MIME[path.split(".").pop() ?? ""] ?? "application/octet-stream",
            "content-security-policy": CSP,
          },
        });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    });
    // Apps never get camera, mic, notifications, etc. Copy buttons may write to the clipboard.
    ses.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === "clipboard-sanitized-write"));
    ses.setPermissionCheckHandler((_wc, permission) => permission === "clipboard-sanitized-write");
    // CSP can't stop WebRTC. Route the session's traffic, loopback included, to a proxy that doesn't exist;
    // app views also limit WebRTC to that proxy (see `open`).
    void ses.setProxy({ proxyRules: "http://127.0.0.1:9", proxyBypassRules: "<-loopback>" });
    partitionsWithProtocol.add(partition);
  }
  return ses;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class SpaceManager {
  private view?: WebContentsView;
  private appId?: string;
  /** Increments on every open/close so a superseded open stops quietly. */
  private generation = 0;

  constructor(
    private readonly window: BrowserWindow,
    private readonly origin: string,
  ) {}

  /** fetch() against the Captain backend as the signed-in user (main window cookies). */
  private backend(path: string, init: RequestInit = {}) {
    return this.window.webContents.session.fetch(`${this.origin}${path}`, { ...init, credentials: "include" });
  }

  async open(appId: string, version: number, bounds: Bounds) {
    const generation = ++this.generation;
    if (!store.isInstalled(appId, version) || (await store.readManifest(appId))?.version !== version) {
      const response = await this.backend(`/api/apps/${encodeURIComponent(appId)}/bundle?version=${version}`);
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      await store.installBundle(await response.json());
    }
    const manifest = await store.readManifest(appId);
    if (!manifest) throw new Error("App manifest missing");
    await this.ensurePermissions(manifest);
    if (generation !== this.generation) return;

    this.close();
    this.generation = generation;
    const view = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, "..", "preload", "space.js"),
        session: appSession(appId),
        sandbox: true,
        contextIsolation: true,
        additionalArguments: [`--captain-app=${JSON.stringify({ id: appId, name: manifest.name, version })}`],
      },
    });
    view.webContents.setWebRTCIPHandlingPolicy("disable_non_proxied_udp");
    view.webContents.setWindowOpenHandler(({ url }) => {
      void this.confirmExternal(manifest.name, url);
      return { action: "deny" };
    });
    view.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith(`${APP_SCHEME}://`)) event.preventDefault();
    });
    this.window.contentView.addChildView(view);
    view.setBounds(bounds);
    view.setBorderRadius(CORNER_RADIUS);
    this.view = view;
    this.appId = appId;
    try {
      await view.webContents.loadURL(`${APP_SCHEME}://${appId.toLowerCase()}/index.html`);
    } catch (error) {
      if (generation === this.generation) throw error;
      return;
    }
    if (process.env.CAPTAIN_DEBUG_CAPTURE) void debugCapture(this.window, view, process.env.CAPTAIN_DEBUG_CAPTURE);
  }

  setBounds(bounds: Bounds) {
    this.view?.setBounds(bounds);
  }

  reload() {
    this.view?.webContents.reload();
  }

  close() {
    this.generation++;
    if (!this.view) return;
    this.window.contentView.removeChildView(this.view);
    this.view.webContents.close();
    this.view = undefined;
    this.appId = undefined;
  }

  /** Tell the open app its data changed (e.g. its bot edited records from the chat). */
  notifyDataChanged(appId: string, collections: string[]) {
    if (this.appId !== appId || !this.view) return;
    for (const collection of collections) this.view.webContents.send("captain:data-changed", collection);
  }

  private async ensurePermissions(manifest: store.AppManifest) {
    if (manifest.connectors.length === 0) return;
    const approved = await store.approvedConnectors(manifest.appId);
    const missing = manifest.connectors.filter((c) => !approved.includes(c));
    if (missing.length === 0) return;
    const labels: Record<string, string> = { slack: "Slack", google: "Gmail" };
    const { response } = await dialog.showMessageBox(this.window, {
      type: "question",
      buttons: ["Allow", "Don't allow"],
      defaultId: 0,
      cancelId: 1,
      message: `Allow “${manifest.name}” to use ${missing.map((c) => labels[c] ?? c).join(" and ")}?`,
      detail:
        "The app will read data from these accounts as you. It always asks before posting or sending anything.",
    });
    await store.approveConnectors(manifest.appId, response === 0 ? manifest.connectors : approved);
  }

  /** The app shown in `sender` when it is this Space's view. The app id never comes from the message. */
  appIdFor(sender: Electron.WebContents): string {
    if (!this.view || sender !== this.view.webContents || !this.appId) throw new Error("Not a Captain app");
    return this.appId;
  }

  /** Apps leave the Space only through the user: a link an app opens shows its full address first. */
  private async confirmExternal(appName: string, url: string) {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return;
    }
    if (target.protocol !== "https:" && target.protocol !== "http:") return;
    const { response } = await dialog.showMessageBox(this.window, {
      type: "question",
      buttons: ["Open", "Cancel"],
      defaultId: 1,
      cancelId: 1,
      message: `“${appName}” wants to open ${target.hostname} in your browser.`,
      detail: url.length > 600 ? `${url.slice(0, 600)}…` : url,
    });
    if (response === 0) await shell.openExternal(url);
  }

  async runtimeCall(kind: "ai" | "connectors", body: Record<string, unknown>, confirmed = false): Promise<any> {
    const response = await this.backend(`/api/runtime/${kind}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(confirmed ? { "x-captain-confirmed": "1" } : {}) },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({ error: response.statusText }));
    if (response.status === 409 && json.needsConfirmation) {
      const { response: choice } = await dialog.showMessageBox(this.window, {
        type: "warning",
        buttons: ["Allow", "Cancel"],
        defaultId: 1,
        cancelId: 1,
        message: json.summary,
        detail: JSON.stringify(json.details, null, 2).slice(0, 1500),
      });
      if (choice !== 0) throw new Error("Cancelled by user");
      return this.runtimeCall(kind, body, true);
    }
    if (!response.ok) throw new Error(json.error ?? `Request failed (${response.status})`);
    return json;
  }
}

/**
 * IPC from app views, registered once for the life of the process (a second registration throws) and
 * answered by the Space that is open.
 */
export function registerAppBridge(current: () => SpaceManager | undefined) {
  const appFor = (sender: Electron.WebContents) => {
    const space = current();
    if (!space) throw new Error("Not a Captain app");
    return { space, appId: space.appIdFor(sender) };
  };

  ipcMain.handle("app:db:list", (e, collection: string) => store.listRecords(appFor(e.sender).appId, collection));
  ipcMain.handle("app:db:put", (e, collection: string, record: Record<string, unknown>) =>
    store.putRecord(appFor(e.sender).appId, collection, record),
  );
  ipcMain.handle("app:db:remove", (e, collection: string, id: string) =>
    store.removeRecord(appFor(e.sender).appId, collection, id),
  );

  ipcMain.handle("app:ai:generate", async (e, request: { prompt?: unknown; system?: unknown; json?: unknown }) => {
    const { space, appId } = appFor(e.sender);
    return space.runtimeCall("ai", { prompt: request?.prompt, system: request?.system, json: request?.json, appId });
  });

  ipcMain.handle("app:connectors:call", async (e, connector: string, action: string, input: Record<string, unknown>) => {
    const { space, appId } = appFor(e.sender);
    if (!(await store.approvedConnectors(appId)).includes(connector)) {
      throw new Error(`This app isn't allowed to use ${connector}. Re-open it to grant access.`);
    }
    const body = await space.runtimeCall("connectors", { connector, action, input, appId });
    return body.result;
  });
}

/** Dev aid: `CAPTAIN_DEBUG_CAPTURE=<dir>` saves screenshots of the window and Space after an app opens. */
async function debugCapture(window: BrowserWindow, view: WebContentsView, dir: string) {
  const { writeFile } = await import("node:fs/promises");
  await new Promise((r) => setTimeout(r, 2500));
  await writeFile(join(dir, "window.png"), (await window.webContents.capturePage()).toPNG());
  await writeFile(join(dir, "space.png"), (await view.webContents.capturePage()).toPNG());
  console.log(`[captain] captured window.png and space.png to ${dir}`);
}
