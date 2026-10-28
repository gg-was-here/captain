import { join } from "node:path";
import { app, BrowserWindow, ipcMain, Menu, session, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { signInWithBrowser } from "./auth";
import { registerAppBridge, registerAppScheme, SpaceManager } from "./space";
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
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => console.error("[updater] update check failed", error));
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
