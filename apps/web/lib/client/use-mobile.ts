"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Below Tailwind's `md`: the sidebar is a drawer and the side panel a full-screen sheet. */
export const MOBILE_QUERY = "(max-width: 767px)";
/** Below Tailwind's `lg`: too narrow for the chat and the side panel side by side, so the panel floats over the chat. */
export const COMPACT_QUERY = "(max-width: 1023px)";

export function matchesNow(query: string): boolean {
  return window.matchMedia(query).matches;
}

export const isMobileNow = () => matchesNow(MOBILE_QUERY);

/** Whether the media query matches; undefined during the server render, before it can be known. */
export function useMediaQuery(query: string): boolean | undefined {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => matchesNow(query), () => undefined);
}

export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);
