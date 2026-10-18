import { z } from "zod";
import * as gmail from "./gmail";
import * as slack from "./slack";

export { gmail, slack };
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
    uid: process.env.CONNECT_NOTION ?? "notion",
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
    searchMessages: {
      write: false,
      input: z.object({ query: z.string(), count: z.number().int().max(100).optional() }),
      run: slack.searchMessages,
    },
    listChannels: { write: false, input: z.object({}), run: slack.listChannels },
    channelHistory: {
      write: false,
      input: z.object({ channel: z.string(), limit: z.number().int().max(200).optional(), oldest: z.string().optional() }),
      run: slack.channelHistory,
    },
    threadReplies: {
      write: false,
      input: z.object({ channel: z.string(), ts: z.string() }),
      run: slack.threadReplies,
    },
    postMessage: {
      write: true,
      input: z.object({ channel: z.string(), text: z.string(), threadTs: z.string().optional() }),
      run: slack.postMessage,
    },
  },
  google: {
    searchEmail: {
      write: false,
      input: z.object({ query: z.string(), maxResults: z.number().int().max(50).optional() }),
      run: gmail.searchEmail,
    },
    readThread: { write: false, input: z.object({ threadId: z.string() }), run: gmail.readThread },
    createDraft: {
      write: true,
      input: z.object({ to: z.string(), subject: z.string(), body: z.string(), threadId: z.string().optional() }),
      run: gmail.createDraft,
    },
    sendEmail: {
      write: true,
      input: z.object({ to: z.string(), subject: z.string(), body: z.string(), threadId: z.string().optional() }),
      run: gmail.sendEmail,
    },
  },
} as const;

export type AppActionConnector = keyof typeof APP_ACTIONS;
