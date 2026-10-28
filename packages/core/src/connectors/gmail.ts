/** Thin Gmail REST client used by the gmail bot and by generated apps. */
import { ConnectorAuthError } from "./slack";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmail<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init?.headers },
  });
  if (response.status === 401) throw new ConnectorAuthError("google");
  if (!response.ok) throw new Error(`Gmail ${path} failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

interface GmailPayload {
  mimeType: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string };
  parts?: GmailPayload[];
}

const header = (payload: GmailPayload, name: string) =>
  payload.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;

function decode(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

/** Prefer text/plain; fall back to stripped text/html. */
function bodyText(payload: GmailPayload): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) return decode(payload.body.data);
  for (const part of payload.parts ?? []) {
    const text = bodyText(part);
    if (text) return text;
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decode(payload.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

export async function searchEmail(
  token: string,
  { query, maxResults = 15 }: { query: string; maxResults?: number },
) {
  const list = await gmail<{ messages?: { id: string; threadId: string }[] }>(
    token,
    `/messages?${new URLSearchParams({ q: query, maxResults: String(maxResults) })}`,
  );
  return Promise.all(
    (list.messages ?? []).map(async ({ id, threadId }) => {
      const msg = await gmail<{ snippet: string; labelIds?: string[]; payload: GmailPayload }>(
        token,
        `/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      );
      return {
        id,
        threadId,
        from: header(msg.payload, "From"),
        subject: header(msg.payload, "Subject"),
        date: header(msg.payload, "Date"),
        snippet: msg.snippet,
        unread: msg.labelIds?.includes("UNREAD") ?? false,
      };
    }),
  );
}

export async function readThread(token: string, { threadId }: { threadId: string }) {
  const thread = await gmail<{ messages: { id: string; payload: GmailPayload }[] }>(
    token,
    `/threads/${encodeURIComponent(threadId)}?format=full`,
  );
  return thread.messages.map((m) => ({
    id: m.id,
    from: header(m.payload, "From"),
    to: header(m.payload, "To"),
    subject: header(m.payload, "Subject"),
    date: header(m.payload, "Date"),
    body: bodyText(m.payload).slice(0, 8000),
  }));
}

/** Header text as RFC 2047 when it isn't plain ASCII, so a subject like "Café ☕" arrives intact. */
function encodeHeader(value: string) {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** A line break in a header would start a new header (a hidden Bcc, say) or the body. */
function headerValue(name: string, value: string) {
  if (/[\r\n\0]/.test(value)) throw new Error(`The email's ${name} can't contain line breaks`);
  return value;
}

/** The subject a message is sent with: replies in a thread get "Re:", which Gmail needs to thread them. */
export const replySubject = (subject: string, threadId?: string) =>
  threadId && !/^re:/i.test(subject.trim()) ? `Re: ${subject}` : subject;

interface Email {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

/**
 * Gmail threads a reply only when it carries In-Reply-To and References for the message it answers and
 * a matching subject, so look those up from the thread's latest message.
 */
async function replyHeaders(token: string, threadId: string) {
  const thread = await gmail<{ messages?: { labelIds?: string[]; payload: GmailPayload }[] }>(
    token,
    `/threads/${encodeURIComponent(threadId)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References&metadataHeaders=In-Reply-To`,
  );
  // The latest message the recipients actually received: the bots often save a draft before sending.
  const last = (thread.messages ?? [])
    .slice()
    .reverse()
    .find((message) => !message.labelIds?.includes("DRAFT") && header(message.payload, "Message-ID"))?.payload;
  const messageId = last && header(last, "Message-ID");
  if (!last || !messageId) return {};
  // These come from a received email, so they get no say in the message's structure either.
  const clean = (value: string) => value.replace(/[\r\n\0]/g, " ");
  const ids = [...(header(last, "References") ?? header(last, "In-Reply-To") ?? "").split(/\s+/).filter(Boolean), messageId];
  // Keep the thread's first message and the latest ones, so the header stays a sensible length.
  const references = ids.length > 12 ? [ids[0], ...ids.slice(-11)] : ids;
  return { inReplyTo: clean(messageId), references: clean(references.join(" ")) };
}

async function rawMessage(token: string, { to, subject, body, threadId }: Email) {
  const reply = threadId ? await replyHeaders(token, threadId) : {};
  const lines = [
    `To: ${headerValue("recipients", to)}`,
    `Subject: ${encodeHeader(headerValue("subject", replySubject(subject, threadId)))}`,
    ...(reply.inReplyTo ? [`In-Reply-To: ${reply.inReplyTo}`, `References: ${reply.references}`] : []),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    ...(Buffer.from(body, "utf8").toString("base64").match(/.{1,76}/g) ?? []),
  ];
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

export async function createDraft(token: string, input: Email) {
  const draft = await gmail<{ id: string }>(token, "/drafts", {
    method: "POST",
    body: JSON.stringify({ message: { raw: await rawMessage(token, input), threadId: input.threadId } }),
  });
  return { draftId: draft.id };
}

export async function sendEmail(token: string, input: Email) {
  const sent = await gmail<{ id: string; threadId: string }>(token, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: await rawMessage(token, input), threadId: input.threadId }),
  });
  return { messageId: sent.id, threadId: sent.threadId };
}
