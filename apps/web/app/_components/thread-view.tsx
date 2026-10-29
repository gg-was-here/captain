"use client";

import { PanelRightCloseIcon, PanelRightIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { COMPACT_QUERY, matchesNow, useMediaQuery } from "@/lib/client/use-mobile";
import { roundButton } from "@/lib/utils";
import { AgentChat, type BuiltApp, type ChatArchive, type ChatBot } from "./agent-chat";
import { type SpaceApp, SpaceContext } from "./space";
import { ThreadPanel } from "./thread-panel";

/** A thread: the chat, plus the side panel (bot info and computer, or the thread's app). */
export function ThreadView({
  bot,
  threadId: initialThreadId,
  sessionId,
  appId,
  spaceApp: initialSpaceApp,
  buildThreadId,
  title,
  instructions: initialInstructions = "",
  archive,
}: {
  readonly bot: ChatBot;
  readonly threadId?: string;
  readonly sessionId?: string;
  readonly appId?: string;
  readonly spaceApp?: SpaceApp | null;
  readonly buildThreadId?: string | null;
  /** The thread's name, as chosen when it was created. */
  readonly title?: string;
  /** Extra instructions the user saved for this thread. */
  readonly instructions?: string;
  /** The saved text of the thread's earlier session, if its session has expired or will. */
  readonly archive?: ChatArchive;
}) {
  const [spaceApp, setSpaceApp] = useState<SpaceApp | null>(
    initialSpaceApp && initialSpaceApp.currentVersion > 0 ? initialSpaceApp : null,
  );
  const kind = bot.agent === "builder" || bot.agent === "app-bot" || spaceApp ? "application" : "message";
  // Application threads open with the app showing where there's room beside the chat ("auto": decided
  // by CSS, so the first paint is right); on narrower screens it would cover the chat, so it waits to be
  // opened. Message threads start with it closed.
  const [panelOpen, setPanelOpen] = useState<boolean | "auto">(kind === "application" ? "auto" : false);
  const compact = useMediaQuery(COMPACT_QUERY);
  const panelShowing = panelOpen === "auto" ? compact === false : panelOpen;
  const [threadId, setThreadId] = useState(initialThreadId ?? null);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [editThreadId, setEditThreadId] = useState(buildThreadId ?? initialThreadId ?? null);

  const openApp = useCallback((app: SpaceApp) => {
    setSpaceApp(app);
    setPanelOpen(true);
  }, []);
  const onAppBuilt = useCallback(
    (app: BuiltApp) => {
      setSpaceApp({ id: app.appId, name: app.name, icon: app.icon, description: "", currentVersion: app.version });
      // On a narrow screen the app would cover the chat, including on every reload of a Builder thread,
      // which announces its apps again; the app-ready card's Launch button opens it there instead.
      if (!matchesNow(COMPACT_QUERY)) setPanelOpen(true);
      if (bot.agent === "builder" && threadId) setEditThreadId(threadId);
    },
    [bot.agent, threadId],
  );
  const space = useMemo(() => ({ open: openApp }), [openApp]);

  const PanelIcon = panelShowing ? PanelRightCloseIcon : PanelRightIcon;

  return (
    <SpaceContext.Provider value={space}>
      <AgentChat
        appId={appId}
        archive={archive}
        bot={bot}
        instructions={instructions}
        key={`${bot.agent}:${initialThreadId ?? "new"}:${appId ?? ""}`}
        onAppBuilt={onAppBuilt}
        onThreadCreated={setThreadId}
        panelToggle={
          <button
            aria-label={panelShowing ? "Close side panel" : "Open side panel"}
            className={roundButton}
            onClick={() => setPanelOpen((open) => (open === "auto" ? matchesNow(COMPACT_QUERY) : !open))}
            type="button"
          >
            <PanelIcon className="size-4" />
          </button>
        }
        sessionId={sessionId}
        threadId={initialThreadId}
        title={title}
      />
      {panelOpen ? (
        <ThreadPanel
          autoHidden={panelOpen === "auto"}
          app={spaceApp}
          avatarSeed={bot.agent + (appId ?? spaceApp?.id ?? "")}
          bot={bot}
          buildThreadId={bot.agent === "builder" ? null : editThreadId}
          instructions={instructions}
          kind={kind}
          onClose={() => setPanelOpen(false)}
          onInstructionsChange={setInstructions}
          threadId={threadId}
          title={title}
        />
      ) : null}
    </SpaceContext.Provider>
  );
}
