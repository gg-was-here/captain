import { join } from "node:path";
import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { signInWithBrowser } from "./auth";
import { registerAppScheme, SpaceManager } from "./space";
import * as store from "./store";

/**
 * The Captain web app this shell wraps: `captainUrl` in package.json for
 * release builds, `CAPTAIN_URL=http://localhost:3000` for local dev.
 */
const ORIGIN = new URL(process.env.CAPTAIN_URL ?? require("../../package.json").captainUrl).origin;

registerAppScheme();
app.setAsDefaultProtocolClient("captain");

let mainWindow: BrowserWindow | undefined;
let space: SpaceManager | undefined;

function isCaptainUrl(url: string) {
  try {
    return new URL(url).origin === ORIGIN;
  } catch {
    return false;
  }
}

function createWindow() {
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

  // Google and some OAuth providers refuse embedded browsers that advertise Electron.
  const ua = window.webContents.getUserAgent().replace(/\s(Electron|Captain)\/\S+/g, "");
  window.webContents.setUserAgent(ua);

  // Links to other sites open in the default browser, except OAuth flows started by Captain.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  window.once("ready-to-show", () => window.show());
  void window.loadURL(`${ORIGIN}${process.env.CAPTAIN_START_PATH ?? "/"}`);

  space = new SpaceManager(window, ORIGIN);
  window.webContents.on("did-start-navigation", (_e, url, _inPlace, isMainFrame) => {
    // Leaving the thread page tears down its Space.
    if (isMainFrame && !isCaptainUrl(url)) space?.close();
  });
  window.on("closed", () => {
    mainWindow = undefined;
  });
  mainWindow = window;
}

/** Only the Captain web UI (not third-party pages during OAuth) may use the desktop bridge. */
function fromCaptain(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) {
  const url = event.senderFrame?.url ?? "";
  if (event.sender !== mainWindow?.webContents || !isCaptainUrl(url)) throw new Error("Forbidden");
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
  fromCaptain(event);
  space?.setBounds(bounds);
});
ipcMain.on("space:reload", (event) => {
  fromCaptain(event);
  space?.reload();
});
ipcMain.on("space:close", (event) => {
  fromCaptain(event);
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
  fromCaptain(event);
  shell.showItemInFolder(join(store.appDir(appId), "manifest.json"));
});

// captain://t/<threadId> deep links (e.g. from notifications or the website).
app.on("open-url", (event, url) => {
  event.preventDefault();
  const target = new URL(url);
  const path = `/${target.host}${target.pathname}`.replace(/\/+$/, "");
  if (!mainWindow) createWindow();
  void mainWindow?.loadURL(`${ORIGIN}${path}${target.search}`);
});

app.whenReady().then(() => {
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
  createWindow();
  if (app.isPackaged) void autoUpdater.checkForUpdatesAndNotify();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
