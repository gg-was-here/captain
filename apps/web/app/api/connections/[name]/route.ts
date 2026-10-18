import { CONNECTOR_NAMES, type ConnectorName } from "@captain/core/connectors";
import { authorizationUrl, disconnect } from "@/lib/server/connect";
import { HttpError, requireUser, route } from "@/lib/server/user";

type Params = { params: Promise<{ name: string }> };

async function connectorName(params: Params["params"]): Promise<ConnectorName> {
  const { name } = await params;
  if (!CONNECTOR_NAMES.includes(name as ConnectorName)) throw new HttpError(404, "Unknown connector");
  return name as ConnectorName;
}

/** Start OAuth: returns the provider consent URL. The user lands back on /settings when done. */
export const POST = route(async (request: Request, { params }: Params) => {
  const user = await requireUser(request);
  const name = await connectorName(params);
  const callbackUrl = new URL("/settings?connected=" + name, request.url).toString();
  return Response.json({ url: await authorizationUrl(user, name, callbackUrl) });
});

export const DELETE = route(async (request: Request, { params }: Params) => {
  const user = await requireUser(request);
  await disconnect(user, await connectorName(params));
  return new Response(null, { status: 204 });
});
