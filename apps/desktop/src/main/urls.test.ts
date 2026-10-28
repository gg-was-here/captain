import { describe, expect, it } from "vitest";
import { deepLinkPath, isExternalUrl, mayShowInWindow } from "./urls";

describe("deep links", () => {
  it("opens threads", () => {
    expect(deepLinkPath("captain://t/t_abc123")).toBe("/t/t_abc123");
    expect(deepLinkPath("captain://t/t_abc123/")).toBe("/t/t_abc123");
  });

  it("ignores everything else", () => {
    for (const url of [
      "captain://a/app_1/",
      "captain://desktop/complete?ticket=attacker",
      "captain://t/../desktop/complete",
      "captain://t/t_1/extra",
      "https://bambii.ai/t/t_1",
      "not a url",
    ]) {
      expect(deepLinkPath(url)).toBeUndefined();
    }
  });
});

describe("external links", () => {
  it("allows web and email links", () => {
    for (const url of ["https://example.com/x", "http://example.com", "mailto:a@b.com"]) expect(isExternalUrl(url)).toBe(true);
  });

  it("refuses local files and other apps' schemes", () => {
    for (const url of ["file:///Applications/Calculator.app", "smb://host/share", "javascript:alert(1)", "vscode://x"]) {
      expect(isExternalUrl(url)).toBe(false);
    }
  });
});

describe("main window navigation", () => {
  const origin = "https://bambii.ai";

  it("shows Bambii and its Clerk sign-in pages", () => {
    for (const url of ["https://bambii.ai/t/1", "https://clerk.bambii.ai/v1/client/handshake", "https://accounts.bambii.ai/sign-in", "https://notable-bunny-7530.clerk.accounts.dev/v1/client"]) {
      expect(mayShowInWindow(url, origin)).toBe(true);
    }
  });

  it("sends other sites to the browser", () => {
    for (const url of ["https://bambii-login.evil.com/", "https://evilbambii.ai/", "http://clerk.bambii.ai/", "https://bambii-login.accounts.dev/sign-in", "https://other.bambii.ai/", "file:///etc/passwd"]) {
      expect(mayShowInWindow(url, origin)).toBe(false);
    }
  });
});
