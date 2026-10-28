import { listWebRecords, onAppDataChanged, putWebRecord, removeWebRecord } from "./app-data";

/**
 * The Bambii-page half of the web preview's `window.captain` bridge (the app half is injected by
 * `app/a/[appId]/[[...path]]/bridge.ts`). The app iframe has an opaque origin and no session, so this
 * side owns its data, makes the API calls, and asks the user before any write action.
 *
 * Only the document Bambii loaded into the frame may use the bridge. It gets a private MessagePort in
 * answer to its first "hello". If the frame then loads another document (the app reloading or moving
 * within its own files: Bambii's pages don't let frames load other sites), the port is closed and
 * `onLeft` asks for a fresh frame, so nothing from the old browsing context can reach the new bridge.
 *
 * The frame can't open windows. A link the user clicks in the app reaches `onOpenLink`, and Bambii
 * shows the address with its own Open button.
 */
export function serveAppBridge(
  frame: HTMLIFrameElement,
  app: { id: string; name: string },
  { onLeft, onOpenLink }: { onLeft: () => void; onOpenLink: (url: string) => void },
) {
  const runtime = async (kind: "ai" | "connectors", body: Record<string, unknown>, confirmed = false): Promise<any> => {
    const response = await fetch(`/api/runtime/${kind}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(confirmed ? { "x-captain-confirmed": "1" } : {}) },
      // The app id comes last, so app-supplied fields can't redirect a call to another app.
      body: JSON.stringify({ ...body, appId: app.id }),
    });
    const json = await response.json().catch(() => ({ error: response.statusText }));
    if (response.status === 409 && json.needsConfirmation) {
      if (!window.confirm(`${json.summary}\n\n${json.text ?? JSON.stringify(json.details, null, 2)}`)) {
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
    "ai.generate": ({ prompt, system, json }: Record<string, unknown> = {}) => runtime("ai", { prompt, system, json }),
    "connectors.call": async (connector: string, action: string, input: Record<string, unknown>) =>
      (await runtime("connectors", { connector, action, input })).result,
    open: (url: unknown) => {
      let target: URL | undefined;
      try {
        target = new URL(String(url));
      } catch {}
      if (!target || !["https:", "http:", "mailto:"].includes(target.protocol)) throw new Error("Only web and email links can be opened");
      onOpenLink(target.href);
    },
  };

  let port: MessagePort | undefined;
  // "waiting": the first hello from the frame gets the port. "connected": the port is out; later hellos
  // (repeats, or another document) get nothing. "left": the frame loaded another document.
  let state: "waiting" | "connected" | "left" = "waiting";
  let loads = 0;

  const serve = async (event: MessageEvent) => {
    const reply = event.target as MessagePort;
    if (event.data?.captain !== "call") return;
    const { id, method, args } = event.data as { id: number; method: string; args: unknown[] };
    try {
      const handler = Object.hasOwn(methods, method) ? methods[method] : undefined;
      if (!handler) throw new Error(`Unknown method ${method}`);
      reply.postMessage({ captain: "result", id, result: await handler(...(Array.isArray(args) ? args : [])) });
    } catch (error) {
      reply.postMessage({ captain: "result", id, error: error instanceof Error ? error.message : String(error) });
    }
  };

  const onMessage = (event: MessageEvent) => {
    if (state !== "waiting" || event.source !== frame.contentWindow || event.data?.captain !== "hello") return;
    const channel = new MessageChannel();
    port = channel.port1;
    port.onmessage = (message) => void serve(message);
    frame.contentWindow?.postMessage({ captain: "ready" }, "*", [channel.port2]);
    state = "connected";
  };

  // The first load is the document Bambii put in the frame; any later one is another document.
  const onLoad = () => {
    if (++loads === 1 || state === "left") return;
    state = "left";
    port?.close();
    port = undefined;
    onLeft();
  };

  window.addEventListener("message", onMessage);
  frame.addEventListener("load", onLoad);
  const stopDataChanged = onAppDataChanged((appId, collection) => {
    if (appId === app.id) port?.postMessage({ captain: "dataChanged", collection });
  });
  return () => {
    window.removeEventListener("message", onMessage);
    frame.removeEventListener("load", onLoad);
    stopDataChanged();
    port?.close();
  };
}
