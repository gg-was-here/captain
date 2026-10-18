"use client";

import type { App } from "@captain/core/schema";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getDesktop } from "@/lib/client/desktop";

export type SpaceApp = Pick<App, "id" | "name" | "icon" | "description" | "currentVersion">;

/** Lets anything inside a thread (e.g. the "app ready" card) open the app in the side panel. */
export const SpaceContext = createContext<{ open(app: SpaceApp): void }>({ open() {} });
export const useSpace = () => useContext(SpaceContext);

/**
 * Where a built app runs, inside the side panel's phone frame. In the Mac app
 * the app is a native view loaded from disk, positioned over the placeholder
 * below; in a browser it is an iframe of the web preview. Bump `reloadKey` to
 * reload the app.
 */
export function AppRender({ app, reloadKey = 0 }: { readonly app: SpaceApp; readonly reloadKey?: number }) {
  const desktop = getDesktop();
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!desktop || !hostRef.current) return;
    const host = hostRef.current;
    const bounds = () => {
      const rect = host.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
    };
    const onResize = () => desktop.setSpaceBounds(bounds());
    setState("loading");
    desktop
      .openSpace({ appId: app.id, version: app.currentVersion, bounds: bounds() })
      .then(() => setState("ready"))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setState("error");
      });
    const observer = new ResizeObserver(onResize);
    observer.observe(host);
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      desktop.closeSpace();
    };
  }, [desktop, app.id, app.currentVersion]);

  useEffect(() => {
    if (desktop && reloadKey > 0) desktop.reloadSpace();
  }, [desktop, reloadKey]);

  return (
    <div className="relative size-full" ref={hostRef}>
      {desktop ? (
        state === "ready" ? null : (
          <Placeholder>{state === "loading" ? `Installing ${app.name} on this Mac…` : `Couldn't open the app: ${error}`}</Placeholder>
        )
      ) : app.currentVersion > 0 ? (
        <iframe
          className="absolute inset-0 size-full bg-white"
          key={reloadKey}
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
          src={`/a/${app.id}/?v=${app.currentVersion}`}
          title={app.name}
        />
      ) : (
        <Placeholder>Builder is still working on this app…</Placeholder>
      )}
    </div>
  );
}

function Placeholder({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-muted-foreground text-sm">
      {children}
    </div>
  );
}
