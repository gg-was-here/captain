import { defineAgent } from "eve";

export default defineAgent({
  description: "Gmail bot: searches, reads, triages and drafts the user's email; sends only with approval.",
  model: "nvidia/nemotron-3.5-lightning-free",
});
