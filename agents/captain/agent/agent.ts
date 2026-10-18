import { defineAgent } from "eve";

export default defineAgent({
  description: "Captain, the general assistant: answers questions with live web search and delegates to the Slack, Gmail, Notion and Builder bots.",
  model: "nvidia/nemotron-3.5-lightning-free",
});
