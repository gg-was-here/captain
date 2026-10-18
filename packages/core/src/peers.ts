import { defineWorkspaceAgent } from "eve";

/**
 * Another Captain bot exposed as a subagent.
 *
 * On Vercel, eve's built-in workspace transport authenticates with the
 * deployment's OIDC token and forwards the Captain user, so the peer resolves
 * that user's connector tokens. In local `next dev` there is no workspace
 * transport, so calls go through the web origin's `/eve/<name>` mount, where
 * dev auth already resolves to the single local user.
 */
export function peerBot(name: string) {
  if (process.env.VERCEL) return defineWorkspaceAgent({ name, forwardPrincipal: true });
  const origin = process.env.CAPTAIN_DEV_ORIGIN ?? "http://localhost:3000";
  return defineWorkspaceAgent({ name, transport: { url: () => `${origin}/eve/${name}` } });
}
