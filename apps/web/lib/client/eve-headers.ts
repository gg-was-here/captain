"use client";

import { useAuth } from "@clerk/nextjs";
import type { HeadersValue } from "eve/client";
import { useCallback, useRef } from "react";

/** The browser's time zone, so bots work out the user's "today" (see `instructions/today.ts`). */
const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const localHeaders = (): Record<string, string> => ({ "x-captain-time-zone": timeZone() });

/**
 * With Clerk, every request also carries a fresh session token. The `__session` cookie alone can be
 * expired for a moment after the computer wakes from sleep, so the first message after it failed with a
 * 401; `getToken()` refreshes the token first. If there's no token, the cookie is left to speak for itself.
 */
function useClerkHeaders(): HeadersValue {
  const { getToken } = useAuth();
  const latest = useRef(getToken);
  latest.current = getToken;
  return useCallback(async () => {
    const token = await latest.current().catch(() => null);
    return { ...localHeaders(), ...(token ? { authorization: `Bearer ${token}` } : {}) };
  }, []);
}

/**
 * Headers for every eve request. The choice is fixed at build time: ClerkProvider (and so `useAuth`) is
 * only mounted when Clerk is configured.
 */
export const useEveHeaders: () => HeadersValue = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? useClerkHeaders
  : () => localHeaders;
