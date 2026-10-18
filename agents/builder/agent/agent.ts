import { defineAgent } from "eve";

export default defineAgent({
  description: "Builder bot: builds small apps that run on the user's Mac and can use Slack, Gmail and AI through Captain.",
  model: "anthropic/claude-opus-5.5",
});
