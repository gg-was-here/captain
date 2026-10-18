import { defineAgent } from "eve";
import { anthropic } from "eve/models/anthropic";

export default defineAgent({
  description: "Captain, the general assistant: answers questions with live web search, works in the user's Slack, Gmail and Notion, and delegates app building to Builder.",
  model: anthropic("claude-haiku-5-5"),
});
