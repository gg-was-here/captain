import { defineAgent } from "eve";
import { anthropic } from "eve/models/anthropic";

export default defineAgent({
  description: "The assistant for one user-built Captain app: answers questions and edits its on-device data.",
  model: anthropic("claude-haiku-5-5"),
  // The DB client loads a platform-native module, which must ship as a real dependency rather than be bundled.
  build: { externalDependencies: ["@libsql/client"] },
});
