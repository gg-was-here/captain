import { afterEach, describe, expect, it, vi } from "vitest";
import { searchEmail } from "./gmail";
import { UpstreamError } from "./http";
import { listChannels, searchMessages } from "./slack";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { ...init, headers: { "content-type": "application/json", ...init.headers } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("connector HTTP", () => {
  it("retries a rate limit, waiting as long as the service asks", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("slow down", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(json({ ok: true, messages: { total: 0, matches: [] } }));
    vi.stubGlobal("fetch", fetch);
    expect(await searchMessages("token", { query: "hi" })).toEqual({ total: 0, messages: [] });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("reports a service that keeps failing as a 503 to try again later", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Bad gateway</html>", { status: 502, headers: { "retry-after": "0" } })));
    const error = await searchMessages("token", { query: "hi" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).status).toBe(503);
  });

  it("doesn't choke on Slack's HTML error pages", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>maintenance</html>", { status: 200, headers: { "content-type": "text/html" } })));
    await expect(searchMessages("token", { query: "hi" })).rejects.toBeInstanceOf(UpstreamError);
  });

  it("follows Slack's pages for the channel list", async () => {
    const channel = (id: string) => ({ id, name: id, is_private: false });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ ok: true, channels: [channel("C1")], response_metadata: { next_cursor: "page2" } }))
      .mockResolvedValueOnce(json({ ok: true, channels: [channel("C2")], response_metadata: { next_cursor: "" } }));
    vi.stubGlobal("fetch", fetch);
    expect((await listChannels("token")).map((c) => c.id)).toEqual(["C1", "C2"]);
    expect(String(fetch.mock.calls[1][0])).toContain("cursor=page2");
  });

  it("keeps the emails it could read when one fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/messages?")) return json({ messages: [{ id: "m1", threadId: "t1" }, { id: "m2", threadId: "t2" }] });
        if (url.includes("/messages/m2")) return json({ error: { message: "gone" } }, { status: 404 });
        return json({ snippet: "hello", payload: { mimeType: "text/plain", headers: [{ name: "Subject", value: "Hi" }] } });
      }),
    );
    const emails = await searchEmail("token", { query: "" });
    expect(emails.map((e) => e.id)).toEqual(["m1"]);
  });
});
