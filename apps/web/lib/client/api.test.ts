import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, describeFailure, OFFLINE_MESSAGE } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("describeFailure", () => {
  it("prefers the server's message, adding a reference only for server failures", () => {
    expect(describeFailure(429, "You've reached today's limit.", "ref1", "Couldn't send.")).toBe("You've reached today's limit.");
    expect(describeFailure(500, "Something went wrong. Please try again.", "iad1::abc", "Couldn't send.")).toBe(
      "Something went wrong. Please try again. (Reference: iad1::abc)",
    );
  });

  it("explains statuses the server didn't", () => {
    expect(describeFailure(401, "Unauthorized", undefined, "Couldn't send.")).toMatch(/signed out/);
    expect(describeFailure(413, undefined, undefined, "Couldn't send.")).toBe("Couldn't send. It's too large to send.");
    expect(describeFailure(502, undefined, "iad1::xyz", "Couldn't send.")).toBe("Couldn't send. Please try again. (Reference: iad1::xyz)");
  });
});

describe("api", () => {
  it("throws the server's explanation for a failed response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "This chat belongs to another account." }, { status: 403 })));
    const error = await api("/api/threads/t1", { method: "DELETE" }, "Couldn't delete this chat.").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe("This chat belongs to another account.");
    expect((error as ApiError).status).toBe(403);
  });

  it("uses Vercel's request id as the reference when the body has none", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>timeout</html>", { status: 504, headers: { "x-vercel-id": "iad1::t" } })));
    await expect(api("/api/me", undefined, "Couldn't load.")).rejects.toThrow("Couldn't load. Please try again. (Reference: iad1::t)");
  });

  it("says when Bambii couldn't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(api("/api/me", undefined, "Couldn't load.")).rejects.toThrow(OFFLINE_MESSAGE);
  });
});
