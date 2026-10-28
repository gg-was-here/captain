/**
 * Injected into every built app as `window.captain` — the captain SDK bridge.
 * Shape must match `CaptainBridge` in packages/app-template/src/captain.ts.
 */
import { contextBridge, ipcRenderer } from "electron";

const arg = process.argv.find((a) => a.startsWith("--captain-app="));
const appInfo = arg ? JSON.parse(arg.slice("--captain-app=".length)) : { id: "unknown", name: "", version: 0 };

contextBridge.exposeInMainWorld("captain", {
  app: appInfo,
  db: {
    list: (collection: string) => ipcRenderer.invoke("app:db:list", collection),
    put: (collection: string, record: Record<string, unknown>) => ipcRenderer.invoke("app:db:put", collection, record),
    remove: (collection: string, id: string) => ipcRenderer.invoke("app:db:remove", collection, id),
  },
  ai: {
    generate: (request: { prompt: string; system?: string; json?: boolean; maxTokens?: number }) =>
      ipcRenderer.invoke("app:ai:generate", request),
  },
  connectors: {
    call: (connector: string, action: string, input: Record<string, unknown> = {}) =>
      ipcRenderer.invoke("app:connectors:call", connector, action, input),
  },
  onDataChanged(listener: (collection: string) => void) {
    const handler = (_event: unknown, collection: string) => listener(collection);
    ipcRenderer.on("captain:data-changed", handler);
    return () => ipcRenderer.off("captain:data-changed", handler);
  },
});
