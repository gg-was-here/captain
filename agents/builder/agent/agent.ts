import { roleModel } from "@captain/core/models";
import { defineAgent } from "eve";

export default defineAgent({
  description: "Builder bot: builds small apps that run on the user's Mac and can use Slack, Gmail and AI through Bambii.",
  // The app-building model (`CAPTAIN_BUILDER_MODEL`, Claude Sonnet 5.5 by default).
  model: roleModel("builder"),
  // The DB client loads a platform-native module, which must ship as a real dependency rather than be bundled.
  build: { externalDependencies: ["@libsql/client"] },
  // eve's optional defaults include web_fetch, bash and agent with no approval, which prompt injection
  // in a Slack message or email could use to send data out. Only the tools in agent/tools are added.
  defaultTools: false,
  // Builder sessions keep eve's 30-day timeout (a later "Edit app" reopens the app with open_app). Their
  // stored conversation is deleted when the session ends rather than kept for a retention period.
  experimental: { workflow: { retention: 0 } },
});
