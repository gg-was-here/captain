import { userModel } from "@captain/core/models";
import { defineAgent } from "eve";

export default defineAgent({
  description: "Bambii, the general assistant: answers questions with live web search, works in the user's Slack, Gmail and Notion, and delegates app building to Builder.",
  // The user's default model from Settings → Models.
  model: userModel("default"),
  // The DB client (for model settings) loads a platform-native module, which must ship as a real dependency rather than be bundled.
  build: { externalDependencies: ["@libsql/client"] },
  // eve's optional defaults include web_fetch, bash and agent with no approval, which prompt injection
  // in a Slack message or email could use to send data out. Only the tools in agent/tools are added.
  defaultTools: false,
  // Chats last until the user deletes them: no 30-day session timeout. A session's stored conversation is
  // deleted when it ends (thread or account deletion resets it), not kept for a retention period.
  limits: { sessionTimeoutMs: false },
  experimental: { workflow: { retention: 0 } },
});
