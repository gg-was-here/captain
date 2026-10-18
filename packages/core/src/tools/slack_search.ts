import { defineTool } from "eve/tools";
import { z } from "zod";
import { slack } from "../connectors/index";
import { slackAuth, withToken } from "../eve";

export default defineTool({
  description:
    "Search the user's Slack messages. Supports Slack search syntax: `in:#channel`, `from:@name`, `after:2026-10-01`, `has:link`, `is:thread`.",
  inputSchema: z.object({
    query: z.string().min(1),
    count: z.number().int().min(1).max(100).optional(),
  }),
  label: { start: ({ query }) => `Search Slack for “${query}”` },
  execute: (input, ctx) => withToken(ctx, slackAuth, (token) => slack.searchMessages(token, input)),
});
