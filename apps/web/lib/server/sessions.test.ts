import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/oidc", () => ({ getVercelOidcToken: async () => "oidc-token" }));

const { endSession } = await import("./sessions");

/** Stubs fetch with one response and records each request as a `Request`. */
const stubFetch = (respond: () => Response) => {
  const requests: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init));
      return respond();
    }),
  );
  return requests;
};

const reset = () => Response.json({ ok: true, status: "no_active_session" });

describe("endSession", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("calls this deployment with its identity on Vercel, never the host the request named", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "bambii.ai");
    const requests = stubFetch(reset);
    await endSession("https://attacker.example", "captain", "ses/1", "__session=abc");
    expect(requests[0].url).toBe("https://bambii.ai/eve/captain/v1/session/ses%2F1/reset");
    expect(requests[0].headers.get("authorization")).toBe("Bearer oidc-token");
    expect(requests[0].headers.get("cookie")).toBeNull();
  });

  it("uses the deployment URL on previews", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "captain-abc.vercel.app");
    const requests = stubFetch(reset);
    await endSession("https://bambii.ai", "builder", "ses_2");
    expect(requests[0].url).toBe("https://captain-abc.vercel.app/eve/builder/v1/session/ses_2/reset");
  });

  it("uses the browser's origin and the user's cookie in local dev", async () => {
    vi.stubEnv("VERCEL", "");
    const requests = stubFetch(reset);
    await endSession("http://localhost:3000", "app-bot", "ses_3", "__session=abc");
    expect(requests[0].url).toBe("http://localhost:3000/eve/app-bot/v1/session/ses_3/reset");
    expect(requests[0].headers.get("cookie")).toBe("__session=abc");
    expect(requests[0].headers.get("authorization")).toBeNull();
  });

  it("succeeds for a session that has already ended", async () => {
    vi.stubEnv("VERCEL", "");
    stubFetch(() => Response.json({ ok: true, status: "no_active_session" }));
    await expect(endSession("http://localhost:3000", "captain", "ses_4")).resolves.toBeUndefined();
  });

  it("fails unless the bot confirms", async () => {
    vi.stubEnv("VERCEL", "");
    for (const status of [401, 403, 404, 500]) {
      stubFetch(() => Response.json({ ok: false, error: "nope" }, { status }));
      await expect(endSession("http://localhost:3000", "captain", "ses_5")).rejects.toThrow();
    }
  });

  it("ignores agents that aren't Bambii's bots", async () => {
    const requests = stubFetch(reset);
    await endSession("http://localhost:3000", "../../api/me", "ses_6");
    expect(requests).toHaveLength(0);
  });
});
