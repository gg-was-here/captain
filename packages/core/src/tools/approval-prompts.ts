/**
 * Approval prompts that show exactly what the user is approving. eve's default prompt is just the tool
 * label ("Approve Send email to x?"), which hides the subject and body. Built apps' write confirmations
 * use the same text.
 */
import { replySubject } from "../connectors/gmail";
import { addressOf, recipientsOf } from "../connectors/inputs";

/**
 * Escapes control and invisible formatting characters (line breaks, bidi overrides, zero-width
 * characters) in a single-line field, so nothing hidden can change how it reads.
 */
export const visible = (value: string) =>
  value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (char) => `\\u{${char.codePointAt(0)?.toString(16)}}`);

/** Long text, cut at `max` characters with a line saying how much isn't shown. */
function bodyText(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}\n\n… ${text.length - max} more characters not shown` : text;
}

export function emailPrompt(
  question: string,
  email: { to: string; subject: string; body: string; threadId?: string },
  maxBody = Number.POSITIVE_INFINITY,
): string {
  // The addresses mail actually goes to: a display name could pass for someone else.
  const to = recipientsOf(email.to).map((entry) => visible(addressOf(entry)));
  return [
    question,
    "",
    `To: ${to.join(", ")}`,
    `Subject: ${visible(replySubject(email.subject, email.threadId))}`,
    ...(email.threadId ? [`Reply in thread: ${visible(email.threadId)}`] : []),
    "",
    bodyText(email.body, maxBody),
  ].join("\n");
}

export function slackPostPrompt(
  post: { channel: string; text: string; threadTs?: string },
  maxText = Number.POSITIVE_INFINITY,
): string {
  return [
    "Post this to Slack as you?",
    "",
    `Channel: ${visible(post.channel)}${post.threadTs ? ` (reply in thread ${visible(post.threadTs)})` : ""}`,
    "",
    bodyText(post.text, maxText),
  ].join("\n");
}
