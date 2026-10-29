import { type AuthFn, ForbiddenError, vercelOidc } from "eve/channels/auth";
import { eveChannel, type TrustedForwarders } from "eve/channels/eve";
import type { SessionAuthContext } from "eve/context";
import { captainAuth, clerkConfigured } from "./auth";
import { mayUseSession } from "./session-owners";
import { assertWithinBudget, consumeUsage, UsageLimitError } from "./usage";

const isCaptainUser = (context: SessionAuthContext | undefined) =>
  context?.authenticator === "captain" &&
  context.principalType === "user" &&
  // With Clerk configured, only Clerk-verified users; "local" users exist only in local dev.
  (!clerkConfigured() || context.issuer === "clerk");

/**
 * The request path as eve's router sees it: it ignores repeated and trailing slashes, so every check
 * here must too (`/v1/session/` is the create route).
 */
export const routePath = (request: Request) =>
  new URL(request.url).pathname.replace(/\/{2,}/g, "/").replace(/(.)\/+$/, "$1");

/** The session a request addresses (`/v1/session/:id`, its sub-routes and subagent streams), if any. */
export function sessionIdOf(request: Request): string | undefined {
  const id = routePath(request).match(/\/v1\/session\/([^/]+)/)?.[1];
  return id === undefined ? undefined : decodeURIComponent(id);
}

/** The bot a request is for, from its `/eve/<agent>/v1/...` path. */
const agentOf = (request: Request) => routePath(request).match(/\/eve\/([^/]+)\/v1\//)?.[1];

/**
 * Cookie-authenticated writes must come from Bambii's own pages. Browsers attach cookies to some
 * cross-site requests (for example from a page that frames Bambii), and eve parses the body as JSON
 * whatever its declared type, so refuse cross-site requests and non-JSON bodies. A bodyless POST (a
 * prewarm) has no content type. Bearer callers (other bots) aren't affected.
 */
export function isCrossSiteWrite(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD") return false;
  if (request.headers.get("authorization")?.toLowerCase().startsWith("bearer ")) return false;
  if (request.headers.get("sec-fetch-site") === "cross-site") return true;
  const type = request.headers.get("content-type");
  return type !== null && !type.toLowerCase().startsWith("application/json");
}

/**
 * What a POST asks the bot to do with the model: a user message (create or follow-up), answers to open
 * prompts (which resume the turn), or a compaction. Undefined for prewarms, stream reads and controls.
 */
export async function modelWork(request: Request): Promise<"message" | "answers" | "compact" | undefined> {
  if (request.method !== "POST") return undefined;
  const path = routePath(request);
  if (/\/v1\/session\/[^/]+\/compact$/.test(path)) return "compact";
  if (!/\/v1\/session(\/[^/]+)?$/.test(path)) return undefined;
  const body = await request
    .clone()
    .json()
    .catch(() => null);
  if (body?.message !== undefined) return "message";
  if (body?.inputResponses !== undefined) return "answers";
  return undefined;
}

/**
 * Captain user auth for browser and Mac app requests. A request for an existing session must come from
 * the user who started it. Anything that runs the model needs AI budget left (spend is counted
 * by the `usage-meter` hook), and each message counts against the daily message limit.
 */
function captainUserAuth(): AuthFn<Request> {
  const auth = captainAuth();
  return async (request) => {
    const result = await auth(request);
    if (!result) return null;
    if (isCrossSiteWrite(request)) throw new ForbiddenError({ message: "Requests from other sites aren't allowed." });
    // The compiled agent configuration (tools, instructions) is for operators, not users.
    if (clerkConfigured() && (request.method === "GET" || request.method === "HEAD") && routePath(request).endsWith("/v1/info")) {
      throw new ForbiddenError({ message: "Not available." });
    }
    const sessionId = sessionIdOf(request);
    if (sessionId !== undefined && !(await mayUseSession(result.principalId, sessionId, agentOf(request)))) {
      throw new ForbiddenError({ message: "This chat belongs to another account." });
    }
    const work = await modelWork(request);
    if (work) {
      try {
        await assertWithinBudget(result.principalId);
        if (work === "message") await consumeUsage(result.principalId, "messages");
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
