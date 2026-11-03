/**
 * Alerts for the operator: server errors and AI spend. Every alert is logged as one JSON line tagged
 * `[alert]` (searchable in Vercel's logs). If `CAPTAIN_ALERT_WEBHOOK_URL` is set, it's also posted there:
 * the body carries both `text` (Slack) and `content` (Discord), so either kind of incoming webhook works.
 *
 * Alerts never throw and never delay the request for long. The same alert key is sent at most once per
 * `THROTTLE_MS` per server instance, so an outage doesn't flood the channel.
 */

const THROTTLE_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 3000;

const globalForAlerts = globalThis as unknown as { __captainAlertsSent?: Map<string, number> };

export interface AlertDetails {
  readonly [key: string]: string | number | boolean | undefined;
}

/** Sends an alert unless one with the same `key` went out recently. Returns whether it was sent. */
export async function alert(key: string, message: string, details: AlertDetails = {}): Promise<boolean> {
  const sent = (globalForAlerts.__captainAlertsSent ??= new Map());
  const now = Date.now();
  const last = sent.get(key);
  if (last !== undefined && now - last < THROTTLE_MS) return false;
  sent.set(key, now);

  console.error("[alert]", JSON.stringify({ key, message, ...details }));
  const url = process.env.CAPTAIN_ALERT_WEBHOOK_URL;
  if (!url) return true;
  const lines = Object.entries(details)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${name}: ${value}`);
  const text = [`Bambii: ${message}`, ...lines].join("\n").slice(0, 1900);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) console.error("[alert] webhook answered", response.status);
  } catch (error) {
    console.error("[alert] webhook failed", error);
  }
  return true;
}

/** Forgets which alerts were sent, for tests. */
export function resetAlerts(): void {
  globalForAlerts.__captainAlertsSent?.clear();
}
