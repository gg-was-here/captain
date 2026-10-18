import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { gmail } from "../connectors/index";
import { googleAuth, withToken } from "../eve";

export default defineTool({
  description: "Send an email from the user's Gmail. The user approves every send. Prefer gmail_draft unless asked to send.",
  inputSchema: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
    threadId: z.string().optional(),
  }),
  approval: always(),
  label: { start: ({ to }) => `Send email to ${to}` },
  execute: (input, ctx) => withToken(ctx, googleAuth, (token) => gmail.sendEmail(token, input)),
});
