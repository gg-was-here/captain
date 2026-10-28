import { defineTool } from "eve/tools";
import { gmail, inputs } from "../connectors/index";
import { googleAuth, withToken } from "../eve";

export default defineTool({
  description:
    "Search the user's Gmail. Uses Gmail search syntax: `from:`, `to:`, `subject:`, `is:unread`, `newer_than:7d`, `label:`, `has:attachment`.",
  inputSchema: inputs.gmailSearch,
  label: { start: ({ query }) => `Search Gmail for “${query}”` },
  execute: (input, ctx) => withToken(ctx, googleAuth, (token) => gmail.searchEmail(token, input)),
});
