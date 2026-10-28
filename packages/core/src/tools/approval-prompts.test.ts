import { describe, expect, it } from "vitest";
import { emailPrompt, slackPostPrompt, visible } from "./approval-prompts";

describe("approval prompts", () => {
  it("shows the addresses mail goes to, not display names", () => {
    const prompt = emailPrompt("Send?", { to: '"Your Boss" <attacker@evil.com>, ada@example.com', subject: "Hi", body: "x" });
    expect(prompt).toContain("To: attacker@evil.com, ada@example.com");
    expect(prompt).not.toContain("Your Boss");
  });

  it("makes hidden characters visible", () => {
    expect(visible("moc.liame\u202E@ssob")).toBe("moc.liame\\u{202e}@ssob");
    expect(visible("a\r\nBcc: x")).toBe("a\\u{d}\\u{a}Bcc: x");
  });

  it("shows the subject a reply is actually sent with", () => {
    expect(emailPrompt("Send?", { to: "a@b.com", subject: "Plans", body: "", threadId: "t1" })).toContain("Subject: Re: Plans");
  });

  it("says when long text is cut", () => {
    const prompt = slackPostPrompt({ channel: "C1", text: "x".repeat(5000) }, 1000);
    expect(prompt).toContain("… 4000 more characters not shown");
  });
});
