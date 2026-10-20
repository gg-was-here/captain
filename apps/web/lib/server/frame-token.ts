import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Signed, short-lived path tokens for the web preview of built apps. The
 * preview iframe is sandboxed without `allow-same-origin`, so it never sees
 * Captain's session cookie; instead the first (cookie-carrying) navigation is
 * redirected to `/a/<appId>/t/<token>/`, and assets load with the token alone.
 */
const TTL_MS = 12 * 60 * 60 * 1000;

// Falls back to a per-process secret in local dev; tokens then reset on restart.
const secret = process.env.CAPTAIN_SIGNING_SECRET || process.env.CLERK_SECRET_KEY || randomBytes(32).toString("hex");

const sign = (payload: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function signFrameToken(userId: string, appId: string): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, a: appId, e: Date.now() + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the user id the token was issued to, or null if it is invalid, expired or for another app. */
export function verifyFrameToken(token: string, appId: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const { u, a, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return a === appId && typeof u === "string" && typeof e === "number" && e > Date.now() ? u : null;
  } catch {
    return null;
  }
}
