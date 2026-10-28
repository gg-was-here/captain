import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { gmail, inputs } from "../connectors/index";
import { googleAuth, withToken } from "../eve";
import { sendOnce } from "../sent-actions";
import { emailPrompt } from "./approval-prompts";

export default defineTool({
  description: "Send an email from the user's Gmail. The user approves every send. Prefer gmail_draft unless asked to send.",
  inputSchema: inputs.email,
  approval: { request: always(), prompt: ({ input }) => emailPrompt("Send this email from your Gmail?", input) },
  label: { start: ({ to }) => `Send email to ${to}` },
  // At most once per call, even if eve re-runs it after an interruption.
  execute: (input, ctx) =>
    withToken(ctx, googleAuth, (token) =>
      sendOnce(ctx.session.auth.current?.principalId ?? "", ctx.callId, "gmail_send", () => gmail.sendEmail(token, input)),
    ),
});
