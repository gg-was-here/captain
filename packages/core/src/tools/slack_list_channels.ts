import { defineTool } from "eve/tools";
import { slack, inputs } from "../connectors/index";
import { slackAuth, withToken } from "../eve";

export default defineTool({
  description: "List the Slack channels, group DMs and DMs the user belongs to (id, name, topic).",
  inputSchema: inputs.slackListChannels,
  label: { start: () => "List Slack channels" },
  execute: (_input, ctx) => withToken(ctx, slackAuth, (token) => slack.listChannels(token)),
});
