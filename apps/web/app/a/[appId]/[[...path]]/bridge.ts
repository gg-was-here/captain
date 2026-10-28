/**
 * `window.captain` for the web preview, injected into every built app's index.html before the app's own
 * scripts. The app runs in an opaque-origin sandbox, so every call is relayed to the Bambii page that
 * embeds it (`lib/client/app-bridge.ts`), which owns the data, the API session and the write
 * confirmations. Mirrors the desktop Space's preload bridge.
 *
 * Calls travel over a private MessagePort that the Bambii page hands to this document in answer to its
 * "hello", so a page the frame navigates to later can't use the bridge.
 */
export const BRIDGE_SCRIPT = `(() => {
  const pending = new Map();
  const listeners = new Set();
  const queue = [];
  let next = 0;
  let port = null;
  const send = (message) => (port ? port.postMessage(message) : queue.push(message));
  const call = (method, ...args) =>
    new Promise((resolve, reject) => {
      const id = ++next;
      pending.set(id, { resolve, reject });
      send({ captain: "call", id, method, args });
    });
  const onPortMessage = (event) => {
    const { captain, id, result, error, collection } = event.data || {};
    if (captain === "result" && pending.has(id)) {
      const { resolve, reject } = pending.get(id);
      pending.delete(id);
      error === undefined ? resolve(result) : reject(new Error(error));
    } else if (captain === "dataChanged") {
      for (const listener of listeners) listener(collection);
    }
  };
  // The app can start before the Bambii page is listening (the iframe is server-rendered), so keep
  // saying hello until it answers with the port; calls queue until then.
  let hellos = 0;
  const sayHello = () => {
    if (port || ++hellos > 100) return clearInterval(helloTimer);
    parent.postMessage({ captain: "hello" }, "*");
  };
  const helloTimer = setInterval(sayHello, 100);
  addEventListener("message", (event) => {
    if (port || event.source !== parent || !event.data || event.data.captain !== "ready" || !event.ports[0]) return;
    port = event.ports[0];
    port.onmessage = onPortMessage;
    clearInterval(helloTimer);
    for (const message of queue.splice(0)) port.postMessage(message);
  });
  sayHello();
  // Links open in a new tab, so the app's own document stays in the frame. In-page links still scroll.
  addEventListener(
    "click",
    (event) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link) return;
      const target = new URL(link.href, location.href);
      if (target.origin === location.origin && target.pathname === location.pathname && target.search === location.search) return;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    },
    true,
  );
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
