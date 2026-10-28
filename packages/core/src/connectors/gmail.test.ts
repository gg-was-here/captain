import { afterEach, describe, expect, it, vi } from "vitest";
import { createDraft } from "./gmail";
import { inputs } from "./inputs";

/** Captures the raw MIME message Gmail would receive, answering thread lookups with `thread`. */
function mockGmail(thread: unknown = { messages: [] }) {
  const sent: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/drafts")) {
        sent.push(Buffer.from(JSON.parse(String(init?.body)).message.raw, "base64url").toString("utf8"));
        return Response.json({ id: "draft_1" });
      }
      return Response.json(thread);
    }),
  );
  return sent;
}

const headersOf = (mime: string) => mime.split("\r\n\r\n")[0].split("\r\n");
const bodyOf = (mime: string) => Buffer.from(mime.split("\r\n\r\n")[1].replace(/\r\n/g, ""), "base64").toString("utf8");

describe("Gmail messages", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refuses line breaks in headers, which could add a hidden Bcc", async () => {
    mockGmail();
    await expect(
      createDraft("token", { to: "boss@corp.com", subject: "Q3\r\nBcc: attacker@evil.com", body: "hi" }),
    ).rejects.toThrow("line breaks");
    expect(inputs.email.safeParse({ to: "boss@corp.com", subject: "Q3\nBcc: x@evil.com", body: "hi" }).success).toBe(false);
    expect(inputs.email.safeParse({ to: "boss@corp.com\r\nBcc: x@evil.com", subject: "Q3", body: "hi" }).success).toBe(false);
  });

  it("encodes non-ASCII subjects and keeps the body intact", async () => {
    const sent = mockGmail();
    await createDraft("token", { to: "a@b.com", subject: "Café ☕", body: "Line one\nLigne deux — ✓" });
    expect(headersOf(sent[0])).toContain(`Subject: =?UTF-8?B?${Buffer.from("Café ☕").toString("base64")}?=`);
    expect(bodyOf(sent[0])).toBe("Line one\nLigne deux — ✓");
  });

  it("threads replies to the latest message the recipients received", async () => {
    const message = (id: string, extra: object = {}) => ({
      payload: { mimeType: "text/plain", headers: [{ name: "Message-ID", value: id }, { name: "References", value: "<m1@mail.gmail.com>" }] },
      ...extra,
    });
    const sent = mockGmail({
      // The bots usually save a draft first; a reply must point at the real message before it.
      messages: [message("<m2@mail.gmail.com>"), message("<draft@mail.gmail.com>", { labelIds: ["DRAFT"] })],
    });
    await createDraft("token", { to: "a@b.com", subject: "Plans", body: "Sounds good", threadId: "18c2f" });
    const headers = headersOf(sent[0]);
    expect(headers).toContain("Subject: Re: Plans");
    expect(headers).toContain("In-Reply-To: <m2@mail.gmail.com>");
    expect(headers).toContain("References: <m1@mail.gmail.com> <m2@mail.gmail.com>");
  });

  it("validates recipients and ids", () => {
    const email = (to: string) => inputs.email.safeParse({ to, subject: "Hi", body: "" }).success;
    expect(email("Ada Lovelace <ada@example.com>, bob@example.com")).toBe(true);
    expect(email('"Doe, John" <john@corp.com>, ada@example.com')).toBe(true);
    expect(email("a@example.com; b@example.com")).toBe(false);
    expect(email("not an address")).toBe(false);
    expect(email("")).toBe(false);
    expect(inputs.gmailReadThread.safeParse({ threadId: "../settings/filters" }).success).toBe(false);
    expect(inputs.slackThread.safeParse({ channel: "C123", ts: "1730000000.123456" }).success).toBe(true);
    expect(inputs.slackThread.safeParse({ channel: "C123", ts: "x?y" }).success).toBe(false);
  });
});
