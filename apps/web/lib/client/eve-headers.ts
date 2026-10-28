"use client";

import { useAuth } from "@clerk/nextjs";
import type { HeadersValue } from "eve/client";
import { useCallback, useRef } from "react";

/** The browser's time zone, so bots work out the user's "today" (see `instructions/today.ts`). */
const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The time zone, and the chat the request belongs to so a new session can pick up a saved earlier one. */
const localHeaders = (threadId?: string): Record<string, string> => ({
  "x-captain-time-zone": timeZone(),
  ...(threadId ? { "x-captain-thread": threadId } : {}),
});

/**
 * With Clerk, every request also carries a fresh session token. The `__session` cookie alone can be
 * expired for a moment after the computer wakes from sleep, so the first message after it failed with a
 * 401; `getToken()` refreshes the token first. If there's no token, the cookie is left to speak for itself.
 */
function useClerkHeaders(threadId: () => string | undefined): HeadersValue {
  const { getToken } = useAuth();
  const latest = useRef({ getToken, threadId });
  latest.current = { getToken, threadId };
  return useCallback(async () => {
    const token = await latest.current.getToken().catch(() => null);
    return { ...localHeaders(latest.current.threadId()), ...(token ? { authorization: `Bearer ${token}` } : {}) };
  }, []);
}

function useLocalHeaders(threadId: () => string | undefined): HeadersValue {
  const latest = useRef(threadId);
  latest.current = threadId;
  return useCallback(() => localHeaders(latest.current()), []);
}

/**
 * Headers for every eve request. The choice is fixed at build time: ClerkProvider (and so `useAuth`) is
 * only mounted when Clerk is configured.
 */
export const useEveHeaders: (threadId: () => string | undefined) => HeadersValue = process.env
  .NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? useClerkHeaders
  : useLocalHeaders;
