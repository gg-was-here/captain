import { userModel } from "@captain/core/models";
import { defineAgent } from "eve";

export default defineAgent({
  description: "Builder bot: builds small apps that run on the user's Mac and can use Slack, Gmail and AI through Bambii.",
  // The user's app-building model from Settings → Models (Claude Opus 5.5 by default).
  model: userModel("builder"),
  // The DB client loads a platform-native module, which must ship as a real dependency rather than be bundled.
  build: { externalDependencies: ["@libsql/client"] },
  // eve's optional defaults include web_fetch, bash and agent with no approval, which prompt injection
  // in a Slack message or email could use to send data out. Only the tools in agent/tools are added.
  defaultTools: false,
});
