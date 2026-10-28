import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/oidc", () => ({ getVercelOidcToken: async () => "oidc-token" }));

const { endSession } = await import("./sessions");

const stubFetch = (status: number) => {
  const fetch = vi.fn(async (_url: URL | string, _init?: RequestInit) => new Response("{}", { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

describe("endSession", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("calls this deployment with its identity on Vercel, never the host the request named", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "bambii.ai");
    const fetch = stubFetch(200);
    await endSession("https://attacker.example", "captain", "ses/1", "__session=abc");
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe("https://bambii.ai/eve/captain/v1/session/ses%2F1/reset");
    expect(init?.headers).toEqual({ "content-type": "application/json", authorization: "Bearer oidc-token" });
  });

  it("uses the deployment URL on previews", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "captain-abc.vercel.app");
    const fetch = stubFetch(200);
    await endSession("https://bambii.ai", "builder", "ses_2");
    expect(String(fetch.mock.calls[0][0])).toBe("https://captain-abc.vercel.app/eve/builder/v1/session/ses_2/reset");
  });

  it("uses the browser's origin and the user's cookie in local dev", async () => {
    vi.stubEnv("VERCEL", "");
    const fetch = stubFetch(200);
    await endSession("http://localhost:3000", "app-bot", "ses_3", "__session=abc");
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe("http://localhost:3000/eve/app-bot/v1/session/ses_3/reset");
    expect(init?.headers).toEqual({ "content-type": "application/json", cookie: "__session=abc" });
  });

  it("fails unless the bot confirms", async () => {
    vi.stubEnv("VERCEL", "");
    for (const status of [401, 403, 404, 500]) {
      stubFetch(status);
      await expect(endSession("http://localhost:3000", "captain", "ses_4")).rejects.toThrow(`HTTP ${status}`);
    }
  });

  it("ignores agents that aren't Bambii's bots", async () => {
    const fetch = stubFetch(200);
    await endSession("http://localhost:3000", "../../api/me", "ses_5");
    expect(fetch).not.toHaveBeenCalled();
  });
});
