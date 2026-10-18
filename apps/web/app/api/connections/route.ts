import { CONNECTOR_NAMES, CONNECTORS } from "@captain/core/connectors";
import { connectionStatus } from "@/lib/server/connect";
import { requireUser, route } from "@/lib/server/user";

export const GET = route(async (request: Request) => {
  const user = await requireUser(request);
  const connections = await Promise.all(
    CONNECTOR_NAMES.map(async (name) => ({
      name,
      label: CONNECTORS[name].label,
      status: await connectionStatus(user, name),
    })),
  );
  return Response.json({ connections });
});
