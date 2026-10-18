import { vercelOidc } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";
import type { SessionAuthContext } from "eve/context";
import { captainAuth } from "./auth";

const isCaptainUser = (context: SessionAuthContext | undefined) =>
  context?.authenticator === "captain" && context.principalType === "user";

/**
 * The HTTP channel every Captain bot exposes.
 *
 * - Browser/Electron callers authenticate as Captain users.
 * - Other bots in this deployment (Vercel OIDC, same project only) may delegate
 *   work and forward the Captain user they act for, so per-user connectors
 *   resolve that user's tokens. They may not assert any other kind of identity.
 */
export function captainChannel() {
  return eveChannel({
    auth: [captainAuth(), vercelOidc()],
    trustedForwarders: (forwarder, assertion) =>
      forwarder.principalType !== "user" &&
      forwarder.principalType !== "anonymous" &&
      assertion.principal !== undefined &&
      isCaptainUser(assertion.principal.current) &&
      isCaptainUser(assertion.principal.initiator),
  });
}
