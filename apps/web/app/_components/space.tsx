"use client";

import type { App } from "@captain/core/schema";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { serveAppBridge } from "@/lib/client/app-bridge";
import { desktopErrorText, useDesktop } from "@/lib/client/desktop";

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
  const desktop = useDesktop();
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>();
  // Bumped when the web preview's frame leaves the app, so it is replaced with a fresh one.
  const [frameKey, setFrameKey] = useState(0);
  const [link, setLink] = useState<string>();
  // Bumped by "Try again" when the Mac app couldn't install or open the app.
  const [attempt, setAttempt] = useState(0);

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
        setError(desktopErrorText(e));
        setState("error");
      });
    // Watch ancestors too: the side panel animates its width open while this box keeps its size,
    // so the box moves without resizing and the native view would stay where it first opened.
    const observer = new ResizeObserver(onResize);
    for (let el: HTMLElement | null = host; el; el = el.parentElement) observer.observe(el);
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      desktop.closeSpace();
    };
  }, [desktop, app.id, app.currentVersion, attempt]);

  useEffect(() => {
    if (desktop && reloadKey > 0) desktop.reloadSpace();
  }, [desktop, reloadKey]);

  useEffect(() => {
    if (desktop !== null || !frameRef.current) return;
    return serveAppBridge(frameRef.current, app, {
      onLeft: () => setFrameKey((key) => key + 1),
      onOpenLink: setLink,
    });
  }, [desktop, app.id, app.name, app.currentVersion, reloadKey, frameKey]);

  return (
    <div className="relative size-full" ref={hostRef}>
      {desktop === undefined ? null : desktop ? (
        state === "ready" ? null : state === "loading" ? (
          <Placeholder>{`Installing ${app.name} on this Mac…`}</Placeholder>
        ) : (
          <Placeholder>
            <span className="flex flex-col items-center gap-3">
              <span>{`Couldn't open the app: ${error}`}</span>
              <Button onClick={() => setAttempt((n) => n + 1)} size="sm" variant="outline">
                Try again
              </Button>
            </span>
          </Placeholder>
        )
      ) : app.currentVersion > 0 ? (
        <>
          <iframe
            className="absolute inset-0 size-full bg-white"
            key={`${reloadKey}:${frameKey}`}
            ref={frameRef}
            sandbox="allow-scripts allow-forms allow-modals"
            src={`/a/${app.id}/?v=${app.currentVersion}`}
            title={app.name}
          />
          {link ? <OpenLink app={app.name} link={link} onDone={() => setLink(undefined)} /> : null}
        </>
      ) : (
        <Placeholder>Builder is still working on this app…</Placeholder>
      )}
    </div>
  );
}

/** A link the app wants opened, shown in full; the user's own click on Open opens it in a new tab. */
function OpenLink({ app, link, onDone }: { readonly app: string; readonly link: string; readonly onDone: () => void }) {
  return (
    <div className="absolute inset-x-3 bottom-3 z-10 rounded-xl border bg-background p-3 text-sm shadow-lg">
      <p className="font-medium">{app} wants to open a link</p>
      <p className="mt-1 max-h-24 overflow-y-auto break-all text-muted-foreground text-xs">{link}</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button onClick={onDone} size="sm" variant="outline">
          Cancel
        </Button>
        <Button asChild size="sm">
          <a href={link} onClick={onDone} rel="noopener noreferrer" target="_blank">
            Open
          </a>
        </Button>
      </div>
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
