/**
 * eve-side helpers shared by every bot: Vercel Connect auth providers for each
 * connector, and a wrapper that turns a revoked token into a fresh sign-in.
 */
import { connect } from "@vercel/connect/eve";
import type { ToolAuthProvider, ToolContext } from "eve/tools";
import { CONNECTORS, ConnectorAuthError } from "./connectors/index";

export const slackAuth = connect({
  connector: CONNECTORS.slack.uid,
  tokenParams: { scopes: [...CONNECTORS.slack.scopes] },
});

export const googleAuth = connect({
  connector: CONNECTORS.google.uid,
  tokenParams: { scopes: [...CONNECTORS.google.scopes] },
});

export const notionAuth = connect(CONNECTORS.notion.uid);

type TokenCtx = Pick<ToolContext, "getToken" | "requireAuth">;
type AuthProvider = ToolAuthProvider;

/** Resolve the caller's token, run `fn`, and re-prompt sign-in once if the token was rejected. */
export async function withToken<T>(
  ctx: TokenCtx,
  provider: AuthProvider,
  fn: (token: string) => Promise<T>,
): Promise<T> {
  const { token } = await ctx.getToken(provider);
  try {
    return await fn(token);
  } catch (error) {
    if (error instanceof ConnectorAuthError) ctx.requireAuth(provider);
    throw error;
  }
}
