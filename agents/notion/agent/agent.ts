import { defineAgent } from "eve";

export default defineAgent({
  description: "Notion bot: finds, reads, creates and edits the user's Notion pages and databases.",
  model: "anthropic/claude-sonnet-5.5",
});
