/**
 * Approval prompts that show exactly what the user is approving. eve's default prompt is just the tool
 * label ("Approve Send email to x?"), which hides the subject and body.
 */

/** Escapes control characters in a single-line field, so a hidden line break can't pass for part of it. */
export const visible = (value: string) => JSON.stringify(value).slice(1, -1);

export function emailPrompt(
  question: string,
  email: { to: string; subject: string; body: string; threadId?: string },
): string {
  return [
    question,
    "",
    `To: ${visible(email.to)}`,
    `Subject: ${visible(email.subject)}`,
    ...(email.threadId ? [`Reply in thread: ${visible(email.threadId)}`] : []),
    "",
    email.body,
  ].join("\n");
}

export function slackPostPrompt(post: { channel: string; text: string; threadTs?: string }): string {
  return [
    "Post this to Slack as you?",
    "",
    `Channel: ${visible(post.channel)}${post.threadTs ? ` (reply in thread ${visible(post.threadTs)})` : ""}`,
    "",
    post.text,
  ].join("\n");
}
