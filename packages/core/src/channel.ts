import { type AuthFn, ForbiddenError, vercelOidc } from "eve/channels/auth";
import { eveChannel, type TrustedForwarders } from "eve/channels/eve";
import type { SessionAuthContext } from "eve/context";
import { captainAuth, clerkConfigured } from "./auth";
import { mayUseSession } from "./session-owners";
import { consumeUsage, UsageLimitError } from "./usage";

const isCaptainUser = (context: SessionAuthContext | undefined) =>
  context?.authenticator === "captain" &&
  context.principalType === "user" &&
  // With Clerk configured, only Clerk-verified users; "local" users exist only in local dev.
  (!clerkConfigured() || context.issuer === "clerk");

/** The session a request addresses (`/v1/session/:id`, its sub-routes and subagent streams), if any. */
export function sessionIdOf(request: Request): string | undefined {
  const id = new URL(request.url).pathname.match(/\/v1\/session\/([^/]+)/)?.[1];
  return id === undefined ? undefined : decodeURIComponent(id);
}

/** The bot a request is for, from its `/eve/<agent>/v1/...` path. */
const agentOf = (request: Request) => new URL(request.url).pathname.match(/\/eve\/([^/]+)\/v1\//)?.[1];

/**
 * Cookie-authenticated writes must come from Bambii's own pages. Browsers attach cookies to some
 * cross-site requests (for example from a page that frames Bambii), and eve parses the body as JSON
 * whatever its declared type, so refuse cross-site requests and non-JSON bodies. A bodyless POST (a
 * prewarm) has no content type. Bearer callers (other bots) aren't affected.
 */
export function isCrossSiteWrite(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD" || request.headers.has("authorization")) return false;
  if (request.headers.get("sec-fetch-site") === "cross-site") return true;
  const type = request.headers.get("content-type");
  return type !== null && !type.toLowerCase().startsWith("application/json");
}

/** Session create/follow-up requests that carry a user message (not prewarm, approvals or stream reads). */
async function sendsMessage(request: Request) {
  if (request.method !== "POST" || !/\/v1\/session(\/[^/]+)?$/.test(new URL(request.url).pathname)) return false;
  const body = await request
    .clone()
    .json()
    .catch(() => null);
  return body?.message !== undefined;
}

/**
 * Captain user auth for browser and Mac app requests. A request for an existing session must come from
 * the user who started it, and each message counts against the user's daily limit.
 */
function captainUserAuth(): AuthFn<Request> {
  const auth = captainAuth();
  return async (request) => {
    const result = await auth(request);
    if (!result) return null;
    if (isCrossSiteWrite(request)) throw new ForbiddenError({ message: "Requests from other sites aren't allowed." });
    // The compiled agent configuration (tools, instructions) is for operators, not users.
    if (clerkConfigured() && request.method === "GET" && /\/v1\/info$/.test(new URL(request.url).pathname)) {
      throw new ForbiddenError({ message: "Not available." });
    }
    const sessionId = sessionIdOf(request);
    if (sessionId !== undefined && !(await mayUseSession(result.principalId, sessionId, agentOf(request)))) {
      throw new ForbiddenError({ message: "This chat belongs to another account." });
    }
    if (await sendsMessage(request)) {
      try {
        await consumeUsage(result.principalId, "messages");
      } catch (error) {
        if (error instanceof UsageLimitError) throw new ForbiddenError({ message: error.message });
        throw error;
      }
    }
    return result;
  };
}

/**
 * Vercel OIDC, limited to this deployment's own runtime (Captain delegating to Builder). Tokens from the
 * same project's other environments (preview deployments, `vercel env pull`) authenticate as "service"
 * principals; refusing them keeps them from acting for production users.
 */
function runtimeOidc(): AuthFn<Request> {
  const auth = vercelOidc();
  return async (request) => {
    const result = await auth(request);
    return result?.principalType === "runtime" ? result : null;
  };
}

/**
 * Who may forward a Captain user to a bot (and pass parent session lineage, which Builder uses to link a
 * delegated app to the Captain thread):
 * - this deployment's own runtime, forwarding Clerk-verified Captain users only;
 * - in local dev without Clerk, the single local user, because peer bots call each other over plain
 *   HTTP there (see peers.ts) and subagents need to see their parent session.
 */
export const trustedForwarders: TrustedForwarders = (forwarder, assertion) =>
  (forwarder.authenticator === "captain" && forwarder.issuer === "local" && !clerkConfigured()) ||
  (forwarder.principalType === "runtime" &&
    assertion.principal !== undefined &&
    isCaptainUser(assertion.principal.current) &&
    isCaptainUser(assertion.principal.initiator));

/** The HTTP channel every Captain bot exposes. */
export function captainChannel() {
  return eveChannel({ auth: [captainUserAuth(), runtimeOidc()], trustedForwarders });
}
