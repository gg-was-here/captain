import { APP_ACTIONS, type AppActionConnector, ConnectorAuthError } from "@captain/core/connectors";
import { z } from "zod";
import { userToken } from "@/lib/server/connect";
import { requireApp } from "@/lib/server/data";
import { HttpError, requireUser, route } from "@/lib/server/user";

const body = z.object({
  appId: z.string(),
  connector: z.string(),
  action: z.string(),
  input: z.record(z.string(), z.unknown()).default({}),
});

/**
 * `captain.connectors.call()` for apps the user built. The app may only use
 * connectors it declared, and write actions need explicit user confirmation:
 * the first call returns 409 with a summary; the client asks the user and
 * retries with `x-captain-confirmed: 1`. Apps never call this directly — only
 * trusted Captain code does (the desktop main process, or the web page via
 * `lib/client/app-bridge.ts`), since the app itself has no Captain session.
 */
export const POST = route(async (request: Request) => {
  const user = await requireUser(request);
  const { appId, connector, action, input } = body.parse(await request.json());
  const app = await requireApp(user.id, appId);

  if (!app.connectors.includes(connector)) {
    throw new HttpError(403, `${app.name} is not allowed to use ${connector}`);
  }
  const actions = APP_ACTIONS[connector as AppActionConnector] as
    | Record<string, { write: boolean; input: z.ZodType; run: (token: string, input: never) => Promise<unknown> }>
    | undefined;
  const spec = actions && Object.hasOwn(actions, action) ? actions[action] : undefined;
  if (!spec) throw new HttpError(400, `Unknown action ${connector}.${action}`);
  const parsed = spec.input.parse(input);

  if (spec.write && request.headers.get("x-captain-confirmed") !== "1") {
    return Response.json(
      {
        needsConfirmation: true,
        summary: `${app.name} wants to ${action.replace(/([A-Z])/g, " $1").toLowerCase()} via ${connector}`,
        details: parsed,
      },
      { status: 409 },
    );
  }

  const token = await userToken(user, connector as AppActionConnector);
  if (!token) throw new HttpError(412, `Connect ${connector} in Bambii → Settings → Connections`);
  try {
    return Response.json({ result: await spec.run(token, parsed as never) });
  } catch (error) {
    if (error instanceof ConnectorAuthError) {
      throw new HttpError(412, `Reconnect ${connector} in Bambii → Settings → Connections`);
    }
    throw error;
  }
});
