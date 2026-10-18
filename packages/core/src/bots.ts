/** The bots shown in the sidebar. Each maps to an eve workspace agent under `agents/`. */
export interface BotInfo {
  agent: string;
  name: string;
  icon: string;
  tagline: string;
}

export const SYSTEM_BOTS: BotInfo[] = [
  { agent: "captain", name: "Captain", icon: "🧭", tagline: "Ask anything — searches the web and works in your Slack, Gmail and Notion" },
  { agent: "builder", name: "Builder", icon: "🛠️", tagline: "Describe an app and it gets built onto your Mac" },
];

export const APP_BOT_AGENT = "app-bot";

export function botFor(agent: string): BotInfo | undefined {
  return SYSTEM_BOTS.find((bot) => bot.agent === agent);
}
