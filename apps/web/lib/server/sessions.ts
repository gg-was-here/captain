import "server-only";
import { getVercelOidcToken } from "@vercel/oidc";

const AGENTS = new Set(["captain", "builder", "app-bot"]);

/**
 * Where the bots are served. On Vercel it comes from the environment, never from the request, because the
 * call carries this deployment's identity (eve's workspace transport follows the same rule). Locally it's
 * the origin the browser used.
 */
function botsOrigin(requestOrigin: string): string {
  if (!process.env.VERCEL) return requestOrigin;
  const host = process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : process.env.VERCEL_URL;
  if (!host) throw new Error("VERCEL_URL isn't set, so the bots can't be reached");
  return `https://${host}`;
}

/**
 * Ends a chat's eve session. Bots keep no copy once a session ends (they use zero retention), so this
 * deletes the conversation itself, and a Builder session's sandbox. On Vercel the web app calls the bot as
 * this deployment (Vercel OIDC), which the bots' channel trusts for any session; in local dev, where
 * there's no deployment identity, it passes the user's own cookie. Ending a session that has already
 * ended (or expired) succeeds.
 */
export async function endSession(requestOrigin: string, agent: string, sessionId: string, cookie?: string): Promise<void> {
  if (!AGENTS.has(agent)) return;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.VERCEL) headers.authorization = `Bearer ${await getVercelOidcToken()}`;
  else if (cookie) headers.cookie = cookie;
  const url = new URL(`/eve/${agent}/v1/session/${encodeURIComponent(sessionId)}/reset`, botsOrigin(requestOrigin));
  const response = await fetch(url, { method: "POST", headers, body: "{}", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Couldn't end ${agent} session ${sessionId}: HTTP ${response.status}`);
}
