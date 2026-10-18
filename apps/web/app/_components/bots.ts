import { botFor } from "@captain/core/bots";
import type { App } from "@captain/core/schema";
import type { ChatBot } from "./agent-chat";

const INTROS: Record<string, string> = {
  captain:
    "Captain connects with your applications. Talk to it 24/7, hand it tasks, and have it build apps of your own.",
};

const SUGGESTIONS: Record<string, string[]> = {
  builder: [
    "Build a task tracker from my Slack messages",
    "Make a dashboard of emails waiting on my reply",
    "Create a habit tracker",
  ],
};

export function chatBot(agent: string, app?: Pick<App, "name" | "icon" | "description"> | null): ChatBot {
  if (agent === "app-bot" && app) {
    return {
      agent,
      name: `${app.name}`,
      icon: app.icon,
      tagline: app.description || "Ask about this app's data or have it make changes.",
      suggestions: ["Summarize what's in here", "What should I focus on?", "Pull in anything new"],
    };
  }
  const bot = botFor(agent) ?? botFor("captain")!;
  return { ...bot, suggestions: SUGGESTIONS[bot.agent], intro: INTROS[bot.agent] };
}
