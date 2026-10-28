import * as gmail from "./gmail";
import { inputs } from "./inputs";
import * as slack from "./slack";

export { gmail, slack };
export { inputs } from "./inputs";
export { ConnectorAuthError } from "./slack";

/**
 * Vercel Connect connector UIDs. Register them once with
 * `vercel connect create slack`, `vercel connect create <google oauth>` and
 * `vercel connect create https://mcp.notion.com/mcp`, then set the env vars if
 * the generated UIDs differ from these defaults.
 */
export const CONNECTORS = {
  slack: {
    label: "Slack",
    uid: process.env.CONNECT_SLACK ?? "slack/captain",
    scopes: ["search:read", "channels:history", "groups:history", "im:history", "channels:read", "groups:read", "chat:write"],
  },
  google: {
    label: "Google Workspace",
    uid: process.env.CONNECT_GOOGLE ?? "google/captain",
    scopes: [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.compose",
    ],
  },
  notion: {
    label: "Notion",
    uid: process.env.CONNECT_NOTION ?? "notion/notion",
    scopes: [],
  },
} as const;

export type ConnectorName = keyof typeof CONNECTORS;
export const CONNECTOR_NAMES = Object.keys(CONNECTORS) as ConnectorName[];

/**
 * Actions a generated app may call through `captain.connectors.<name>.<action>()`.
 * Reads run immediately; `write: true` actions are confirmed by the user in the
 * desktop app before the request is sent.
 */
export const APP_ACTIONS = {
  slack: {
    searchMessages: { write: false, input: inputs.slackSearch, run: slack.searchMessages },
    listChannels: { write: false, input: inputs.slackListChannels, run: slack.listChannels },
    channelHistory: { write: false, input: inputs.slackChannelHistory, run: slack.channelHistory },
    threadReplies: { write: false, input: inputs.slackThread, run: slack.threadReplies },
    postMessage: { write: true, input: inputs.slackPost, run: slack.postMessage },
  },
  google: {
    searchEmail: { write: false, input: inputs.gmailSearch, run: gmail.searchEmail },
    readThread: { write: false, input: inputs.gmailReadThread, run: gmail.readThread },
    createDraft: { write: true, input: inputs.email, run: gmail.createDraft },
    sendEmail: { write: true, input: inputs.email, run: gmail.sendEmail },
  },
} as const;

export type AppActionConnector = keyof typeof APP_ACTIONS;
