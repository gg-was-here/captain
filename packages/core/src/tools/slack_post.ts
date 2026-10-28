import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { slack, inputs } from "../connectors/index";
import { slackAuth, withToken } from "../eve";
import { sendOnce } from "../sent-actions";
import { slackPostPrompt } from "./approval-prompts";

export default defineTool({
  description: "Post a Slack message as the user, optionally as a thread reply. The user approves every post.",
  inputSchema: inputs.slackPost,
  approval: { request: always(), prompt: ({ input }) => slackPostPrompt(input) },
  label: { start: ({ channel }) => `Post to Slack ${channel}` },
  // At most once per call, even if eve re-runs it after an interruption.
  execute: (input, ctx) =>
    withToken(ctx, slackAuth, (token) =>
      sendOnce(ctx.session.auth.current?.principalId ?? "", ctx.callId, "slack_post", () => slack.postMessage(token, input)),
    ),
});
