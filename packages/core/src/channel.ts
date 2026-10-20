import { type AuthFn, ForbiddenError, vercelOidc } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";
import type { SessionAuthContext } from "eve/context";
import { captainAuth } from "./auth";
import { consumeUsage, UsageLimitError } from "./usage";

const isCaptainUser = (context: SessionAuthContext | undefined) =>
  context?.authenticator === "captain" && context.principalType === "user";

/** Session create/follow-up requests that carry a user message (not prewarm, approvals or stream reads). */
async function sendsMessage(request: Request) {
  if (request.method !== "POST" || !/\/v1\/session(\/[^/]+)?$/.test(new URL(request.url).pathname)) return false;
  const body = await request
    .clone()
    .json()
    .catch(() => null);
  return body?.message !== undefined;
}

/** Captain user auth that also counts each message against the user's daily limit. */
function meteredCaptainAuth(): AuthFn<Request> {
  const auth = captainAuth();
  return async (request) => {
    const result = await auth(request);
    if (result && (await sendsMessage(request))) {
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
 * The HTTP channel every Captain bot exposes.
 *
 * - Browser/Electron callers authenticate as Captain users, and each message
 *   they send counts against their daily limit.
 * - Other bots in this deployment (Vercel OIDC, same project only) may delegate
 *   work and forward the Captain user they act for, so per-user connectors
 *   resolve that user's tokens. They may not assert any other kind of identity.
 */
export function captainChannel() {
  return eveChannel({
    auth: [meteredCaptainAuth(), vercelOidc()],
    trustedForwarders: (forwarder, assertion) =>
      forwarder.principalType !== "user" &&
      forwarder.principalType !== "anonymous" &&
      assertion.principal !== undefined &&
      isCaptainUser(assertion.principal.current) &&
      isCaptainUser(assertion.principal.initiator),
  });
}
