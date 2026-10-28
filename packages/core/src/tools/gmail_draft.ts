import { defineTool } from "eve/tools";
import { gmail, inputs } from "../connectors/index";
import { googleAuth, withToken } from "../eve";

export default defineTool({
  description: "Save an email draft in the user's Gmail (does not send). Pass threadId to draft a reply.",
  inputSchema: inputs.email,
  label: { start: ({ to }) => `Draft email to ${to}` },
  execute: (input, ctx) => withToken(ctx, googleAuth, (token) => gmail.createDraft(token, input)),
});
