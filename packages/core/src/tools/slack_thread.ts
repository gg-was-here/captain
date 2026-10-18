import { defineTool } from "eve/tools";
import { z } from "zod";
import { slack } from "../connectors/index";
import { slackAuth, withToken } from "../eve";

export default defineTool({
  description: "Read every reply in a Slack thread.",
  inputSchema: z.object({ channel: z.string(), ts: z.string().describe("Parent message ts") }),
  label: { start: () => "Read Slack thread" },
  execute: (input, ctx) => withToken(ctx, slackAuth, (token) => slack.threadReplies(token, input)),
});
