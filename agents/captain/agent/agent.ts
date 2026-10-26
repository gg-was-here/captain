import { userModel } from "@captain/core/models";
import { defineAgent } from "eve";

export default defineAgent({
  description: "Bambii, the general assistant: answers questions with live web search, works in the user's Slack, Gmail and Notion, and delegates app building to Builder.",
  // The user's default model from Settings → Models.
  model: userModel("default"),
  // The DB client (for model settings) loads a platform-native module, which must ship as a real dependency rather than be bundled.
  build: { externalDependencies: ["@libsql/client"] },
});
