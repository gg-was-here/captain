"use client";

import {
  ArrowUpIcon,
  ChartColumnIcon,
  CheckCircle2Icon,
  DownloadIcon,
  ListTodoIcon,
  MicIcon,
  PanelLeftCloseIcon,
  PanelRightIcon,
  PlayIcon,
  PlusIcon,
  RotateCwIcon,
  SearchIcon,
  SettingsIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { avatarTint, BotGlyph, bubbleTint } from "@/app/_components/bot-glyph";
import { BambiiLogo } from "@/components/bambii-logo";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn, roundButton } from "@/lib/utils";

/**
 * The hero's picture: a working copy of the app's window, on made-up threads. Click a thread to open its chat;
 * an app's Launch button opens it in the side panel, where the app itself works too. Nothing leaves the page.
 */

const BAMBII = "🧭";
const BUILDER = "🛠️";

type AppId = "lily" | "inbox" | "spend";
type Message =
  | { from: "user" | "bot"; text: string }
  | { from: "app"; app: AppId }
  | { from: "saved"; text: string };

type MockThread = {
  id: string;
  title: string;
  /** The sidebar's second line. */
  preview: string;
  icon: string;
  /** Colors the avatar and bubbles, as the sidebar seeds them: the thread for Bambii, the bot (and app) otherwise. */
  seed: string;
  app?: AppId;
  messages: Message[];
};

const APPS: Record<AppId, { name: string; icon: string; version: number; description: string }> = {
  lily: {
    name: "Lily",
    icon: "🌸",
    version: 1,
    description: "A task tracker with a daily progress ring, quick add, filters and a Stats tab. Data stays on your Mac.",
  },
  inbox: {
    name: "Inbox Digest",
    icon: "📬",
    version: 3,
    description: "Everything that needs a reply across Slack and Gmail, in one list. Reads your accounts; never sends on its own.",
  },
  spend: {
    name: "Spend",
    icon: "💸",
    version: 2,
    description: "This month's spending by category, from the receipts in your Gmail.",
  },
};

const THREADS: MockThread[] = [
  {
    id: "lily",
    title: "Lily",
    preview: "Beautiful task tracker",
    icon: BUILDER,
    seed: "builder",
    app: "lily",
    messages: [
      { from: "user", text: "I want you to create an app that helps me track my tasks, show me stats, and make it beautiful" },
      { from: "app", app: "lily" },
      {
        from: "bot",
        text: "Lily is ready. It's a task tracker with a daily progress ring, quick add, filters, a project filter, and priorities and due dates. The Stats tab shows your completion rate, streak and open tasks by priority. Everything is stored on your Mac.",
      },
      { from: "user", text: "add a task to eat salads more" },
      { from: "saved", text: "Saved 1 change to the app on this device" },
      { from: "bot", text: "I added \"Eat more salads\" to Lily with medium priority and no due date. I can give it a due date or a project, like Health, if you want." },
    ],
  },
  {
    id: "inbox",
    title: "Inbox Digest",
    preview: "Your Slack and Gmail, in one list",
    icon: BAMBII,
    seed: "mock-blue-1",
    app: "inbox",
    messages: [
      { from: "user", text: "Every morning, show me what needs a reply across Slack and Gmail" },
      { from: "app", app: "inbox" },
      {
        from: "bot",
        text: "Inbox Digest pulls your Slack mentions and unread Gmail threads that ask you something, newest first. Tick one off when it's handled. I can draft replies, but I'll ask before sending anything.",
      },
    ],
  },
  {
    id: "spend",
    title: "Spend",
    preview: "Monthly spending at a glance",
    icon: BAMBII,
    seed: "mock-amber-18",
    app: "spend",
    messages: [
      { from: "user", text: "Build me something that shows where my money went this month, from my email receipts" },
      { from: "app", app: "spend" },
      { from: "bot", text: "Spend groups this month's receipts from Gmail by category. Switch months at the top to compare with October." },
    ],
  },
  {
    id: "weather",
    title: "Weather in New York",
    preview: "It's 54°F and clear in Manhattan…",
    icon: BAMBII,
    seed: "mock-weather",
    messages: [
      { from: "user", text: "how is the weather in New York right now?" },
      {
        from: "bot",
        text: "It's 54°F and clear in Manhattan, with a light breeze from the northwest. It cools to about 45°F tonight, and tomorrow looks sunny with a high of 58°F.",
      },
    ],
  },
  {
    id: "priya",
    title: "Reply to Priya",
    preview: "Here's a draft. Send it?",
    icon: BAMBII,
    seed: "mock-priya",
    messages: [
      { from: "user", text: "Priya asked in Slack if the launch deck is ready. Draft a reply saying Thursday." },
      {
        from: "bot",
        text: "Here's a draft for #launch: \"Hi Priya, the deck will be ready Thursday morning. I'll share it here as soon as it's done.\" Want me to send it? I won't post anything until you say so.",
      },
    ],
  },
];

