import { defineTool } from "eve/tools";
import { slack, inputs } from "../connectors/index";
import { slackAuth, withToken } from "../eve";

export default defineTool({
  description:
    "Read recent messages in a Slack channel by channel id. `oldest` is a Unix timestamp string to only return newer messages.",
  inputSchema: inputs.slackChannelHistory,
  label: { start: ({ channel }) => `Read Slack channel ${channel}` },
  execute: (input, ctx) => withToken(ctx, slackAuth, (token) => slack.channelHistory(token, input)),
});
