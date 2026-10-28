import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Menu, type MessageBoxOptions, session, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { signInWithBrowser } from "./auth";
import { clearAppSession, registerAppBridge, registerAppScheme, SpaceManager } from "./space";
import * as store from "./store";
import { deepLinkPath, isExternalUrl, mayShowInWindow } from "./urls";

/**
 * The Captain web app this shell wraps: `captainUrl` in package.json for
 * release builds, `CAPTAIN_URL=http://localhost:3000` for local dev.
 */
const ORIGIN = new URL(process.env.CAPTAIN_URL ?? require("../../package.json").captainUrl).origin;

// The app is called Bambii, but its data (installed apps, sign-in) stays in the folder it had as Captain.
app.setPath("userData", join(app.getPath("appData"), "Captain"));

registerAppScheme();
app.setAsDefaultProtocolClient("captain");
// Built apps could leak data in hostnames through <link rel="dns-prefetch">, which Chromium resolves
// directly rather than through the app sessions' proxy. Bambii doesn't need DNS prefetching.
app.commandLine.appendSwitch("dns-prefetch-disable");

let mainWindow: BrowserWindow | undefined;
let space: SpaceManager | undefined;
/** A deep link that launched the app: it arrives before the app is ready for a window. */
let launchPath: string | undefined;

function isCaptainUrl(url: string) {
  try {
    return new URL(url).origin === ORIGIN;
  } catch {
    return false;
  }
}

