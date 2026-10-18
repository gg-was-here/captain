/** The bots shown in the sidebar. Each maps to an eve workspace agent under `agents/`. */
export interface BotInfo {
  agent: string;
  name: string;
  icon: string;
  tagline: string;
  /** Connector the user must authorize before this bot is useful. */
  connector?: "slack" | "google" | "notion";
}

export const SYSTEM_BOTS: BotInfo[] = [
  { agent: "captain", name: "Captain", icon: "🧭", tagline: "Ask anything — searches the web and routes to the right bot" },
  { agent: "builder", name: "Builder", icon: "🛠️", tagline: "Describe an app and it gets built onto your Mac" },
  { agent: "slack", name: "Slack", icon: "💬", tagline: "Search, summarize and reply across your workspace", connector: "slack" },
  { agent: "gmail", name: "Gmail", icon: "✉️", tagline: "Triage, search and draft email", connector: "google" },
  { agent: "notion", name: "Notion", icon: "📓", tagline: "Find and edit pages and databases", connector: "notion" },
];

export const APP_BOT_AGENT = "app-bot";

export function botFor(agent: string): BotInfo | undefined {
  return SYSTEM_BOTS.find((bot) => bot.agent === agent);
}
