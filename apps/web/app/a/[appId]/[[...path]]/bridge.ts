/**
 * `window.captain` for the web preview, injected into every built app's index.html before the app's own
 * scripts. The app runs in an opaque-origin sandbox, so every call is relayed to the Bambii page that
 * embeds it (`lib/client/app-bridge.ts`), which owns the data, the API session and the write
 * confirmations. Mirrors the desktop Space's preload bridge.
 *
 * Calls travel over a private MessagePort that the Bambii page hands to this document in answer to its
 * "hello", so a page the frame navigates to later can't use the bridge. The frame can't open windows:
 * clicked links are passed to Bambii, which shows the address before opening it.
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
  // saying hello until it answers with the port, more slowly after the first seconds; calls queue until then.
  let hellos = 0;
  let helloTimer;
  const sayHello = () => {
    if (port) return;
    parent.postMessage({ captain: "hello" }, "*");
    helloTimer = setTimeout(sayHello, ++hellos < 50 ? 100 : 1000);
  };
  addEventListener("message", (event) => {
    if (port || event.source !== parent || !event.data || event.data.captain !== "ready" || !event.ports[0]) return;
    port = event.ports[0];
    port.onmessage = onPortMessage;
    clearTimeout(helloTimer);
    for (const message of queue.splice(0)) port.postMessage(message);
  });
  sayHello();
  // Links leave through Bambii (the frame can't open windows or load other sites). In-page links still
  // scroll; other links to the app's own files would only reload it.
  addEventListener(
    "click",
    (event) => {
      const link = event
        .composedPath()
        .find((node) => node instanceof Element && node.matches("a[href], area[href], a[*|href]"));
      if (!link) return;
      const href = link.getAttribute("href") ?? link.getAttributeNS("http://www.w3.org/1999/xlink", "href") ?? "";
      let target;
      try {
        target = new URL(href, document.baseURI);
      } catch {
        return;
      }
      if (target.origin === location.origin && target.pathname === location.pathname && target.search === location.search) return;
      event.preventDefault();
      if (target.origin !== location.origin) call("open", target.href).catch(() => {});
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
