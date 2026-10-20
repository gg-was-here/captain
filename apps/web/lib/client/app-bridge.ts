import { listWebRecords, onAppDataChanged, putWebRecord, removeWebRecord } from "./app-data";

/**
 * The Captain-page half of the web preview's `window.captain` bridge (the app
 * half is injected by `app/a/[appId]/[[...path]]/bridge.ts`). The app iframe
 * has an opaque origin and no session, so this side owns its data, makes the
 * API calls, and asks the user before any write action.
 */
export function serveAppBridge(frame: HTMLIFrameElement, app: { id: string; name: string }) {
  const runtime = async (kind: "ai" | "connectors", body: Record<string, unknown>, confirmed = false): Promise<any> => {
    const response = await fetch(`/api/runtime/${kind}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(confirmed ? { "x-captain-confirmed": "1" } : {}) },
      body: JSON.stringify({ appId: app.id, ...body }),
    });
    const json = await response.json().catch(() => ({ error: response.statusText }));
    if (response.status === 409 && json.needsConfirmation) {
      if (!window.confirm(`${json.summary}\n\n${JSON.stringify(json.details, null, 2).slice(0, 1500)}`)) {
        throw new Error("Cancelled by user");
      }
      return runtime(kind, body, true);
    }
    if (!response.ok) throw new Error(json.error ?? `Request failed (${response.status})`);
    return json;
  };

  const methods: Record<string, (...args: any[]) => unknown> = {
    "db.list": (collection: string) => listWebRecords(app.id, collection),
    "db.put": (collection: string, record: Record<string, unknown>) => putWebRecord(app.id, collection, record),
    "db.remove": (collection: string, id: string) => removeWebRecord(app.id, collection, id),
    "ai.generate": (request: Record<string, unknown>) => runtime("ai", request),
    "connectors.call": async (connector: string, action: string, input: Record<string, unknown>) =>
      (await runtime("connectors", { connector, action, input })).result,
  };

  const post = (message: Record<string, unknown>) => frame.contentWindow?.postMessage(message, "*");

  const onMessage = async (event: MessageEvent) => {
    if (event.source !== frame.contentWindow) return;
    if (event.data?.captain === "hello") return post({ captain: "ready" });
    if (event.data?.captain !== "call") return;
    const { id, method, args } = event.data as { id: number; method: string; args: unknown[] };
    try {
      const handler = methods[method];
      if (!handler) throw new Error(`Unknown method ${method}`);
      post({ captain: "result", id, result: await handler(...(Array.isArray(args) ? args : [])) });
    } catch (error) {
      post({ captain: "result", id, error: error instanceof Error ? error.message : String(error) });
    }
  };

  window.addEventListener("message", onMessage);
  // The app may have loaded (and said hello) before this listener existed.
  post({ captain: "ready" });
  const stopDataChanged = onAppDataChanged((appId, collection) => {
    if (appId === app.id) post({ captain: "dataChanged", collection });
  });
  return () => {
    window.removeEventListener("message", onMessage);
    stopDataChanged();
  };
}
