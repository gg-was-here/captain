import { Check, Rocket, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { BambiiLogo } from "@/components/bambii-logo";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { avatarColor, cn, fawnStyle } from "@/lib/utils";

/** The fawn a demo chat is tinted with; a fixed seed so the page looks the same on every load. */
const DEMO_SEED = "home-demo";

/** A section's eyebrow, heading and lead, in the same type scale as the legal pages. */
export function SectionHeading({ eyebrow, title, lead }: { readonly eyebrow: string; readonly title: string; readonly lead?: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="font-medium text-muted-foreground text-xs uppercase tracking-widest">{eyebrow}</p>
      <h2 className="mt-3 text-balance font-semibold text-3xl tracking-tight sm:text-4xl">{title}</h2>
      {lead ? <p className="mt-4 text-pretty text-[15px] text-muted-foreground leading-7">{lead}</p> : null}
    </div>
  );
}

/** A white elevated surface, like the composer and cards in the app. */
export function Card({ className, children }: { readonly className?: string; readonly children: ReactNode }) {
  return <div className={cn("rounded-xl border bg-card text-card-foreground shadow-xs", className)}>{children}</div>;
}

/** An emoji in its soft pastel circle, as apps appear in the sidebar. */
export function AppAvatar({ icon, seed, className }: { readonly icon: string; readonly seed: string; readonly className?: string }) {
  return (
    <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-lg", avatarColor(seed), className)}>
      {icon}
    </span>
  );
}

function Bubble({ from, children }: { readonly from: "user" | "bot"; readonly children: ReactNode }) {
  return from === "user" ? (
    <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-(--user-bubble) px-3.5 py-2 text-(--user-bubble-fg) text-sm">
      {children}
    </div>
  ) : (
    <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-(--bot-bubble) px-3.5 py-2 text-sm">{children}</div>
  );
}

const DEMO_TASKS = [
  { title: "Reply to Priya about the Q4 launch doc", source: "#launch", done: true },
  { title: "Review the pricing page copy", source: "#marketing", done: false },
  { title: "Send the onboarding checklist to Sam", source: "DM · Sam", done: false },
  { title: "Book the offsite venue", source: "#team", done: false },
];

/** The hero's picture: a Bambii chat on the left that builds the app open in the Space on the right. */
export function HeroDemo() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="fawn-bubble flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs" style={fawnStyle(DEMO_SEED)}>
        <div className="flex items-center gap-2.5 border-b px-4 py-3">
          <span className="fawn-avatar flex size-7 items-center justify-center rounded-full" style={fawnStyle(DEMO_SEED)}>
            <BambiiLogo className="size-4" title="" />
          </span>
          <span className="font-medium text-sm">Bambii</span>
          <span className="ml-auto text-muted-foreground text-xs">Builder</span>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <Bubble from="user">Build a task tracker from my Slack messages</Bubble>
          <Bubble from="bot">
            I read the last two weeks of your Slack and found 14 things people asked you to do. Building a tracker that keeps
            them in sync…
          </Bubble>
          <div className="flex items-center gap-2 px-1 text-muted-foreground text-xs">
            <Loader className="flex-row" size="sm" />
            <span>Writing components · type-checking · packaging</span>
          </div>
          <div className="mt-auto flex items-center gap-3 rounded-xl border bg-card p-3">
            <AppAvatar icon="✅" seed="Slack Tasks" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">Slack Tasks</p>
              <p className="truncate text-muted-foreground text-xs">Version 1 · ready</p>
            </div>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 font-medium text-primary-foreground text-sm">
              <Rocket className="size-3.5" />
              Launch
            </span>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-sidebar px-4 py-3">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-foreground/15" />
            <span className="size-2.5 rounded-full bg-foreground/15" />
            <span className="size-2.5 rounded-full bg-foreground/15" />
          </span>
          <span className="ml-2 font-medium text-sm">Slack Tasks</span>
          <span className="ml-auto flex gap-1.5">
            <Badge variant="outline">Ask app</Badge>
            <Badge variant="outline">Edit app</Badge>
          </span>
        </div>
        <div className="p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs">This week</p>
              <p className="mt-1 font-semibold text-2xl tracking-tight">3 open · 1 done</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-700 text-xs dark:text-emerald-300">
              <Sparkles className="size-3" /> Synced from Slack
            </span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/4 rounded-full bg-primary" />
          </div>
          <ul className="mt-5 divide-y rounded-lg border">
            {DEMO_TASKS.map((task) => (
              <li className="flex items-center gap-3 px-3 py-2.5" key={task.title}>
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-[5px] border",
                    task.done && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {task.done ? <Check className="size-3" /> : null}
                </span>
                <span className={cn("min-w-0 flex-1 truncate text-sm", task.done && "text-muted-foreground line-through")}>{task.title}</span>
                <span className="hidden shrink-0 font-mono text-muted-foreground text-xs sm:inline">{task.source}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
