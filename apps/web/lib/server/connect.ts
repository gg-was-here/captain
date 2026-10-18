import "server-only";
import { type CaptainUser, connectSubject } from "@captain/core/auth";
import { CONNECTORS, type ConnectorName } from "@captain/core/connectors";
import {
  getToken,
  revokeToken,
  startAuthorization,
  ConnectorInstallationRequiredError,
  NoValidTokenError,
  UserAuthorizationRequiredError,
} from "@vercel/connect";

const needsAuth = (error: unknown) =>
  error instanceof UserAuthorizationRequiredError ||
  error instanceof NoValidTokenError ||
  error instanceof ConnectorInstallationRequiredError;

const params = (user: CaptainUser, name: ConnectorName) => ({
  subject: connectSubject(user),
  scopes: CONNECTORS[name].scopes.length ? [...CONNECTORS[name].scopes] : undefined,
});

/** The user's token for a connector, or null if they haven't connected it yet. */
export async function userToken(user: CaptainUser, name: ConnectorName): Promise<string | null> {
  try {
    return await getToken(CONNECTORS[name].uid, params(user, name));
  } catch (error) {
    if (needsAuth(error)) return null;
    throw error;
  }
}

export type ConnectionStatus = "connected" | "disconnected" | "unavailable";

export async function connectionStatus(user: CaptainUser, name: ConnectorName): Promise<ConnectionStatus> {
  try {
    return (await userToken(user, name)) ? "connected" : "disconnected";
  } catch {
    // Connector not registered yet, or no Vercel OIDC credentials locally.
    return "unavailable";
  }
}

export async function authorizationUrl(user: CaptainUser, name: ConnectorName, callbackUrl: string) {
  const { url } = await startAuthorization(CONNECTORS[name].uid, params(user, name), { callbackUrl });
  return url;
}

export async function disconnect(user: CaptainUser, name: ConnectorName) {
  await revokeToken(CONNECTORS[name].uid, { subject: connectSubject(user) });
}
