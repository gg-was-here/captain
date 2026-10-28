import { defineTool } from "eve/tools";
import { gmail, inputs } from "../connectors/index";
import { googleAuth, withToken } from "../eve";
import { sendOnce } from "../sent-actions";

export default defineTool({
  description: "Save an email draft in the user's Gmail (does not send). Pass threadId to draft a reply.",
  inputSchema: inputs.email,
  label: { start: ({ to }) => `Draft email to ${to}` },
  // At most once per call, even if eve re-runs it after an interruption.
  execute: (input, ctx) =>
    withToken(ctx, googleAuth, (token) =>
      sendOnce(ctx.session.auth.current?.principalId ?? "", ctx.callId, "gmail_draft", () => gmail.createDraft(token, input)),
    ),
});
