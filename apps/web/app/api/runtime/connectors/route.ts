import { APP_ACTIONS, type AppActionConnector, ConnectorAuthError } from "@captain/core/connectors";
import { emailPrompt, slackPostPrompt } from "@captain/core/tools/approval-prompts";
import { consumeRate, consumeUsage } from "@captain/core/usage";
import { z } from "zod";
import { userToken } from "@/lib/server/connect";
import { requireApp } from "@/lib/server/data";
import { HttpError, readJson, requireUser, route } from "@/lib/server/user";

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
  const { appId, connector, action, input } = body.parse(await readJson(request));
  const app = await requireApp(user.id, appId);
  // A runaway app loop could otherwise exhaust the user's Slack or Google API quota.
  await consumeRate(user.id, "connector");
  await consumeUsage(user.id, "connector");

  if (!app.connectors.includes(connector)) {
    throw new HttpError(403, `${app.name} is not allowed to use ${connector}`);
  }
  const actions = APP_ACTIONS[connector as AppActionConnector] as
    | Record<string, { write: boolean; input: z.ZodType; run: (token: string, input: never) => Promise<unknown> }>
    | undefined;
  const spec = actions && Object.hasOwn(actions, action) ? actions[action] : undefined;
  if (!spec) throw new HttpError(400, `Unknown action ${connector}.${action}`);
  const result = spec.input.safeParse(input);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`);
    throw new HttpError(400, `Invalid input for ${connector}.${action}. ${problems.join("; ")}`);
  }
  const parsed = result.data as Record<string, unknown>;

  if (spec.write && request.headers.get("x-captain-confirmed") !== "1") {
    return Response.json(
      {
        needsConfirmation: true,
        summary: `${app.name} wants to ${action.replace(/([A-Z])/g, " $1").toLowerCase()} via ${connector}`,
        text: confirmationText(connector, action, parsed),
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

/** Every field of a write action, laid out for the user to confirm; text past 4,000 characters is cut, visibly. */
function confirmationText(connector: string, action: string, input: Record<string, unknown>) {
  if (connector === "slack" && action === "postMessage") {
    return slackPostPrompt(input as Parameters<typeof slackPostPrompt>[0], 4000);
  }
  if (connector === "google" && (action === "sendEmail" || action === "createDraft")) {
    const question = action === "sendEmail" ? "Send this email from your Gmail?" : "Save this email as a draft in your Gmail?";
    return emailPrompt(question, input as Parameters<typeof emailPrompt>[1], 4000);
  }
  return JSON.stringify(input, null, 2);
}
