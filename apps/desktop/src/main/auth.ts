import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { type BrowserWindow, shell } from "electron";

/**
 * Sign in through the default browser, where passkeys (Touch ID, iCloud Keychain)
 * work natively — Electron's embedded WebAuthn does not. The browser page at
 * `/desktop/sign-in` mints a one-time Clerk sign-in token and redirects it to a
 * loopback listener here (RFC 8252); this window then redeems it at `/desktop/complete`.
 */
const TIMEOUT_MS = 10 * 60 * 1000;

const page = (message: string) => `<!doctype html><meta charset="utf-8"><title>Bambii</title>
<body style="font:15px -apple-system,system-ui;display:grid;place-items:center;height:100vh;margin:0;color:#333">
<p>${message}</p>`;
const DONE_PAGE = page("You're signed in. You can close this tab and return to Bambii.");
const CLOSED_PAGE = page("Bambii's window was closed. Open Bambii and sign in again.");

let pending: Server | undefined;

export async function signInWithBrowser(window: BrowserWindow, origin: string): Promise<void> {
  pending?.close();
  const state = randomBytes(24).toString("base64url");

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const ticket = url.searchParams.get("ticket");
    if (url.pathname !== "/callback" || url.searchParams.get("state") !== state || !ticket) {
      response.writeHead(400).end("Invalid sign-in callback");
      return;
    }
    const closed = window.isDestroyed();
    // Close idle keep-alive connections too, once the page is sent, so the port is freed.
    response
      .writeHead(200, { "content-type": "text/html; charset=utf-8" })
      .end(closed ? CLOSED_PAGE : DONE_PAGE, () => server.closeAllConnections());
    server.close();
    if (closed) return;
    // In the fragment, so the token never reaches server request logs.
    void window.loadURL(`${origin}/desktop/complete#ticket=${encodeURIComponent(ticket)}`);
    if (window.isMinimized()) window.restore();
    window.focus();
  });
  pending = server;
  server.on("close", () => {
    if (pending === server) pending = undefined;
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  // Errors after listening (a bad request on a socket) mustn't crash the main process.
  server.on("error", (error) => console.error("[sign-in] loopback listener", error));
  setTimeout(() => server.close(), TIMEOUT_MS).unref();

  const { port } = server.address() as AddressInfo;
  const target = new URL("/desktop/sign-in", origin);
  target.searchParams.set("port", String(port));
  target.searchParams.set("state", state);
  try {
    await shell.openExternal(target.toString());
  } catch (error) {
    server.close();
    throw new Error("Couldn't open your browser to sign in.", { cause: error });
  }
}
