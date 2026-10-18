import { defineTool } from "eve/tools";
import { z } from "zod";
import { slack } from "../connectors/index";
import { slackAuth, withToken } from "../eve";

export default defineTool({
  description:
    "Read recent messages in a Slack channel by channel id. `oldest` is a Unix timestamp string to only return newer messages.",
  inputSchema: z.object({
    channel: z.string().describe("Channel id, e.g. C0123456"),
    limit: z.number().int().min(1).max(200).optional(),
    oldest: z.string().optional(),
  }),
  label: { start: ({ channel }) => `Read Slack channel ${channel}` },
  execute: (input, ctx) => withToken(ctx, slackAuth, (token) => slack.channelHistory(token, input)),
});
