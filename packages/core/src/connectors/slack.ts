/** Thin Slack Web API client used by the bots and by generated apps. */
import { ConnectorAuthError, fetchApi, UpstreamError, upstreamError } from "./http";

export { ConnectorAuthError } from "./http";

async function slack<T = Record<string, unknown>>(
  token: string,
  method: string,
  params: Record<string, string | number | boolean | undefined> = {},
  init: { post?: boolean } = {},
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  const response = init.post
    ? await fetchApi("Slack", `https://slack.com/api/${method}`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify(params),
      })
    : await fetchApi("Slack", `https://slack.com/api/${method}?${query}`, { headers: { authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new ConnectorAuthError("slack");
  // Slack's edge can answer with HTML (502s, maintenance pages); only its API speaks JSON.
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    throw upstreamError("Slack", response, method);
  }
  const body = (await response.json()) as { ok: boolean; error?: string } & T;
  if (!body.ok) {
    if (body.error === "invalid_auth" || body.error === "token_revoked" || body.error === "account_inactive") {
      throw new ConnectorAuthError("slack");
    }
    if (body.error === "ratelimited") throw new UpstreamError("Slack", 503, `Slack is rate-limiting ${method}. Try again in a minute.`);
    throw new UpstreamError("Slack", 502, `Slack ${method} failed: ${body.error ?? "unknown error"}.`);
  }
  return body;
}

interface SlackMessage {
  ts: string;
  text: string;
  user?: string;
  username?: string;
  permalink?: string;
  channel?: { id: string; name: string };
  thread_ts?: string;
  reply_count?: number;
}

const toMessage = (m: SlackMessage) => ({
  ts: m.ts,
  date: new Date(Number(m.ts) * 1000).toISOString(),
  user: m.username ?? m.user,
  text: m.text,
  channel: m.channel?.name,
  channelId: m.channel?.id,
  threadTs: m.thread_ts,
  replyCount: m.reply_count,
  permalink: m.permalink,
});

export async function searchMessages(
  token: string,
  { query, count = 20, page = 1 }: { query: string; count?: number; page?: number },
) {
  const body = await slack<{ messages: { matches: SlackMessage[]; total: number } }>(
    token,
    "search.messages",
    { query, count, page, sort: "timestamp" },
  );
  return { total: body.messages.total, messages: body.messages.matches.map(toMessage) };
}

type SlackChannel = { id: string; name: string; is_private: boolean; num_members?: number; topic?: { value: string } };

/** Every channel, group DM and DM the user is in, following Slack's pages (up to 1,000). */
export async function listChannels(token: string) {
  const channels: SlackChannel[] = [];
  let cursor: string | undefined;
  do {
    const body = await slack<{ channels: SlackChannel[]; response_metadata?: { next_cursor?: string } }>(token, "conversations.list", {
      limit: 200,
      cursor,
      exclude_archived: true,
      types: "public_channel,private_channel,mpim,im",
    });
    channels.push(...body.channels);
    cursor = body.response_metadata?.next_cursor || undefined;
  } while (cursor && channels.length < 1000);
  return channels.map((c) => ({
    id: c.id,
    name: c.name,
    private: c.is_private,
    members: c.num_members,
    topic: c.topic?.value,
  }));
}

export async function channelHistory(
  token: string,
  { channel, limit = 50, oldest }: { channel: string; limit?: number; oldest?: string },
) {
  const body = await slack<{ messages: SlackMessage[] }>(token, "conversations.history", {
    channel,
    limit,
    oldest,
  });
  return body.messages.map(toMessage);
}

export async function threadReplies(token: string, { channel, ts }: { channel: string; ts: string }) {
  const body = await slack<{ messages: SlackMessage[] }>(token, "conversations.replies", {
    channel,
    ts,
  });
  return body.messages.map(toMessage);
}

export async function postMessage(
  token: string,
  { channel, text, threadTs }: { channel: string; text: string; threadTs?: string },
) {
  const body = await slack<{ ts: string; channel: string }>(
    token,
    "chat.postMessage",
    { channel, text, thread_ts: threadTs },
    { post: true },
  );
  return { ts: body.ts, channel: body.channel };
}
