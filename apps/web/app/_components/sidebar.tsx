"use client";

import { SYSTEM_BOTS } from "@captain/core/bots";
import type { App, Thread } from "@captain/core/schema";
import { PanelLeftCloseIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BambiiLogo } from "@/components/bambii-logo";
import { Loader } from "@/components/ui/loader";
import { Spinner } from "@/components/ui/spinner";
import { api, errorText } from "@/lib/client/api";
import { onRefreshSidebar } from "@/lib/client/events";
import { useIsMobile } from "@/lib/client/use-mobile";
import { cn, roundButton } from "@/lib/utils";
import { NewThreadMenu } from "./new-thread-dialog";
import { useSidebar } from "./sidebar-state";
import { avatarBackground, BotGlyph } from "./bot-glyph";

const botByAgent = new Map(SYSTEM_BOTS.map((bot) => [bot.agent, bot]));

/** Longest last-message snippet shown under a thread's title. */
const PREVIEW_CHARS = 40;

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, drawerOpen, toggle, closeDrawer } = useSidebar();
  const mobile = useIsMobile();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [initials, setInitials] = useState("");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState<string>();
  // Until the first load settles, an empty list means "not here yet", not "no chats".
  const [loaded, setLoaded] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // A failed refresh keeps the lists already shown rather than emptying them.
  const load = useCallback(async () => {
    try {
      const [t, a] = await Promise.all([
        api("/api/threads", undefined, "Couldn't load your chats.").then((r) => r.json()),
        api("/api/apps", undefined, "Couldn't load your apps.").then((r) => r.json()),
      ]);
      setThreads(t.threads);
      setApps(a.apps);
      setError(undefined);
    } catch (e) {
      setError(errorText(e, "Couldn't load your chats."));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
    void fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((body) => {
        const name: string = body?.user?.name ?? body?.user?.email ?? "Me";
        setInitials(
          name
            .split(/[\s@.]+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join(""),
        );
      });
    return onRefreshSidebar(() => void load());
  }, [load]);

  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  const appById = new Map(apps.map((app) => [app.id, app]));
  // Apps arrive most recently updated first, so a Builder thread maps to the latest app it
  // built. An app's threadId is the session id of the thread that built it.
  const appByBuildThread = new Map<string, App>();
  for (const app of apps) if (app.threadId && !appByBuildThread.has(app.threadId)) appByBuildThread.set(app.threadId, app);
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? threads.filter((t) => `${t.title} ${t.preview}`.toLowerCase().includes(needle))
    : threads;

  const deleteThread = async (thread: Thread) => {
    if (deleting) return;
    const kept = thread.agent === "builder" ? " Apps it built are kept." : "";
    if (!window.confirm(`Delete "${thread.title}"? Its messages are deleted too and can't be recovered.${kept}`)) return;
    setDeleting(thread.id);
    setError(undefined);
    try {
      await api(`/api/threads/${thread.id}`, { method: "DELETE" }, "Couldn't delete this chat.");
      // A chat started on this page moves to /t/<id> without the router knowing, so ask the browser,
      // and load /new afresh so nothing of the deleted chat stays on screen.
      if (window.location.pathname === `/t/${thread.id}`) {
        window.location.assign("/new");
        return;
      }
      await load();
    } catch (e) {
      setError(errorText(e, "Couldn't delete this chat."));
    } finally {
      setDeleting(undefined);
    }
  };

  return (
    <>
      {drawerOpen ? (
        <div aria-hidden className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={closeDrawer} />
      ) : null}
      <aside
        className={cn(
          "flex h-dvh w-72 shrink-0 flex-col border-r bg-sidebar text-sm [-webkit-app-region:drag]",
          // Tablets and narrow windows: a little narrower, leaving the chat more room.
          "md:max-lg:w-64",
          // Wide screens: slides out of the row when collapsed, and the page widens to fill it.
          "md:transition-[margin] md:duration-200 md:ease-out",
          collapsed && "md:-ml-72 md:max-lg:-ml-64",
          // Phones: a drawer over the page, off screen until opened.
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-[85vw] max-md:max-w-72 max-md:transition-transform max-md:duration-200 max-md:ease-out",
          drawerOpen ? "max-md:translate-x-0 max-md:shadow-xl" : "max-md:-translate-x-full",
        )}
        // Out of the tab order while it's off screen.
        inert={mobile === undefined ? undefined : mobile ? !drawerOpen : collapsed}
      >
        {/* Leaves room for the macOS traffic lights in the frameless desktop window. */}
        <div className="flex h-14 items-center justify-end gap-2 px-3 [-webkit-app-region:no-drag]">
          <button
            aria-label="Hide sidebar"
            className={roundButton}
            onClick={toggle}
            title="Hide sidebar (⌘B)"
            type="button"
          >
            <PanelLeftCloseIcon className="size-4" />
          </button>
          <button
            aria-label="Search threads"
            className={roundButton}
            onClick={() => {
              setSearching((s) => !s);
              setQuery("");
            }}
            type="button"
          >
            {searching ? <XIcon className="size-4" /> : <SearchIcon className="size-4" />}
          </button>
          <NewThreadMenu className={roundButton} />
        </div>

        {searching ? (
          <div className="px-3 pb-2 [-webkit-app-region:no-drag]">
            <input
              className="h-9 w-full rounded-full border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setSearching(false)}
              placeholder="Search threads"
              ref={searchRef}
              value={query}
            />
          </div>
        ) : (
          <Link
            className="mx-auto flex flex-col items-center gap-1.5 pt-1 pb-4 [-webkit-app-region:no-drag]"
            href="/new"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-sm">
              <BambiiLogo className="size-9" title="" />
            </span>
            <span className="font-medium text-xs">Bambii</span>
          </Link>
        )}

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3 [-webkit-app-region:no-drag]">
          {error ? (
            <div className="mx-1 mb-2 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-xs" role="alert">
              <span className="min-w-0 flex-1">{error}</span>
              <button className="shrink-0 font-medium underline" onClick={() => void load()} type="button">
                Retry
              </button>
            </div>
          ) : null}
          {!loaded ? (
            <Loader className="py-10" size="sm" />
          ) : visible.length === 0 ? (
            <p className="px-3 py-6 text-center text-muted-foreground text-xs">
              {needle ? "No threads match." : "Start a chat with the + button."}
            </p>
          ) : (
            visible.map((thread) => {
              const app = thread.appId ? appById.get(thread.appId) : undefined;
              const tagline = (app ?? (thread.sessionId ? appByBuildThread.get(thread.sessionId) : undefined))?.tagline;
              const icon =
                thread.agent === "app-bot" ? (app?.icon ?? "✨") : (botByAgent.get(thread.agent)?.icon ?? "💬");
              const active = pathname === `/t/${thread.id}`;
              return (
                <div className="group relative" key={thread.id}>
                  <Link
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-accent",
                      active && "bg-accent",
                    )}
                    href={`/t/${thread.id}`}
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full text-xl",
                        avatarBackground(icon, thread.agent + (thread.appId ?? "")),
                      )}
                    >
                      <BotGlyph icon={icon} />
                    </span>
                    <span className="min-w-0 flex-1 pr-5">
                      <span className="block truncate font-medium">{thread.title}</span>
                      <span className="block truncate text-muted-foreground text-xs">
                        {tagline || (thread.preview ? clip(thread.preview, PREVIEW_CHARS) : "No messages yet")}
                      </span>
                    </span>
                  </Link>
                  <button
                    aria-label="Delete thread"
                    className={cn(
                      "absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-destructive group-hover:block pointer-coarse:block",
                      deleting === thread.id ? "block" : "hidden",
                    )}
                    disabled={deleting !== undefined}
                    onClick={() => void deleteThread(thread)}
                    type="button"
                  >
                    {deleting === thread.id ? <Spinner className="size-3.5" /> : <Trash2Icon className="size-3.5" />}
                  </button>
                </div>
              );
            })
          )}
        </nav>

        <div className="flex items-center gap-2 p-3 [-webkit-app-region:no-drag]">
          <Link
            aria-label="Settings"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full border bg-background font-medium text-xs transition-colors hover:bg-accent",
              pathname === "/settings" && "bg-accent",
            )}
            href="/settings"
            title="Settings"
          >
            {initials}
          </Link>
          <Link
            className={cn(
              "flex h-9 flex-1 items-center justify-center gap-2 rounded-full border bg-background font-medium shadow-xs transition-colors hover:bg-accent",
              pathname === "/settings" && "bg-accent",
            )}
            href="/settings"
          >
            Connect apps
            <span className="flex -space-x-1 text-xs">
              <span>💬</span>
              <span>✉️</span>
              <span>📓</span>
            </span>
          </Link>
        </div>
      </aside>
    </>
  );
}
