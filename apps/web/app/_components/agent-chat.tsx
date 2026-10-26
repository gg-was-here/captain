"use client";

import type { UserContent } from "ai";
import { type EveMessage, useEveAgent } from "eve/react";
import { AlertCircleIcon, SquareIcon } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationTopFade,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";
import { appDataSnapshot } from "@/lib/client/app-data";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { refreshSidebar } from "@/lib/client/events";
import { AgentMessage } from "./agent-message";
import { AttachButton, AttachmentChips, MicButton } from "./composer-buttons";
import { ConnectPrompt } from "./connect-prompt";
import { AppReadyCard } from "./tool-results";
import { NewThreadMenu } from "./new-thread-dialog";

export interface ChatBot {
  readonly agent: string;
  readonly name: string;
  readonly icon: string;
  readonly tagline: string;
  readonly suggestions?: readonly string[];
  /** Text-only welcome shown on an empty thread instead of the icon and tagline. */
  readonly intro?: string;
}

export interface BuiltApp {
  readonly appId: string;
  readonly version: number;
  readonly name: string;
  readonly icon: string;
}

export function AgentChat({
  bot,
  threadId: initialThreadId,
  sessionId,
  appId,
  onAppBuilt,
  onThreadCreated,
  instructions,
  panelToggle,
  title,
}: {
  readonly bot: ChatBot;
  /** Name the user gave this thread; used instead of the first message as its title. */
  readonly title?: string;
  readonly threadId?: string;
  readonly sessionId?: string;
  /** For app-bot threads: the app this bot belongs to. */
  readonly appId?: string;
  readonly onAppBuilt?: (app: BuiltApp) => void;
  /** Called once a new thread is saved on its first message. */
  readonly onThreadCreated?: (threadId: string) => void;
  /** Extra instructions the user set for this thread, sent as context with every message. */
  readonly instructions?: string;
  /** Button that opens the thread's side panel, pinned to the top right. */
  readonly panelToggle?: ReactNode;
}) {
  const AGENT_NAME = bot.name;
  const [cancellationError, setCancellationError] = useState<string>();
  const [hasInputText, setHasInputText] = useState(false);
  const hasSubmittedMessage = useRef(false);
  const threadId = useRef(initialThreadId);
  const firstMessage = useRef<string>("");
  const creatingThread = useRef<Promise<void> | undefined>(undefined);
  const currentSessionId = useRef(sessionId);

  const savePreview = (preview: string) => {
    if (!threadId.current || !preview) return;
    void fetch(`/api/threads/${threadId.current}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ preview: preview.slice(0, 200) }),
    }).then(refreshSidebar);
  };

  /** Persist the thread the first time eve hands us a session id, then move the URL to it. */
  const ensureThread = (nextSessionId: string) => {
    if (creatingThread.current) return;
    if (threadId.current) {
      // Threads created from the + menu exist before their session; attach it on the first message.
      if (sessionId === undefined) {
        creatingThread.current = fetch(`/api/threads/${threadId.current}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: nextSessionId }),
        }).then(() => {
          refreshSidebar();
        });
      }
      return;
    }
    creatingThread.current = fetch("/api/threads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agent: bot.agent,
        sessionId: nextSessionId,
        title: title || firstMessage.current.slice(0, 80) || bot.name,
        preview: latestText.current.slice(0, 200),
        instructions: instructions?.trim() || undefined,
        appId,
      }),
    })
      .then((r) => r.json())
      .then(({ thread }) => {
        threadId.current = thread.id;
        onThreadCreated?.(thread.id);
        // Framework routers patch window.history; navigating through them would
        // remount this route and detach the active stream.
        History.prototype.replaceState.call(window.history, window.history.state, "", `/t/${thread.id}`);
        refreshSidebar();
      });
  };
  const agent = useEveAgent({
    agent: bot.agent,
    prewarm: hasInputText,
    initialSession:
      sessionId === undefined
        ? undefined
        : {
            sessionId,
            streamIndex: 0,
          },
    resume: sessionId !== undefined,
    onSessionChange(session) {
      if (session !== undefined) currentSessionId.current = session.sessionId;
      if (hasSubmittedMessage.current && session !== undefined) {
        ensureThread(session.sessionId);
      }
    },
    onFinish() {
      savePreview(latestText.current);
      checkDelegatedBuilds();
    },
  });

  // Text of the latest message from either side, saved as the thread's sidebar preview
  // when the user sends and again when a turn finishes.
  const latestText = useRef("");
  useEffect(() => {
    for (const message of agent.data.messages.toReversed()) {
      if (message.role !== "assistant" && message.role !== "user") continue;
      const text = toPreviewText(
        message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join(" "),
      );
      if (text) {
        latestText.current = text;
        break;
      }
    }
  }, [agent.data.messages]);

  // When a version is built, link the app to this thread and open it in the Space.
  const announced = useRef(new Set<string>());
  const announce = useCallback(
    (key: string, built: BuiltApp) => {
      if (announced.current.has(key)) return;
      announced.current.add(key);
      onAppBuilt?.(built);
      void (creatingThread.current ?? Promise.resolve()).then(() => {
        if (!threadId.current) return;
        void fetch(`/api/threads/${threadId.current}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ appId: built.appId }),
        }).then(refreshSidebar);
      });
    },
    [onAppBuilt],
  );

  // Builder threads: package_app results arrive in this thread's own stream.
  useEffect(() => {
    for (const message of agent.data.messages) {
      for (const part of message.parts) {
        if (part.type !== "dynamic-tool" || part.state !== "output-available") continue;
        if (!part.toolName.endsWith("package_app")) continue;
        const output = part.output as { ok?: boolean } & Partial<BuiltApp>;
        if (output?.ok && output.appId) announce(part.toolCallId, output as BuiltApp);
      }
    }
  }, [agent.data.messages, announce]);

  // Captain threads: Builder runs as a hidden subagent, so its package_app result never reaches
  // this stream. create_app links the app to this (root) session instead; check after each turn.
  // Versions that already existed when the chat opened are not announced again.
  const knownVersions = useRef<Promise<void> | undefined>(undefined);
  const delegatedApps = useCallback(async (): Promise<(BuiltApp & { key: string })[]> => {
    const session = currentSessionId.current;
    if (!session) return [];
    const response = await fetch("/api/apps").catch(() => null);
    if (!response?.ok) return [];
    const { apps } = (await response.json()) as {
      apps: { id: string; name: string; icon: string; threadId: string | null; currentVersion: number }[];
    };
    return apps
      .filter((a) => a.threadId === session && a.currentVersion > 0)
      .map((a) => ({ key: `${a.id}@${a.currentVersion}`, appId: a.id, version: a.currentVersion, name: a.name, icon: a.icon }));
  }, []);
  // Shown as Launch cards at the end of a Captain thread, like Builder's own package_app cards.
  const [delegated, setDelegated] = useState<BuiltApp[]>([]);
  useEffect(() => {
    if (bot.agent !== "captain") return;
    knownVersions.current = delegatedApps().then((apps) => {
      for (const app of apps) announced.current.add(app.key);
      setDelegated(apps);
    });
  }, [bot.agent, delegatedApps]);
  const checkDelegatedBuilds = () => {
    if (bot.agent !== "captain") return;
    void (knownVersions.current ?? Promise.resolve()).then(async () => {
      const apps = await delegatedApps();
      setDelegated(apps);
      for (const { key, ...built } of apps) announce(key, built);
    });
  };

  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isResuming = agent.status === "resuming";
  const isEmpty = agent.data.messages.length === 0;
  const lastMessage = agent.data.messages.at(-1);
  const isPendingAssistantShell =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.every((part) => part.type === "step-start" || part.type === "reasoning");
  const showPendingThinking =
    isBusy &&
    (agent.status === "submitted" || lastMessage?.role !== "assistant" || isPendingAssistantShell);
  // Tool calls are hidden, so the loader stays up until reply text streams or the bot waits on the user.
  const awaitingUser = Object.values(agent.data.inputs).some((input) => input.status === "open");
  const activity =
    lastMessage?.role === "assistant" && !showPendingThinking ? activityOf(lastMessage) : "Thinking";
  const showLoader = isBusy && !awaitingUser && activity !== undefined;
  const turnFailure = isBusy || isResuming ? undefined : getLatestTurnFailure(agent.events);
  const errorMessage = cancellationError ?? explainSendError(agent.error?.message, sessionId) ?? turnFailure;
  const hasConversationContent = !isEmpty || errorMessage !== undefined;
  // A saved thread always opens as a chat: its name on top, the composer at the bottom.
  const showConversationLayout = isResuming || hasConversationContent || initialThreadId !== undefined;
  const activeSessionId = sessionId ?? agent.session?.sessionId;
  // Answers are accepted while work runs; the server's settlement closes each request.
  const canRespond = (requestId: string) =>
    !isResuming && agent.data.inputs[requestId]?.status === "open";
  // A tool call can ask several questions at once, and its message part holds only the latest.
  const questionsFor = (callId: string) =>
    Object.values(agent.data.inputs).filter(
      (input) => input.request.kind === "question" && input.request.action.callId === callId,
    );

  const requestCancellation = () => {
    setCancellationError(undefined);
    void agent.cancel().catch((error: unknown) => {
      setCancellationError(toErrorMessage(error));
    });
  };

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if ((text.length === 0 && message.files.length === 0) || isResuming) return;

    setHasInputText(false);
    setCancellationError(undefined);
    hasSubmittedMessage.current = true;
    if (!firstMessage.current) firstMessage.current = text;
    latestText.current = toPreviewText(text) || "📎 Attachment";
    // Existing threads get the preview now; a new thread carries it in its create request.
    savePreview(latestText.current);
    if (agent.session !== undefined) ensureThread(agent.session.sessionId);
    // An app's bot sees the app's on-device data on every turn; it never leaves the device otherwise.
    // A new Builder thread carries the name the user picked for the app.
    // The user's extra instructions for this thread ride along with every message.
    const clientContext = [
      appId
        ? `App context (on-device data snapshot):\n${JSON.stringify({ appId, data: await appDataSnapshot(appId) })}`
        : bot.agent === "builder" && title && isEmpty
          ? `The user named this application "${title}". Use exactly that as the app name.`
          : undefined,
      instructions?.trim() ? `Additional instructions from the user for this thread:\n${instructions.trim()}` : undefined,
    ].filter((context) => context !== undefined);
    const options = {
      ...(isBusy ? { turnPolicy: "steer" as const } : {}),
      ...(clientContext.length > 0 ? { clientContext } : {}),
    };

    if (message.files.length === 0) {
      await agent.send(text, options);
      return;
    }

    const parts: UserContent = [];
    if (text.length > 0) {
      parts.push({ text, type: "text" });
    }
    for (const file of message.files) {
      parts.push({
        data: file.url,
        filename: file.filename,
        mediaType: file.mediaType,
        type: "file",
      });
    }

    await agent.send(parts, options);
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composer = (
    <PromptInput className="flex-wrap rounded-3xl" multiple onSubmit={handleSubmit}>
      <AttachmentChips />
      <AttachButton />
      <PromptInputTextarea
        className="max-h-40 min-h-11 py-3 pr-22 pl-12"
        disabled={isResuming}
        ref={textareaRef}
        onChange={(event) => setHasInputText(event.currentTarget.value.trim().length > 0)}
        placeholder="Send a message…"
      />
      <MicButton textareaRef={textareaRef} />
      <ComposerAction
        hasInputText={hasInputText}
        isBusy={isBusy}
        isResuming={isResuming}
        onCancel={requestCancellation}
      />
    </PromptInput>
  );

  return (
    <main className="relative flex h-dvh min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      {showConversationLayout ? (
        <ChatHeader bot={bot} title={title} />
      ) : null}
      {/* After the header: Electron resolves drag regions in DOM order, so a later drag region would swallow clicks. */}
      {panelToggle ? (
        <div className="absolute top-2.5 right-3 z-30 [-webkit-app-region:no-drag]">{panelToggle}</div>
      ) : null}

      {showConversationLayout ? (
        <Conversation
          className="min-h-0 flex-1"
          initial={sessionId === undefined ? undefined : false}
          resize={activeSessionId === undefined ? "smooth" : "instant"}
          scrollRestorationKey={
            isEmpty || activeSessionId === undefined
              ? undefined
              : `eve:web-chat-scroll:${activeSessionId}`
          }
        >
          <ConversationTopFade className="top-14" />
          <ConversationContent className="mx-auto w-full max-w-3xl gap-3 px-4 pt-20 pb-36 sm:px-6">
            {agent.data.messages.map((message, index) =>
              showPendingThinking &&
              isPendingAssistantShell &&
              message.id === lastMessage.id ? null : (
                <AgentMessage
                  canRespond={canRespond}
                  isStreaming={
                    agent.status === "streaming" && index === agent.data.messages.length - 1
                  }
                  key={message.id}
                  message={message}
                  questionsFor={questionsFor}
                  onInputResponses={(inputResponses) => {
                    setCancellationError(undefined);
                    return agent.respond(inputResponses);
                  }}
                />
              ),
            )}
            {delegated.map((app) => (
              <AppReadyCard key={app.appId} output={{ ok: true, ...app }} />
            ))}
            {showLoader ? <PendingThinking icon={bot.icon} label={activity} /> : null}
            {errorMessage ? <ErrorMessage message={errorMessage} /> : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      ) : null}

      <div
        className={cn(
          "mx-auto w-full px-4 sm:px-6",
          showConversationLayout
            ? "absolute bottom-0 left-1/2 z-20 max-w-3xl -translate-x-1/2 bg-gradient-to-t from-background via-background to-transparent pt-4 pb-6"
            : "flex max-w-xl flex-1 flex-col items-center justify-center gap-8 pb-[10vh]",
        )}
      >
        {showConversationLayout ? null : bot.intro ? (
          // The home screen starts chats through the + menu rather than a composer.
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="font-medium text-4xl tracking-tighter">{AGENT_NAME}</h1>
            <p className="max-w-md text-balance text-muted-foreground">{bot.intro}</p>
            <NewThreadMenu
              align="center"
              className="mt-5 flex size-12 items-center justify-center rounded-full border bg-background text-foreground/80 shadow-xs transition-colors hover:bg-accent hover:text-foreground"
              iconClassName="size-5"
            />
            <ConnectPrompt />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-5xl">{bot.icon}</span>
            <h1 className="font-medium text-4xl tracking-tighter">{AGENT_NAME}</h1>
            <p className="max-w-sm text-muted-foreground text-sm">{bot.tagline}</p>
          </div>
        )}
        {showConversationLayout || !bot.intro ? <div className="w-full">{composer}</div> : null}
        {showConversationLayout || !bot.suggestions?.length ? null : (
          <div className="flex flex-wrap justify-center gap-2">
            {bot.suggestions.map((suggestion) => (
              <button
                className="rounded-full border bg-card px-3 py-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
                key={suggestion}
                onClick={() => void handleSubmit({ text: suggestion, files: [] })}
                type="button"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ComposerAction({
  hasInputText,
  isBusy,
  isResuming,
  onCancel,
}: {
  readonly hasInputText: boolean;
  readonly isBusy: boolean;
  readonly isResuming: boolean;
  readonly onCancel: () => void;
}) {
  const attachments = usePromptInputAttachments();
  const canSubmit = hasInputText || attachments.files.length > 0;

  if (!isBusy || canSubmit) {
    return <PromptInputSubmit className="right-1.5 bottom-1.5 size-8 bg-teal-600 text-white hover:bg-teal-700" disabled={isResuming} />;
  }

  return (
    <PromptInputButton
      aria-label="Stop"
      className="absolute right-1.5 bottom-1.5 size-8 rounded-full"
      onClick={onCancel}
      variant="outline"
    >
      <SquareIcon className="size-3 fill-current" />
    </PromptInputButton>
  );
}

/**
 * Local `eve dev` leaves conversations from before its last restart dormant, and sending to one fails
 * with eve's generic send error. Production runs are durable, so this only explains it in development,
 * for threads that existed before this page loaded.
 */
function explainSendError(message: string | undefined, savedSessionId: string | undefined) {
  if (process.env.NODE_ENV !== "development" || savedSessionId === undefined) return message;
  if (message !== "Failed to send the session message.") return message;
  return "This chat can't continue: it started before the local dev server last restarted, and eve dev doesn't resume older chats. Start a new chat to keep going.";
}

function ErrorMessage({ message }: { readonly message: string }) {
  return (
    <Message className="max-w-full" from="assistant">
      <MessageContent>
        <div
          className="flex w-full items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm"
          role="alert"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Request failed</p>
            <p className="mt-0.5 text-muted-foreground">{message}</p>
          </div>
        </div>
      </MessageContent>
    </Message>
  );
}

function ChatHeader({ bot, title }: { readonly bot: ChatBot; readonly title?: string }) {
  return (
    <header className="pointer-events-none absolute top-0 right-0 left-0 z-20 flex h-14 items-center justify-center [-webkit-app-region:drag]">
      {/* A floating pill with the chat's avatar and name, as in a messaging app. */}
      <div className="flex max-w-[60%] items-center gap-2 rounded-full border bg-background/90 py-1.5 pr-4 pl-1.5 shadow-sm backdrop-blur-md">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm">{bot.icon}</span>
        <span className="truncate font-medium text-sm">{title || bot.name}</span>
      </div>
    </header>
  );
}

type Activity = "Thinking" | "Reading" | "Communicating" | "Working";

/** What the bot is doing now, from its latest message part; undefined once reply text is streaming. */
function activityOf(message: EveMessage): Activity | undefined {
  const part = message.parts.findLast((p) => p.type !== "step-start");
  if (part?.type === "text") return part.text.trim() ? undefined : "Thinking";
  if (part?.type !== "dynamic-tool") return "Thinking";
  // A finished tool hands control back to the model.
  if (part.state === "output-available" || part.state === "output-error") return "Thinking";
  const name = part.toolName.split("__").pop()?.toLowerCase() ?? "";
  // Handing off to Builder, or sending something out on the user's behalf.
  if (/^builder$|post|send|draft/.test(name)) return "Communicating";
  if (/search|read|fetch|history|thread|list|get|query|retrieve|details/.test(name)) return "Reading";
  return "Working";
}

/** Shown while a reply is on its way: the bot's avatar and what it is doing right now. */
function PendingThinking({ icon, label }: { readonly icon: string; readonly label: Activity }) {
  return (
    <Message aria-live="polite" from="assistant">
      <MessageContent>
        <div className="flex items-center gap-2 text-sm">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm">{icon}</span>
          <Shimmer duration={1.5}>{`${label}…`}</Shimmer>
        </div>
      </MessageContent>
    </Message>
  );
}

/** Plain one-line text for the sidebar: markdown punctuation stripped, whitespace collapsed. */
function toPreviewText(text: string): string {
  return text
    .replace(/[#*_`>\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to cancel the response.";
}

function getLatestTurnFailure(
  events: ReturnType<typeof useEveAgent>["events"],
): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];

    if (event.type === "turn.failed") {
      return event.data.code === "MODEL_CALL_FAILED"
        ? "The model is temporarily unavailable. Please try again."
        : event.data.message;
    }

    if (event.type === "turn.completed" || event.type === "turn.cancelled") {
      return undefined;
    }

    if (event.type === "message.received") {
      return undefined;
    }
  }

  return undefined;
}
