import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionIdOf, trustedForwarders } from "./channel";

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
