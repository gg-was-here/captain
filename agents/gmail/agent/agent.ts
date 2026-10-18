import { defineAgent } from "eve";

export default defineAgent({
  description: "Gmail bot: searches, reads, triages and drafts the user's email; sends only with approval.",
  model: "anthropic/claude-sonnet-5.5",
});