export function HeroMock() {
  const [threadId, setThreadId] = useState(THREADS[0].id);
  // Until someone opens or closes it, the panel shows on wide windows only (in CSS, so the first paint is right).
  const [panelOpen, setPanelOpen] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"Details" | "Render">("Render");
  // Launch shows a beat of loading, like opening the real app.
  const [launching, setLaunching] = useState(false);

  const thread = THREADS.find((t) => t.id === threadId) ?? THREADS[0];
  const app = thread.app ? APPS[thread.app] : undefined;
  const bubbles = bubbleTint(thread.icon, thread.seed);

  useEffect(() => {
    if (!launching) return;
    const timer = setTimeout(() => setLaunching(false), 700);
    return () => clearTimeout(timer);
  }, [launching]);

  const open = (id: string) => {
    setThreadId(id);
    setTab("Render");
    setLaunching(false);
    // Narrow windows show the panel over the chat, so a new thread starts on its chat there.
    setPanelOpen(window.matchMedia("(min-width: 1024px)").matches);
  };

  const launch = () => {
    setPanelOpen(true);
    setTab("Render");
    setLaunching(true);
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card text-card-foreground text-sm shadow-xs">
      <div className="flex items-center gap-2 border-b bg-sidebar px-4 py-3">
        <span aria-hidden className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
        </span>
        <span className="ml-2 flex items-center gap-1.5 font-medium">
          <BambiiLogo className="size-4" title="" />
          Bambii
        </span>
        <span className="ml-auto text-muted-foreground text-xs">Click around, it works</span>
      </div>

      <div className="relative flex h-[680px] text-left sm:h-[760px]">
        <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar sm:flex">
          <div aria-hidden className="flex h-14 items-center justify-end gap-2 px-3">
            <span className={roundButton}>
              <PanelLeftCloseIcon className="size-4" />
            </span>
            <span className={roundButton}>
              <SearchIcon className="size-4" />
            </span>
            <span className={roundButton}>
              <PlusIcon className="size-4" />
            </span>
          </div>
          <div className="mx-auto flex flex-col items-center gap-1.5 pt-1 pb-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-sm">
              <BambiiLogo className="size-9" title="" />
            </span>
            <span className="font-medium text-xs">Bambii</span>
          </div>
          <nav aria-label="Threads" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
            {THREADS.map((t) => (
              <ThreadButton active={t.id === thread.id} key={t.id} onClick={() => open(t.id)} thread={t} />
            ))}
          </nav>
          <div aria-hidden className="flex items-center gap-2 p-3">
            <span className={cn(roundButton, "shrink-0")}>
              <SettingsIcon className="size-4" />
            </span>
            <span className="flex h-9 flex-1 items-center justify-center gap-2 rounded-full border bg-background font-medium shadow-xs">
              Connect apps
              <span className="flex -space-x-1 text-xs">
                <span>💬</span>
                <span>✉️</span>
                <span>📓</span>
              </span>
            </span>
          </div>
        </aside>

        <section className={cn("flex min-w-0 flex-1 flex-col", bubbles.className)} style={bubbles.style}>
          {/* Phones: the threads as a row of avatars instead of the sidebar. */}
          <nav aria-label="Threads" className="flex gap-2 overflow-x-auto border-b px-3 py-2 sm:hidden">
            {THREADS.map((t) => (
              <button
                aria-label={t.title}
                aria-pressed={t.id === thread.id}
                className={cn("shrink-0 rounded-full p-0.5", t.id === thread.id && "ring-2 ring-ring/60")}
                key={t.id}
                onClick={() => open(t.id)}
                type="button"
              >
                <Avatar className="size-9 text-lg" thread={t} />
              </button>
            ))}
          </nav>

          <header className="relative flex h-14 shrink-0 items-center justify-center px-3">
            <span className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 font-medium shadow-xs">
              <span className="text-base">
                <BotGlyph icon={thread.icon} />
              </span>
              {thread.title}
            </span>
            {app && panelOpen !== true ? (
              <button
                aria-label="Show panel"
                className={cn(roundButton, "absolute right-3", panelOpen === null && "lg:hidden")}
                onClick={() => setPanelOpen(true)}
                type="button"
              >
                <PanelRightIcon className="size-4" />
              </button>
            ) : null}
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 sm:px-6" key={thread.id}>
            {thread.messages.map((message, i) => (
              <ChatMessage key={`${thread.id}-${i}`} message={message} onLaunch={launch} />
            ))}
          </div>

          <div aria-hidden className="px-4 pb-4 sm:px-6">
            <div className="flex h-11 items-center gap-2 rounded-full border bg-background pr-1.5 pl-2 shadow-xs">
              <span className="flex size-8 items-center justify-center rounded-full text-muted-foreground">
                <PlusIcon className="size-4" />
              </span>
              <span className="flex-1 truncate text-muted-foreground">Send a message…</span>
              <MicIcon className="size-4 text-muted-foreground" />
              <span className="flex size-8 items-center justify-center rounded-full bg-emerald-600 text-white">
                <ArrowUpIcon className="size-4" />
              </span>
            </div>
          </div>
        </section>

        {app && thread.app && panelOpen !== false ? (
          <aside
            aria-label={`${app.name} panel`}
            className={cn(
              "absolute inset-y-0 right-0 z-10 flex w-full flex-col border-l bg-sidebar shadow-xl sm:w-80 lg:static lg:shadow-none",
              panelOpen === null && "max-lg:hidden",
            )}
          >
            <div className="relative flex shrink-0 flex-col items-center px-14 pt-3 text-center">
              <Avatar className="size-12 text-2xl shadow-sm" thread={thread} />
              <span className="mt-2 font-medium tracking-tight">{app.name}</span>
              <span className="mt-0.5 text-muted-foreground text-xs">Version {app.version}</span>
              <button
                aria-label="Close panel"
                className={cn(roundButton, "absolute top-2.5 right-3")}
                onClick={() => setPanelOpen(false)}
                type="button"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <div className="flex shrink-0 justify-center gap-1 px-3 py-3" role="tablist">
              {(["Details", "Render"] as const).map((t) => (
                <button
                  aria-selected={tab === t}
                  className={cn(
                    "rounded-full px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground",
                    tab === t && "bg-accent text-foreground",
                  )}
                  key={t}
                  onClick={() => setTab(t)}
                  role="tab"
                  type="button"
                >
                  {t}
                </button>
              ))}
            </div>
            {tab === "Details" ? (
              <div className="mx-4 mb-4 rounded-xl border bg-card p-4">
                <p className="mb-1 text-muted-foreground text-xs">
                  {app.icon} {app.name} · Version {app.version}
                </p>
                <p className="text-muted-foreground">{app.description}</p>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3">
                <div className="relative min-h-0 flex-1 overflow-y-auto rounded-xl border bg-background shadow-xs">
                  {launching ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
                      <Spinner className="size-4" />
                      Opening {app.name}…
                    </div>
                  ) : (
                    <MiniApp app={thread.app} />
                  )}
                </div>
                <div
                  aria-hidden
                  className="mx-auto flex shrink-0 items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-muted-foreground text-xs shadow-sm"
                >
                  <ZoomOutIcon className="size-3.5" />
                  <span className="font-medium text-foreground">75%</span>
                  <ZoomInIcon className="size-3.5" />
                  <span className="h-4 w-px bg-border" />
                  <RotateCwIcon className="size-3.5" />
                  <span className="h-4 w-px bg-border" />
                  <DownloadIcon className="size-3.5" />
                  Code
                </div>
              </div>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function Avatar({ thread, className }: { readonly thread: MockThread; readonly className?: string }) {
  const tint = avatarTint(thread.icon, thread.seed);
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full", tint.className, className)} style={tint.style}>
      <BotGlyph icon={thread.icon} />
    </span>
  );
}

function ThreadButton({ thread, active, onClick }: { readonly thread: MockThread; readonly active: boolean; readonly onClick: () => void }) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={cn("flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-accent", active && "bg-accent")}
      onClick={onClick}
      type="button"
    >
      <Avatar className="size-10 text-xl" thread={thread} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{thread.title}</span>
        <span className="block truncate text-muted-foreground text-xs">{thread.preview}</span>
      </span>
    </button>
  );
}

function ChatMessage({ message, onLaunch }: { readonly message: Message; readonly onLaunch: () => void }) {
  switch (message.from) {
    case "user":
      return (
        <p className="ml-auto max-w-[75%] rounded-[18px] bg-[color:var(--user-bubble)] px-3.5 py-2 text-[color:var(--user-bubble-fg)]">
          {message.text}
        </p>
      );
    case "bot":
      return <p className="max-w-[85%] rounded-[18px] bg-[color:var(--bot-bubble)] px-3.5 py-2 leading-6">{message.text}</p>;
    case "saved":
      return (
        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <CheckCircle2Icon className="size-3.5 text-emerald-600" />
          {message.text}
        </p>
      );
    case "app": {
      const app = APPS[message.app];
      return (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xl">{app.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{app.name}</p>
            <p className="truncate text-muted-foreground text-xs">Version {app.version} is ready to run on your Mac</p>
          </div>
          <Button onClick={onLaunch} size="sm">
            <PlayIcon className="size-3.5" />
            Launch
          </Button>
        </div>
      );
    }
  }
}

function MiniApp({ app }: { readonly app: AppId }) {
  switch (app) {
    case "lily":
      return <LilyApp />;
    case "inbox":
      return <InboxApp />;
    case "spend":
      return <SpendApp />;
  }
}

function LilyApp() {
  const [view, setView] = useState<"Tasks" | "Stats">("Tasks");
  const [tasks, setTasks] = useState([
    { title: "Eat more salads", priority: "Medium", dot: "bg-amber-400", done: false },
    { title: "Send launch deck to Priya", priority: "High", dot: "bg-rose-500", done: false },
    { title: "Book dentist", priority: "Low", dot: "bg-sky-400", done: true },
  ]);
  const done = tasks.filter((t) => t.done).length;
  const percent = Math.round((done / tasks.length) * 100);
  return (
    <div className="p-3 text-xs">
      <div className="flex items-center gap-3">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-full font-semibold text-[11px] transition-[background] duration-500"
          style={{ background: `conic-gradient(var(--color-rose-500) ${percent}%, var(--color-rose-100) 0)` }}
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-background">{percent}%</span>
        </span>
        <div>
          <p className="font-semibold text-[10px] text-rose-600 uppercase tracking-wide">Today</p>
          <p className="font-semibold text-base tracking-tight">Good afternoon 🌸</p>
          <p className="text-muted-foreground">
            {tasks.length - done} open task{tasks.length - done === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <Segmented onChange={setView} options={["Tasks", "Stats"]} value={view} />
      {view === "Tasks" ? (
        <ul className="mt-3 space-y-1.5">
          {tasks.map((task, i) => (
            <li key={task.title}>
              <button
                className="flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-accent"
                onClick={() => setTasks((all) => all.map((t, j) => (j === i ? { ...t, done: !t.done } : t)))}
                type="button"
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-rose-300",
                    task.done && "border-rose-500 bg-rose-500 text-white",
                  )}
                >
                  {task.done ? "✓" : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate font-medium", task.done && "text-muted-foreground line-through")}>
                    {task.title}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className={cn("size-1.5 rounded-full", task.dot)} />
                    {task.priority}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Completion" value={`${percent}%`} />
          <Stat label="Streak" value="4 days" />
          <Stat label="This week" value="+3 vs last" />
          <Stat label="Overdue" value="0" />
        </div>
      )}
    </div>
  );
}

function InboxApp() {
  const [items, setItems] = useState([
    { source: "💬", who: "Priya · #launch", text: "Is the launch deck ready for review?", done: false },
    { source: "✉️", who: "Sam Lee", text: "Can we move Thursday's call to 3pm?", done: false },
    { source: "💬", who: "Alex · DM", text: "Quick look at the pricing copy?", done: false },
    { source: "✉️", who: "Landlord", text: "Lease renewal: please confirm by Friday", done: false },
  ]);
  const open = items.filter((item) => !item.done).length;
  return (
    <div className="p-3 text-xs">
      <p className="font-semibold text-base tracking-tight">Needs a reply</p>
      <p className="text-muted-foreground">{open === 0 ? "All caught up 🎉" : `${open} waiting on you`}</p>
      <ul className="mt-3 space-y-1.5">
        {items.map((item, i) => (
          <li key={item.text}>
            <button
              className={cn(
                "flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all hover:bg-accent",
                item.done && "opacity-50",
              )}
              onClick={() => setItems((all) => all.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
              type="button"
            >
              <span className="text-sm">{item.source}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.who}</span>
                <span className={cn("block text-muted-foreground", item.done && "line-through")}>{item.text}</span>
              </span>
              {item.done ? <CheckCircle2Icon className="size-3.5 shrink-0 text-emerald-600" /> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SPENDING = {
  Oct: [
    { category: "Groceries", amount: 412 },
    { category: "Dining out", amount: 286 },
    { category: "Transport", amount: 148 },
    { category: "Subscriptions", amount: 64 },
  ],
  Nov: [
    { category: "Groceries", amount: 198 },
    { category: "Dining out", amount: 121 },
    { category: "Transport", amount: 74 },
    { category: "Subscriptions", amount: 64 },
  ],
} as const;

function SpendApp() {
  const [month, setMonth] = useState<keyof typeof SPENDING>("Nov");
  const rows = SPENDING[month];
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const max = Math.max(...SPENDING.Oct.map((row) => row.amount));
  return (
    <div className="p-3 text-xs">
      <Segmented onChange={setMonth} options={["Oct", "Nov"]} value={month} />
      <p className="mt-3 text-muted-foreground">{month === "Nov" ? "November so far" : "October"}</p>
      <p className="font-semibold text-2xl tracking-tight">${total.toLocaleString("en-US")}</p>
      <ul className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <li key={row.category}>
            <div className="flex justify-between">
              <span>{row.category}</span>
              <span className="text-muted-foreground tabular-nums">${row.amount}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                style={{ width: `${(row.amount / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  readonly options: readonly T[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}) {
  const icons: Partial<Record<string, ReactNode>> = {
    Tasks: <ListTodoIcon className="size-3.5" />,
    Stats: <ChartColumnIcon className="size-3.5" />,
  };
  return (
    <div className="mt-3 flex gap-1 rounded-lg bg-muted p-1">
      {options.map((option) => (
        <button
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 font-medium text-muted-foreground transition-colors",
            option === value && "bg-background text-foreground shadow-xs",
          )}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {icons[option]}
          {option}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold text-sm">{value}</p>
    </div>
  );
}
