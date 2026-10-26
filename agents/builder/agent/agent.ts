import { userModel } from "@captain/core/models";
import { defineAgent } from "eve";

export default defineAgent({
  description: "Builder bot: builds small apps that run on the user's Mac and can use Slack, Gmail and AI through Bambii.",
  // The user's app-building model from Settings → Models (Claude Opus 5.5 by default).
  model: userModel("builder"),
  // The DB client loads a platform-native module, which must ship as a real dependency rather than be bundled.
  build: { externalDependencies: ["@libsql/client"] },
});
