"use client";

import { SYSTEM_BOTS } from "@captain/core/bots";
import type { App, Thread } from "@captain/core/schema";
import { SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { onRefreshSidebar } from "@/lib/client/events";
import { avatarColor, cn, roundButton } from "@/lib/utils";
import { NewThreadMenu } from "./new-thread-dialog";

const botByAgent = new Map(SYSTEM_BOTS.map((bot) => [bot.agent, bot]));

/** Longest last-message snippet shown under a thread's title. */
const PREVIEW_CHARS = 40;

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [initials, setInitials] = useState("");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [t, a] = await Promise.all([
      fetch("/api/threads").then((r) => (r.ok ? r.json() : { threads: [] })),
      fetch("/api/apps").then((r) => (r.ok ? r.json() : { apps: [] })),
    ]);
    setThreads(t.threads);
    setApps(a.apps);
  }, []);

  useEffect(() => {
    void load();
    void fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
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
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? threads.filter((t) => `${t.title} ${t.preview}`.toLowerCase().includes(needle))
    : threads;

  const deleteThread = async (id: string) => {
    await fetch(`/api/threads/${id}`, { method: "DELETE" });
    if (pathname === `/t/${id}`) router.push("/new");
    void load();
  };

  return (
    <aside className="flex h-dvh w-72 shrink-0 flex-col border-r bg-sidebar text-sm [-webkit-app-region:drag]">
      {/* Leaves room for the macOS traffic lights in the frameless desktop window. */}
      <div className="flex h-14 items-center justify-end gap-2 px-3 [-webkit-app-region:no-drag]">
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
          <span className="flex size-14 items-center justify-center rounded-full bg-foreground text-3xl shadow-sm">
            🧭
          </span>
          <span className="font-medium text-xs">Captain</span>
        </Link>
      )}

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3 [-webkit-app-region:no-drag]">
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-center text-muted-foreground text-xs">
            {needle ? "No threads match." : "Start a chat with the + button."}
          </p>
        ) : (
          visible.map((thread) => {
            const app = thread.appId ? appById.get(thread.appId) : undefined;
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
                      avatarColor(thread.agent + (thread.appId ?? "")),
                    )}
                  >
                    {icon}
                  </span>
                  <span className="min-w-0 flex-1 pr-5">
                    <span className="block truncate font-medium">{thread.title}</span>
                    <span className="block truncate text-muted-foreground text-xs">
                      {thread.preview ? clip(thread.preview, PREVIEW_CHARS) : "No messages yet"}
                    </span>
                  </span>
                </Link>
                <button
                  aria-label="Delete thread"
                  className="absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-destructive group-hover:block"
                  onClick={() => void deleteThread(thread.id)}
                  type="button"
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>
            );
          })
        )}
      </nav>

      <div className="flex items-center gap-2 p-3 [-webkit-app-region:no-drag]">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-background font-medium text-xs">
          {initials}
        </span>
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
  );
}
