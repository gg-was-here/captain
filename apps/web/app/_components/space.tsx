"use client";

import type { App } from "@captain/core/schema";
import { BotIcon, HammerIcon, RotateCwIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getDesktop } from "@/lib/client/desktop";

type SpaceApp = Pick<App, "id" | "name" | "icon" | "currentVersion">;

/** Lets anything inside a thread (e.g. the "app ready" card) open the Space. */
export const SpaceContext = createContext<{ open(app: SpaceApp): void }>({ open() {} });
export const useSpace = () => useContext(SpaceContext);

/**
 * The right-hand panel where a built app runs. In the Mac app the app is a
 * native view loaded from disk, positioned over the placeholder below; in a
 * browser it is an iframe of the web preview.
 */
export function Space({
  app,
  buildThreadId,
  onClose,
}: {
  readonly app: SpaceApp;
  readonly buildThreadId?: string | null;
  readonly onClose: () => void;
}) {
  const desktop = getDesktop();
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>();
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    if (!desktop || !hostRef.current) return;
    const host = hostRef.current;
    const bounds = () => {
      const rect = host.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
    };
    setState("loading");
    desktop
      .openSpace({ appId: app.id, version: app.currentVersion, bounds: bounds() })
      .then(() => setState("ready"))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setState("error");
      });
    const observer = new ResizeObserver(() => desktop.setSpaceBounds(bounds()));
    observer.observe(host);
    window.addEventListener("resize", () => desktop.setSpaceBounds(bounds()));
    return () => {
      observer.disconnect();
      desktop.closeSpace();
    };
  }, [desktop, app.id, app.currentVersion]);

  return (
    <section className="flex h-dvh w-[min(56vw,880px)] shrink-0 flex-col border-l bg-card">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 [-webkit-app-region:drag]">
        <span className="text-lg">{app.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-sm">{app.name}</p>
          <p className="text-muted-foreground text-xs">
            v{app.currentVersion} · {desktop ? "stored on this Mac" : "web preview"}
          </p>
        </div>
        <div className="flex items-center gap-1 [-webkit-app-region:no-drag]">
          <Button asChild size="sm" title="Ask this app's bot about its data" variant="ghost">
            <Link href={`/new?bot=app-bot&app=${app.id}`}>
              <BotIcon className="size-4" />
              <span className="hidden lg:inline">Ask app</span>
            </Link>
          </Button>
          {buildThreadId ? (
            <Button asChild size="sm" title="Change this app with Builder" variant="ghost">
              <Link href={`/t/${buildThreadId}`}>
                <HammerIcon className="size-4" />
                <span className="hidden lg:inline">Edit app</span>
              </Link>
            </Button>
          ) : null}
          <Button
            aria-label="Reload app"
            onClick={() => (desktop ? desktop.reloadSpace() : setIframeKey((k) => k + 1))}
            size="icon"
            variant="ghost"
          >
            <RotateCwIcon className="size-4" />
          </Button>
          <Button aria-label="Close" onClick={onClose} size="icon" variant="ghost">
            <XIcon className="size-4" />
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1" ref={hostRef}>
        {desktop ? (
          state === "ready" ? null : (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-muted-foreground text-sm">
              {state === "loading" ? `Installing ${app.name} on this Mac…` : `Couldn't open the app: ${error}`}
            </div>
          )
        ) : app.currentVersion > 0 ? (
          <iframe
            className="absolute inset-0 size-full bg-white"
            key={iframeKey}
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
            src={`/a/${app.id}/?v=${app.currentVersion}`}
            title={app.name}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            Builder is still working on this app…
          </div>
        )}
      </div>
    </section>
  );
}
