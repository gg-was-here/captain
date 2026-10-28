import { defineTool } from "eve/tools";
import { gmail, inputs } from "../connectors/index";
import { googleAuth, withToken } from "../eve";

export default defineTool({
  description:
    "Search the user's Gmail. Uses Gmail search syntax: `from:`, `to:`, `subject:`, `is:unread`, `newer_than:7d`, `label:`, `has:attachment`.",
  inputSchema: inputs.gmailSearch,
  label: { start: ({ query }) => `Search Gmail for “${query}”` },
  execute: (input, ctx) =>
    withToken(ctx, googleAuth, async (token) => {
      const { emails, failed } = await gmail.searchEmailReport(token, input);
      // Say so when some matches couldn't be loaded, so the answer isn't presented as complete.
      return failed > 0
        ? { emails, incomplete: `${failed} matching email${failed === 1 ? "" : "s"} couldn't be loaded and aren't listed.` }
        : emails;
    }),
});
