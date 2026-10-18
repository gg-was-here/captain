/** Thin Slack Web API client used by the slack bot and by generated apps. */

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
    ? await fetch(`https://slack.com/api/${method}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(params),
      })
    : await fetch(`https://slack.com/api/${method}?${query}`, {
        headers: { authorization: `Bearer ${token}` },
      });
  if (response.status === 401) throw new ConnectorAuthError("slack");
  const body = (await response.json()) as { ok: boolean; error?: string } & T;
  if (!body.ok) {
    if (body.error === "invalid_auth" || body.error === "token_revoked") {
      throw new ConnectorAuthError("slack");
    }
    throw new Error(`Slack ${method} failed: ${body.error}`);
  }
  return body;
}

export class ConnectorAuthError extends Error {
  constructor(readonly connector: string) {
    super(`${connector} authorization expired or was revoked`);
  }
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

export async function listChannels(token: string, { limit = 200 }: { limit?: number } = {}) {
  const body = await slack<{
    channels: { id: string; name: string; is_private: boolean; num_members?: number; topic?: { value: string } }[];
  }>(token, "conversations.list", {
    limit,
    exclude_archived: true,
    types: "public_channel,private_channel,mpim,im",
  });
  return body.channels.map((c) => ({
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
