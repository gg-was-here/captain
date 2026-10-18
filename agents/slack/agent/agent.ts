import { defineAgent } from "eve";

export default defineAgent({
  description: "Slack bot: searches, reads and summarizes the user's Slack workspace, and posts messages with approval.",
  model: "anthropic/claude-sonnet-5.5",
});
