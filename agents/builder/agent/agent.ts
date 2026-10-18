import { defineAgent } from "eve";
import { anthropic } from "eve/models/anthropic";

export default defineAgent({
  description: "Builder bot: builds small apps that run on the user's Mac and can use Slack, Gmail and AI through Captain.",
  model: anthropic("claude-haiku-5-5"),
  // The DB client loads a platform-native module, which must ship as a real dependency rather than be bundled.
  build: { externalDependencies: ["@libsql/client"] },
});
