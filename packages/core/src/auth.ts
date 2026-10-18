/**
 * One identity for the web app, the desktop shell and every bot.
 *
 * - Production: a Clerk session JWT, from the `__session` cookie (browser and
 *   Electron, same origin) or an `Authorization: Bearer` header.
 * - Local development without Clerk keys: a fixed `local-user`, so threads,
 *   apps and per-user connector tokens work end to end on one machine.
 */
import { verifyToken } from "@clerk/backend";
import type { AuthFn } from "eve/channels/auth";

export interface CaptainUser {
  id: string;
  email?: string;
  name?: string;
}

const LOCAL_USER: CaptainUser = { id: "local-user", name: "You" };

const isDev = () =>
  process.env.NODE_ENV === "development" ||
  process.env.EVE_DEV === "1" ||
  process.env.VERCEL_ENV === "development";

export const clerkConfigured = () => Boolean(process.env.CLERK_SECRET_KEY);

function sessionToken(request: Request): string | undefined {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.match(/(?:^|;\s*)__session=([^;]+)/)?.[1];
}

export async function resolveUser(request: Request): Promise<CaptainUser | null> {
  if (!clerkConfigured()) return isDev() ? LOCAL_USER : null;
  const token = sessionToken(request);
  if (!token) return null;
  try {
    const claims = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! });
    return {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : undefined,
      name: typeof claims.name === "string" ? claims.name : undefined,
    };
  } catch {
    return null;
  }
}

/** eve channel auth: maps the Captain user to a user principal so per-user connectors work. */
export function captainAuth(): AuthFn<Request> {
  return async (request) => {
    const user = await resolveUser(request);
    if (!user) return null;
    return {
      authenticator: "captain",
      issuer: clerkConfigured() ? "clerk" : "local",
      principalId: user.id,
      principalType: "user",
      attributes: { ...(user.email ? { email: user.email } : {}), ...(user.name ? { name: user.name } : {}) },
    };
  };
}

/** The Vercel Connect subject for a user — must match what `@vercel/connect/eve` derives from the eve principal. */
export function connectSubject(user: CaptainUser) {
  return { type: "user" as const, id: user.id, issuer: clerkConfigured() ? "clerk" : "local" };
}
