/**
 * Exposes `window.captainDesktop` to the Captain web UI.
 * Shape must match `CaptainDesktop` in apps/web/lib/client/desktop.ts.
 */
import { contextBridge, ipcRenderer } from "electron";

type Bounds = { x: number; y: number; width: number; height: number };

contextBridge.exposeInMainWorld("captainDesktop", {
  platform: process.platform,
  version: process.env.npm_package_version ?? "",
  openSpace: (options: { appId: string; version: number; bounds: Bounds }) => ipcRenderer.invoke("space:open", options),
  setSpaceBounds: (bounds: Bounds) => ipcRenderer.send("space:bounds", bounds),
  reloadSpace: () => ipcRenderer.send("space:reload"),
  closeSpace: () => ipcRenderer.send("space:close"),
  readAppData: (appId: string) => ipcRenderer.invoke("apps:read-data", appId),
  applyAppChanges: (appId: string, changes: unknown[]) => ipcRenderer.invoke("apps:apply-changes", appId, changes),
  installedApps: () => ipcRenderer.invoke("apps:installed"),
  revealApp: (appId: string) => ipcRenderer.send("apps:reveal", appId),
});
