import { defineAgent } from "eve";

export default defineAgent({
  description: "Slack bot: searches, reads and summarizes the user's Slack workspace, and posts messages with approval.",
  model: "nvidia/nemotron-3.5-lightning-free",
});
