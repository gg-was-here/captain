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
        `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
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
    `/threads/${threadId}?format=full`,
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

function rawMessage({ to, subject, body, threadId: _ }: { to: string; subject: string; body: string; threadId?: string }) {
  const mime = [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=utf-8", "", body].join(
    "\r\n",
  );
  return Buffer.from(mime).toString("base64url");
}

export async function createDraft(
  token: string,
  input: { to: string; subject: string; body: string; threadId?: string },
) {
  const draft = await gmail<{ id: string }>(token, "/drafts", {
    method: "POST",
    body: JSON.stringify({ message: { raw: rawMessage(input), threadId: input.threadId } }),
  });
  return { draftId: draft.id };
}

export async function sendEmail(
  token: string,
  input: { to: string; subject: string; body: string; threadId?: string },
) {
  const sent = await gmail<{ id: string; threadId: string }>(token, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: rawMessage(input), threadId: input.threadId }),
  });
  return { messageId: sent.id, threadId: sent.threadId };
}