function openExternal(url: string) {
  if (isExternalUrl(url)) void shell.openExternal(url);
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/**
 * Shown when Bambii can't be loaded (offline, or the server is down) instead of a blank window. It tries
 * again on its own when the Mac comes back online, or when the user asks.
 */
function failurePage(target: string, reason: string) {
  const html = `<!doctype html><meta charset="utf-8"><title>Bambii</title>
<body style="font:15px -apple-system,system-ui;display:grid;place-items:center;height:100vh;margin:0;color:#333;background:#f7f7f7;-webkit-app-region:drag">
<div style="text-align:center;max-width:420px;padding:24px;-webkit-app-region:no-drag">
<p style="font-size:40px;margin:0">🧭</p>
<h1 style="font-size:20px;font-weight:600;margin:12px 0 8px">Can't reach Bambii</h1>
<p style="color:#666;margin:0">Check your internet connection. Bambii tries again when you're back online.</p>
<p style="color:#999;font-size:12px">${escapeHtml(reason)}</p>
<a href="${escapeHtml(target)}" style="display:inline-block;margin-top:8px;padding:8px 18px;border-radius:999px;background:#111;color:#fff;text-decoration:none">Try again</a>
</div>
<script>addEventListener("online", () => location.replace(${JSON.stringify(target).replace(/</g, "\\u003c")}));</script>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function createWindow(startPath = process.env.CAPTAIN_START_PATH ?? "/") {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#f7f7f7",
    show: false,
    webPreferences: {
      preload: join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      sandbox: true,
    },
  });
  mainWindow = window;

  // Google and some OAuth providers refuse embedded browsers that advertise Electron.
  const ua = window.webContents.getUserAgent().replace(/\s(Electron|Captain|Bambii)\/\S+/g, "");
  window.webContents.setUserAgent(ua);

  // Links to other sites open in the default browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  // The window has no address bar, so it only shows Bambii and its sign-in pages; anything else opens in
  // the browser, where the user can see where they are.
  window.webContents.on("will-navigate", (event) => {
    if (mayShowInWindow(event.url, ORIGIN)) return;
    event.preventDefault();
    openExternal(event.url);
  });
  window.webContents.on("will-redirect", (event) => {
    if (!event.isMainFrame || mayShowInWindow(event.url, ORIGIN)) return;
    event.preventDefault();
    openExternal(event.url);
  });

  window.once("ready-to-show", () => window.show());
  // A Bambii page that fails to load (ERR_ABORTED just means another navigation replaced it) gets a page
  // that says so, rather than a blank window that may never even show.
  window.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || !isCaptainUrl(url)) return;
    void window.loadURL(failurePage(url, `${description} (${code})`));
    if (!window.isVisible()) window.show();
  });
  void window.loadURL(`${ORIGIN}${startPath}`);

  space = new SpaceManager(window, ORIGIN);
  window.webContents.on("did-start-navigation", (details) => {
    // A new document (another thread from a deep link, a reload) never runs the page's own cleanup, so the
    // Space it had open is closed here.
    if (details.isMainFrame && !details.isSameDocument) space?.close();
  });
  window.on("closed", () => {
    if (mainWindow !== window) return;
    space?.close();
    mainWindow = undefined;
    space = undefined;
  });
}

function showThread(path: string) {
  if (!mainWindow) return createWindow(path);
  void mainWindow.loadURL(`${ORIGIN}${path}`);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/** The browser features the web UI uses (dictation and copy buttons), for Bambii's own pages only. */
const WEB_PERMISSIONS = new Set(["media", "clipboard-sanitized-write"]);

function restrictPermissions() {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const audioOnly = !("mediaTypes" in details) || !details.mediaTypes?.includes("video");
    callback(WEB_PERMISSIONS.has(permission) && audioOnly && isCaptainUrl(details.requestingUrl));
  });
  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin) => WEB_PERMISSIONS.has(permission) && isCaptainUrl(requestingOrigin),
  );
}

/** Only the Captain web UI (not third-party pages during OAuth) may use the desktop bridge. */
function isFromCaptain(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) {
  const url = event.senderFrame?.url ?? "";
  return event.sender === mainWindow?.webContents && isCaptainUrl(url);
}

/**
 * For `handle` channels, where the rejection reaches the caller. Fire-and-forget
 * `on` channels use `isFromCaptain` and drop the message instead: a throw there is
 * an uncaught main-process exception, and late messages from a frame that's
 * navigating away (e.g. a resize during reload) arrive with no senderFrame.
 */
function fromCaptain(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) {
  if (!isFromCaptain(event)) throw new Error("Forbidden");
}

ipcMain.handle("auth:sign-in-with-browser", (event) => {
  fromCaptain(event);
  if (mainWindow) return signInWithBrowser(mainWindow, ORIGIN);
});
ipcMain.handle("space:open", (event, { appId, version, bounds }) => {
  fromCaptain(event);
  return space?.open(appId, version, bounds);
});
ipcMain.on("space:bounds", (event, bounds) => {
  if (!isFromCaptain(event)) return;
  space?.setBounds(bounds);
});
ipcMain.on("space:reload", (event) => {
  if (!isFromCaptain(event)) return;
  space?.reload();
});
ipcMain.on("space:close", (event) => {
  if (!isFromCaptain(event)) return;
  space?.close();
});
ipcMain.handle("apps:read-data", (event, appId: string) => {
  fromCaptain(event);
  return store.readAllData(appId);
});
ipcMain.handle("apps:apply-changes", (event, appId: string, changes: store.AppDataChange[]) => {
  fromCaptain(event);
  space?.notifyDataChanged(appId, store.applyChanges(appId, changes));
});
ipcMain.handle("apps:installed", (event) => {
  fromCaptain(event);
  return store.installedApps();
});
ipcMain.handle("apps:remove", async (event, appId: string) => {
  fromCaptain(event);
  space?.closeApp(appId);
  await store.removeApp(appId);
  await clearAppSession(appId);
});
ipcMain.on("apps:reveal", (event, appId: string) => {
  if (!isFromCaptain(event)) return;
  shell.showItemInFolder(join(store.appDir(appId), "manifest.json"));
});
// Built apps' window.captain calls, answered by whichever Space is open. Registered once: a second
// registration throws, which broke the bridge when the window was reopened from the Dock.
registerAppBridge(() => space);

// captain://t/<threadId> deep links (e.g. from notifications or the website).
app.on("open-url", (event, url) => {
  event.preventDefault();
  const path = deepLinkPath(url);
  if (!path) return;
  if (app.isReady()) showThread(path);
  else launchPath = path;
});

app.whenReady().then(() => {
  restrictPermissions();
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: "appMenu" },
      { role: "editMenu" },
      {
        label: "View",
        submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }, { role: "togglefullscreen" }],
      },
      { role: "windowMenu" },
    ]),
  );
  createWindow(launchPath);
  if (app.isPackaged) startUpdates();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

const UPDATE_CHECK_MS = 4 * 60 * 60 * 1000;

/**
 * Checks for updates at launch and every few hours. A downloaded update installs when Bambii quits, and
 * the user is offered a restart to get it now.
 */
function startUpdates() {
  // Without a listener, an updater error is an uncaught exception in the main process.
  autoUpdater.on("error", (error) => console.error("[updater]", error));
  let offered: string | undefined;
  autoUpdater.on("update-downloaded", async (info) => {
    if (offered === info.version) return;
    offered = info.version;
    const options: MessageBoxOptions = {
      type: "info",
      message: `Bambii ${info.version} is ready`,
      detail: "Restart to use the new version now, or it installs the next time you quit Bambii.",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1,
    };
    const { response } = await (mainWindow ? dialog.showMessageBox(mainWindow, options) : dialog.showMessageBox(options));
    if (response === 0) autoUpdater.quitAndInstall();
  });
  const check = () => {
    autoUpdater.checkForUpdates().catch((error: unknown) => console.error("[updater] update check failed", error));
  };
  check();
  setInterval(check, UPDATE_CHECK_MS);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
