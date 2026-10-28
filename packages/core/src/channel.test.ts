import { afterEach, describe, expect, it, vi } from "vitest";
import { isCrossSiteWrite, routePath, sessionIdOf, trustedForwarders } from "./channel";

type Forwarder = Parameters<typeof trustedForwarders>[0];
type Assertion = Parameters<typeof trustedForwarders>[1];

const user = (issuer: string) => ({
  authenticator: "captain",
  issuer,
  principalId: "user_1",
  principalType: "user" as const,
  attributes: {},
});
const assertion = (issuer: string) => ({ principal: { current: user(issuer), initiator: user(issuer) } }) as unknown as Assertion;
const forwarder = (fields: Record<string, string>) => fields as unknown as Forwarder;

describe("routePath", () => {
  it("ignores trailing and repeated slashes, as eve's router does", () => {
    const path = (p: string) => routePath(new Request(`https://bambii.ai${p}`));
    expect(path("/eve/captain/v1/session/")).toBe("/eve/captain/v1/session");
    expect(path("/eve/captain/v1/info//")).toBe("/eve/captain/v1/info");
    expect(path("/eve//captain/v1//session/wrun_1/")).toBe("/eve/captain/v1/session/wrun_1");
    expect(path("/")).toBe("/");
  });
});

describe("sessionIdOf", () => {
  it("finds the session in every session route", () => {
    for (const path of ["", "/stream", "/cancel", "/reset", "/subagents/call_1/s_child/stream"]) {
      expect(sessionIdOf(new Request(`https://bambii.ai/eve/captain/v1/session/s_123${path}`))).toBe("s_123");
    }
  });

  it("ignores routes without a session", () => {
    expect(sessionIdOf(new Request("https://bambii.ai/eve/captain/v1/session"))).toBeUndefined();
    expect(sessionIdOf(new Request("https://bambii.ai/eve/captain/v1/info"))).toBeUndefined();
  });
});

describe("trustedForwarders", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("trusts this deployment's runtime forwarding a Clerk user", () => {
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    expect(trustedForwarders(forwarder({ authenticator: "vercel-oidc", principalType: "runtime" }), assertion("clerk"))).toBe(true);
  });

  it("refuses other environments of the same project", () => {
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    expect(trustedForwarders(forwarder({ authenticator: "vercel-oidc", principalType: "service" }), assertion("clerk"))).toBe(false);
  });

  it("refuses forwarded users that Clerk didn't issue", () => {
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    expect(trustedForwarders(forwarder({ authenticator: "vercel-oidc", principalType: "runtime" }), assertion("local"))).toBe(false);
  });

  it("trusts the local user only when Clerk isn't configured", () => {
    vi.stubEnv("CLERK_SECRET_KEY", "");
    const local = forwarder({ authenticator: "captain", issuer: "local", principalType: "user" });
    expect(trustedForwarders(local, assertion("local"))).toBe(true);
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    expect(trustedForwarders(local, assertion("local"))).toBe(false);
  });
});

describe("isCrossSiteWrite", () => {
  const post = (headers: Record<string, string>) =>
    new Request("https://bambii.ai/eve/captain/v1/session", { method: "POST", headers });

  it("allows Bambii's own requests", () => {
    expect(isCrossSiteWrite(post({ "sec-fetch-site": "same-origin", "content-type": "application/json" }))).toBe(false);
    // A prewarm has no body and no content type.
    expect(isCrossSiteWrite(post({ "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(isCrossSiteWrite(new Request("https://bambii.ai/eve/captain/v1/session/s_1/stream"))).toBe(false);
  });

  it("refuses cross-site requests and form-style bodies", () => {
    expect(isCrossSiteWrite(post({ "sec-fetch-site": "cross-site", "content-type": "application/json" }))).toBe(true);
    expect(isCrossSiteWrite(post({ "content-type": "text/plain" }))).toBe(true);
    expect(isCrossSiteWrite(post({ "content-type": "application/x-www-form-urlencoded" }))).toBe(true);
  });

  it("leaves bearer callers alone", () => {
    expect(isCrossSiteWrite(post({ authorization: "Bearer x", "content-type": "text/plain" }))).toBe(false);
  });

  it("still checks cookie requests that carry another kind of Authorization header", () => {
    expect(isCrossSiteWrite(post({ authorization: "Basic eA==", "sec-fetch-site": "cross-site" }))).toBe(true);
  });
});
