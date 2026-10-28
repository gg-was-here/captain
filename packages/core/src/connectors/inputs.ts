import { z } from "zod";

/**
 * Inputs for the Slack and Gmail actions, shared by the bots' tools and by built apps
 * (`APP_ACTIONS`). Both are filled in by a model or by LLM-written code, so every field is bounded.
 */

/** Header fields can't contain line breaks: one would start a new header (a hidden Bcc, say) or the body. */
const headerText = (max: number) =>
  z
    .string()
    .max(max)
    .regex(/^[^\r\n\0]*$/, "Can't contain line breaks");

/** Recipient entries, split on commas outside quoted names and angle brackets: `"Doe, Jane" <j@x.com>` is one. */
export function recipientsOf(value: string): string[] {
  const entries: string[] = [];
  let current = "";
  let quoted = false;
  let bracketed = false;
  for (const char of value) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === "<") bracketed = true;
    else if (!quoted && char === ">") bracketed = false;
    else if (!quoted && !bracketed && char === ",") {
      entries.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  entries.push(current.trim());
  return entries.filter(Boolean);
}

/** The address a recipient entry sends to: `Name <a@b.com>` is `a@b.com`. */
export const addressOf = (entry: string) => (entry.match(/<([^<>]*)>\s*$/)?.[1] ?? entry).trim();

/** One or more recipients, comma-separated, each "a@b.com" or "Name <a@b.com>". */
const recipients = headerText(2000).refine((value) => {
  const entries = recipientsOf(value);
  return entries.length > 0 && entries.length <= 20 && entries.every((entry) => z.email().safeParse(addressOf(entry)).success);
}, "Use one to 20 email addresses, separated by commas");

/** Gmail message and thread ids: they go into API paths. */
const gmailId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Not a Gmail id");

/** Slack message timestamps, e.g. "1730000000.123456". */
const slackTs = z.string().regex(/^\d{1,12}(\.\d{1,9})?$/, "Not a Slack timestamp");

const slackChannel = z.string().min(1).max(80).describe("Channel id, e.g. C0123456");

const query = z.string().min(1).max(1000);

export const inputs = {
  slackSearch: z.object({ query, count: z.number().int().min(1).max(100).optional() }),
  slackListChannels: z.object({}),
  slackChannelHistory: z.object({
    channel: slackChannel,
    limit: z.number().int().min(1).max(200).optional(),
    oldest: slackTs.optional().describe("Unix timestamp; only messages newer than this"),
  }),
  slackThread: z.object({ channel: slackChannel, ts: slackTs.describe("Parent message ts") }),
  slackPost: z.object({ channel: slackChannel, text: z.string().min(1).max(40_000), threadTs: slackTs.optional() }),
  // An empty Gmail query means all mail, newest first.
  gmailSearch: z.object({ query: z.string().max(1000), maxResults: z.number().int().min(1).max(50).optional() }),
  gmailReadThread: z.object({ threadId: gmailId }),
  email: z.object({
    to: recipients,
    subject: headerText(998),
    body: z.string().max(100_000),
    threadId: gmailId.optional().describe("Thread to reply in"),
  }),
};
