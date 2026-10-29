import { roleModel } from "@captain/core/models";
import { defineAgent } from "eve";

export default defineAgent({
  description: "The assistant for one user-built Bambii app: answers questions and edits its on-device data.",
  // The chat model (`CAPTAIN_CHAT_MODEL`, Claude Haiku 5.5 by default).
  model: roleModel("default"),
  // The DB client loads a platform-native module, which must ship as a real dependency rather than be bundled.
  build: { externalDependencies: ["@libsql/client"] },
  // eve's optional defaults include web_fetch, bash and agent with no approval, which prompt injection
  // in a Slack message or email could use to send data out. Only the tools in agent/tools are added.
  defaultTools: false,
  // Chats last until the user deletes them: no 30-day session timeout. A session's stored conversation is
  // deleted when it ends (thread or account deletion resets it), not kept for a retention period.
  limits: { sessionTimeoutMs: false },
  experimental: { workflow: { retention: 0 } },
});
