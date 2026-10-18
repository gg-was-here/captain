"use client";

import { BotIcon, FileTextIcon, HammerIcon, MonitorIcon, RotateCwIcon, SmartphoneIcon, XIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getDesktop } from "@/lib/client/desktop";
import { avatarColor, cn, roundButton } from "@/lib/utils";
import type { ChatBot } from "./agent-chat";
import { AppRender, type SpaceApp } from "./space";

/** Just wide enough for the About form and an A4 preview; the phone preview sizes itself to the height. */
const PANEL_WIDTH = 340;

/**
 * The thread's right-hand panel, styled as a mirror of the sidebar. Message
 * threads show the bot's About (with extra instructions for this thread) and
 * its computer screen; application threads show a description and the app in
 * a phone frame.
 */
export function ThreadPanel({
  kind,
  bot,
  app,
  title,
  avatarSeed,
  threadId,
  buildThreadId,
  instructions,
  onInstructionsChange,
  computerStreamUrl,
  onClose,
}: {
  readonly kind: "message" | "application";
  readonly bot: ChatBot;
  /** The thread's built app; null for message threads and apps Builder hasn't finished. */
  readonly app: SpaceApp | null;
  readonly title?: string;
  /** Same seed the sidebar uses, so the avatar color matches the thread's row. */
  readonly avatarSeed: string;
  readonly threadId: string | null;
  readonly buildThreadId?: string | null;
  readonly instructions: string;
  readonly onInstructionsChange: (instructions: string) => void;
  /** Live view of the computer the bot is using, once computer use exists. */
  readonly computerStreamUrl?: string;
  readonly onClose: () => void;
}) {
  const icon = app?.icon ?? bot.icon;
  const name = app?.name ?? title ?? bot.name;
  const tabs = kind === "application" ? (["Details", "Render"] as const) : (["About", "Computer"] as const);
  // Application threads open on the app itself; message threads on About.
  const [tab, setTab] = useState<(typeof tabs)[number]>(kind === "application" ? "Render" : "About");
  return (
    <motion.aside
      animate={{ width: PANEL_WIDTH }}
      className="h-dvh shrink-0 overflow-hidden border-l bg-background text-sm [-webkit-app-region:drag]"
      initial={{ width: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="relative flex h-dvh flex-col" style={{ width: PANEL_WIDTH }}>
        {/* Room on both sides for the close button, so the avatar and name stay centered. */}
        <div className="flex shrink-0 flex-col items-center px-14 pt-3 text-center">
          <span
            className={cn(
              "flex size-12 items-center justify-center rounded-full text-2xl shadow-sm",
              avatarColor(avatarSeed),
            )}
          >
            {icon}
          </span>
          <span className="mt-2 max-w-full truncate font-medium text-base tracking-tight">{name}</span>
          <span className="mt-0.5 max-w-full truncate text-muted-foreground text-xs">
            {app ? `Version ${app.currentVersion}` : name === bot.name ? bot.tagline : bot.name}
          </span>
        </div>

        {/* After the header, which inherits the panel's drag region: Electron resolves regions in DOM order. */}
        <button
          aria-label="Close panel"
          className={cn(roundButton, "absolute top-2.5 right-3 z-10 [-webkit-app-region:no-drag]")}
          onClick={onClose}
          type="button"
        >
          <XIcon className="size-4" />
        </button>

        <div className="flex shrink-0 justify-center gap-1 px-3 pt-3 pb-3 [-webkit-app-region:no-drag]" role="tablist">
          {tabs.map((t) => (
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

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 [-webkit-app-region:no-drag]">
          {tab === "About" ? (
            <ContextPane
              bot={bot}
              description={bot.tagline}
              instructions={instructions}
              onInstructionsChange={onInstructionsChange}
              threadId={threadId}
            />
          ) : tab === "Computer" ? (
            <ComputerSection botName={bot.name} streamUrl={computerStreamUrl} />
          ) : (
            <ApplicationSections
              app={app}
              bot={bot}
              buildThreadId={buildThreadId}
              instructions={instructions}
              onInstructionsChange={onInstructionsChange}
              tab={tab}
              threadId={threadId}
            />
          )}
        </div>
      </div>
    </motion.aside>
  );
}

/** A tab's content: a surface with a small centered caption underneath. */
function Pane({
  caption,
  fill,
  children,
}: {
  readonly caption?: string;
  /** Stretch to the panel's remaining height (for the Render preview). */
  readonly fill?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-3", fill && "min-h-0 flex-1")} role="tabpanel">
      {children}
      {caption ? <p className="text-center text-muted-foreground text-xs">{caption}</p> : null}
    </section>
  );
}

const card = "rounded-2xl bg-card shadow-xs";

/** Context the user adds to this thread's prompts, editable in both About and Details. */
type ThreadContext = {
  readonly threadId: string | null;
  readonly instructions: string;
  readonly onInstructionsChange: (instructions: string) => void;
};

/**
 * A description of the bot or app, the editable instructions box, and optional actions.
 * The instructions are sent as context with every message in this thread.
 */
function ContextPane({
  bot,
  description,
  meta,
  actions,
  threadId,
  instructions,
  onInstructionsChange,
}: ThreadContext & {
  readonly bot: ChatBot;
  readonly description: string;
  readonly meta?: string;
  readonly actions?: React.ReactNode;
}) {
  const [draft, setDraft] = useState(instructions);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = draft.trim() !== instructions.trim();

  const save = async () => {
    const next = draft.trim();
    // A thread that hasn't started yet saves these with its first message.
    if (threadId) {
      setStatus("saving");
      const response = await fetch(`/api/threads/${threadId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instructions: next }),
      }).catch(() => null);
      if (!response?.ok) {
        setStatus("error");
        return;
      }
    }
    onInstructionsChange(next);
    setDraft(next);
    setStatus("saved");
  };

  return (
    <Pane caption="Added to every message in this thread.">
      <div className={cn(card, "divide-y")}>
        <div className="p-4">
          {meta ? <p className="mb-1 text-muted-foreground text-xs">{meta}</p> : null}
          <p className="text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <span className="font-medium">Instructions</span>
          <textarea
            className="field-sizing-content max-h-60 min-h-24 w-full resize-none rounded-lg border bg-background px-3 py-2 outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
            maxLength={4000}
            onChange={(e) => {
              setDraft(e.target.value);
              setStatus("idle");
            }}
            placeholder={`Anything ${bot.name} should know or always do…`}
            value={draft}
          />
          <div className="flex items-center justify-end gap-3">
            <span className="text-muted-foreground text-xs">
              {status === "saving"
                ? "Saving…"
                : status === "saved"
                  ? threadId
                    ? "Saved"
                    : "Saved with your first message"
                  : status === "error"
                    ? "Couldn't save. Try again."
                    : null}
            </span>
            <Button
              className="rounded-full"
              disabled={!dirty || status === "saving"}
              onClick={() => void save()}
              size="sm"
            >
              Save
            </Button>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2 p-3">{actions}</div> : null}
      </div>
    </Pane>
  );
}

/** Floating status pill, the same shape as the chat header's. */
function StatusPill({ live, children }: { readonly live: boolean; readonly children: React.ReactNode }) {
  return (
    <span className="absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-full border bg-background/90 px-2.5 py-1 text-[11px] font-medium shadow-sm backdrop-blur-md">
      <span className={cn("size-1.5 rounded-full", live ? "bg-emerald-500" : "bg-muted-foreground/40")} />
      {children}
    </span>
  );
}

function EmptyState({ icon: Icon, children }: { readonly icon: typeof MonitorIcon; readonly children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground text-xs">
      <Icon className="size-5" />
      {children}
    </div>
  );
}

function ComputerSection({ botName, streamUrl }: { readonly botName: string; readonly streamUrl?: string }) {
  return (
    <Pane caption={`${botName}'s screen`}>
      <div className={cn(card, "relative aspect-[16/10] w-full overflow-hidden")}>
        {streamUrl ? (
          <>
            <StatusPill live>Live</StatusPill>
            <iframe className="absolute inset-0 size-full" src={streamUrl} title={`${botName}'s screen`} />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="relative text-muted-foreground">
              <MonitorIcon className="size-9" strokeWidth={1.5} />
              <span className="absolute -top-3 -right-3 font-medium text-[10px] leading-none">
                z<sup>z</sup>
              </span>
            </span>
            <p className="font-medium">Computer is asleep</p>
          </div>
        )}
      </div>
    </Pane>
  );
}

/** Shapes the app can be previewed in: a phone screen, or an A4 page (210 × 297). */
const FRAMES = {
  phone: { label: "Phone", ratio: 9 / 19.5, icon: SmartphoneIcon },
  a4: { label: "A4", ratio: 210 / 297, icon: FileTextIcon },
} as const;
type FrameSize = keyof typeof FRAMES;

function ApplicationSections({
  app,
  bot,
  buildThreadId,
  tab,
  ...context
}: ThreadContext & {
  readonly app: SpaceApp | null;
  readonly bot: ChatBot;
  readonly buildThreadId?: string | null;
  readonly tab: "Details" | "Render";
}) {
  const desktop = getDesktop();
  const [reloadKey, setReloadKey] = useState(0);
  const [size, setSize] = useState<FrameSize>("phone");
  if (tab === "Details") {
    return (
      <ContextPane
        {...context}
        actions={
          app ? (
            <>
              <Button asChild className="rounded-full" size="sm" title="Ask this app's bot about its data" variant="outline">
                <Link href={`/new?bot=app-bot&app=${app.id}`}>
                  <BotIcon className="size-4" />
                  Ask app
                </Link>
              </Button>
              {buildThreadId ? (
                <Button asChild className="rounded-full" size="sm" title="Change this app with Builder" variant="outline">
                  <Link href={`/t/${buildThreadId}`}>
                    <HammerIcon className="size-4" />
                    Edit app
                  </Link>
                </Button>
              ) : null}
              <Button className="rounded-full" onClick={() => setReloadKey((k) => k + 1)} size="sm" variant="outline">
                <RotateCwIcon className="size-4" />
                Reload
              </Button>
            </>
          ) : undefined
        }
        bot={bot}
        description={
          app?.description ||
          (app ? (bot.agent === "app-bot" ? bot.tagline : "An app built by Builder in this thread.") : bot.tagline)
        }
        meta={app ? `v${app.currentVersion} · ${desktop ? "stored on this Mac" : "web preview"}` : undefined}
      />
    );
  }
  const frame = FRAMES[size];
  return (
    <Pane caption={app ? `${app.name} · ${frame.label}` : undefined} fill>
      <div className="flex shrink-0 justify-center gap-1" role="radiogroup">
        {(Object.keys(FRAMES) as FrameSize[]).map((key) => (
          <button
            aria-checked={size === key}
            className={cn(
              "rounded-full px-3 py-1 font-medium text-muted-foreground text-xs transition-colors hover:text-foreground",
              size === key && "bg-accent text-foreground",
            )}
            key={key}
            onClick={() => setSize(key)}
            role="radio"
            type="button"
          >
            {FRAMES[key].label}
          </button>
        ))}
      </div>
      {/*
        The box is as large as the space left allows while keeping its exact shape (cq units read
        this wrapper's size). No CSS transforms: in the Mac app a native view is laid over it by its bounds.
      */}
      <div className="flex min-h-24 flex-1 justify-center [container-type:size]">
        <div
          className={cn(card, "relative overflow-hidden")}
          style={{ width: `min(100cqw, 100cqh * ${frame.ratio})`, aspectRatio: frame.ratio }}
        >
        {app ? (
          <AppRender app={app} key={`${app.id}@${app.currentVersion}`} reloadKey={reloadKey} />
        ) : (
          <EmptyState icon={frame.icon}>
            Your app will appear here once {bot.agent === "builder" ? bot.name : "it"} builds it.
          </EmptyState>
          )}
        </div>
      </div>
    </Pane>
  );
}
