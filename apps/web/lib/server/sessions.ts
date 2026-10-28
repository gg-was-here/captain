import "server-only";
import { getVercelOidcToken } from "@vercel/oidc";
import { Client, type TranscriptMessage, transcriptReducer } from "eve/client";

export const AGENTS = ["captain", "builder", "app-bot"] as const;

const isAgent = (agent: string) => (AGENTS as readonly string[]).includes(agent);

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
 * An eve client for one bot, acting as this deployment. On Vercel that's its OIDC token, which the bots'
 * channel trusts for any session; eve also sends it as Vercel's trusted-OIDC header, which gets past
 * deployment protection on previews. In local dev, where there's no deployment identity, the user's own
 * cookie. Redirects are refused so the credentials can't be forwarded elsewhere.
 */
function botClient(requestOrigin: string, agent: string, cookie?: string): Client {
  return new Client({
    host: new URL(`/eve/${agent}`, botsOrigin(requestOrigin)).toString(),
    redirect: "error",
    ...(process.env.VERCEL
      ? { auth: { vercelOidc: { token: () => getVercelOidcToken() } } }
      : cookie
        ? { headers: { cookie } }
        : {}),
  });
}

/**
 * Ends a chat's eve session. Bots keep no conversation once a session ends (they use zero retention), and
 * a Builder session's sandbox goes with it; run metadata such as the session's title stays in Vercel
 * Workflow for its retention period. Ending a session that has already ended (or expired) succeeds.
 */
export async function endSession(requestOrigin: string, agent: string, sessionId: string, cookie?: string): Promise<void> {
  if (!isAgent(agent)) return;
  await botClient(requestOrigin, agent, cookie)
    .sessions.attach(sessionId)
    .reset({ signal: AbortSignal.timeout(15_000) });
}

/**
 * A session's conversation as text (no tool calls or results), oldest first, and whether the session has
 * ended. Reads what's recorded so far without following the stream.
 */
export async function readTranscript(
  requestOrigin: string,
  agent: string,
  sessionId: string,
): Promise<{ messages: TranscriptMessage[]; ended: boolean }> {
  if (!isAgent(agent)) return { messages: [], ended: true };
  const reducer = transcriptReducer();
  let transcript = reducer.initial();
  let ended = false;
  const stream = botClient(requestOrigin, agent)
    .sessions.attach(sessionId)
    .stream({ follow: false, signal: AbortSignal.timeout(30_000) });
  try {
    for await (const event of stream) {
      transcript = reducer.reduce(transcript, event);
      if (event.type === "session.completed" || event.type === "session.failed") ended = true;
    }
  } catch (error) {
    // An ended session's history is gone (zero retention): nothing more to read.
    if ((error as { code?: unknown }).code === "session_expired") return { messages: [], ended: true };
    throw error;
  }
  return { messages: [...transcript.messages], ended };
}
