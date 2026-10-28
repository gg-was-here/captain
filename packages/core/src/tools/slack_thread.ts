import { defineTool } from "eve/tools";
import { slack, inputs } from "../connectors/index";
import { slackAuth, withToken } from "../eve";

export default defineTool({
  description: "Read every reply in a Slack thread.",
  inputSchema: inputs.slackThread,
  label: { start: () => "Read Slack thread" },
  execute: (input, ctx) => withToken(ctx, slackAuth, (token) => slack.threadReplies(token, input)),
});
