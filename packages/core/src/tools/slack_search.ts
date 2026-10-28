import { defineTool } from "eve/tools";
import { slack, inputs } from "../connectors/index";
import { slackAuth, withToken } from "../eve";

export default defineTool({
  description:
    "Search the user's Slack messages. Supports Slack search syntax: `in:#channel`, `from:@name`, `after:YYYY-MM-DD`, `has:link`, `is:thread`.",
  inputSchema: inputs.slackSearch,
  label: { start: ({ query }) => `Search Slack for “${query}”` },
  execute: (input, ctx) => withToken(ctx, slackAuth, (token) => slack.searchMessages(token, input)),
});
