import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

process.env.CAPTAIN_DATA_DIR = mkdtempSync(join(tmpdir(), "captain-sent-"));
delete process.env.DATABASE_URL;
delete process.env.TURSO_DATABASE_URL;

const { sendOnce } = await import("./sent-actions");
const { ConnectorAuthError, UpstreamError } = await import("./connectors/http");

describe("sendOnce", () => {
  it("sends once and returns the recorded result when the call runs again", async () => {
    const send = vi.fn(async () => ({ ts: "1.2" }));
    expect(await sendOnce("user_a", "call_1", "slack_post", send)).toEqual({ ts: "1.2" });
    expect(await sendOnce("user_a", "call_1", "slack_post", send)).toEqual({ ts: "1.2" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("refuses to run a call again when it's unknown whether the first attempt went out", async () => {
    const timeout = new UpstreamError("Slack", 504, "Slack didn't answer in time.");
    await expect(sendOnce("user_a", "call_2", "slack_post", async () => Promise.reject(timeout))).rejects.toBe(timeout);
    const send = vi.fn(async () => ({ ts: "1.3" }));
    await expect(sendOnce("user_a", "call_2", "slack_post", send)).rejects.toThrow("may have gone through");
    expect(send).not.toHaveBeenCalled();
  });

  it("lets a call that clearly failed run again, e.g. after reconnecting", async () => {
    await expect(
      sendOnce("user_a", "call_3", "gmail_send", async () => Promise.reject(new ConnectorAuthError("google"))),
    ).rejects.toBeInstanceOf(ConnectorAuthError);
    expect(await sendOnce("user_a", "call_3", "gmail_send", async () => ({ messageId: "m1" }))).toEqual({ messageId: "m1" });
  });

  it("keeps each user's calls apart", async () => {
    await sendOnce("user_a", "call_4", "slack_post", async () => ({ ts: "a" }));
    expect(await sendOnce("user_b", "call_4", "slack_post", async () => ({ ts: "b" }))).toEqual({ ts: "b" });
  });
});
