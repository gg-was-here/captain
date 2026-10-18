import { defineAgent } from "eve";

export default defineAgent({
  description: "The assistant for one user-built Captain app: answers questions and edits its on-device data.",
  model: "nvidia/nemotron-3.5-lightning-free",
});
