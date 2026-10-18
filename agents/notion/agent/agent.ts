import { defineAgent } from "eve";

export default defineAgent({
  description: "Notion bot: finds, reads, creates and edits the user's Notion pages and databases.",
  model: "nvidia/nemotron-3.5-lightning-free",
});
