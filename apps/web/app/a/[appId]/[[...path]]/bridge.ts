/**
 * `window.captain` for the web preview, injected into every built app's
 * index.html before the app's own scripts. The app runs in an opaque-origin
 * sandbox, so every call is relayed to the Captain page that embeds it
 * (`lib/client/app-bridge.ts`), which owns the data, the API session and the
 * write confirmations. Mirrors the desktop Space's preload bridge.
 */
export const BRIDGE_SCRIPT = `(() => {
  const pending = new Map();
  const listeners = new Set();
  let next = 0;
  // The app can start before the Captain page is listening (the iframe is
  // server-rendered), so calls queue until the page answers "ready".
  let queue = [];
  const send = (message) => (queue ? queue.push(message) : parent.postMessage(message, "*"));
  const call = (method, ...args) =>
    new Promise((resolve, reject) => {
      const id = ++next;
      pending.set(id, { resolve, reject });
      send({ captain: "call", id, method, args });
    });
  addEventListener("message", (event) => {
    if (event.source !== parent || !event.data) return;
    const { captain, id, result, error, collection } = event.data;
    if (captain === "ready" && queue) {
      const queued = queue;
      queue = null;
      for (const message of queued) parent.postMessage(message, "*");
    } else if (captain === "result" && pending.has(id)) {
      const { resolve, reject } = pending.get(id);
      pending.delete(id);
      error === undefined ? resolve(result) : reject(new Error(error));
    } else if (captain === "dataChanged") {
      for (const listener of listeners) listener(collection);
    }
  });
  parent.postMessage({ captain: "hello" }, "*");
  window.captain = {
    app: { id: location.pathname.split("/")[2] ?? "", name: document.title, version: 0 },
    db: {
      list: (collection) => call("db.list", collection),
      put: (collection, record) => call("db.put", collection, record),
      remove: (collection, id) => call("db.remove", collection, id),
    },
    ai: { generate: (request) => call("ai.generate", request) },
    connectors: { call: (connector, action, input = {}) => call("connectors.call", connector, action, input) },
    onDataChanged(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
})();
`;
