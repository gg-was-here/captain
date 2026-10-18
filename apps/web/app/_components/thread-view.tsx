"use client";

import { PanelRightCloseIcon, PanelRightIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { roundButton } from "@/lib/utils";
import { AgentChat, type BuiltApp, type ChatBot } from "./agent-chat";
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
}) {
  const [spaceApp, setSpaceApp] = useState<SpaceApp | null>(
    initialSpaceApp && initialSpaceApp.currentVersion > 0 ? initialSpaceApp : null,
  );
  const kind = bot.agent === "builder" || bot.agent === "app-bot" || spaceApp ? "application" : "message";
  // Application threads open with the app showing; message threads start with the panel closed.
  const [panelOpen, setPanelOpen] = useState(kind === "application");
  const [threadId, setThreadId] = useState(initialThreadId ?? null);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [editThreadId, setEditThreadId] = useState(buildThreadId ?? initialThreadId ?? null);

  const openApp = useCallback((app: SpaceApp) => {
    setSpaceApp(app);
    setPanelOpen(true);
  }, []);
  const onAppBuilt = useCallback(
    (app: BuiltApp) => {
      openApp({ id: app.appId, name: app.name, icon: app.icon, description: "", currentVersion: app.version });
      if (bot.agent === "builder" && threadId) setEditThreadId(threadId);
    },
    [bot.agent, threadId, openApp],
  );
  const space = useMemo(() => ({ open: openApp }), [openApp]);

  const PanelIcon = panelOpen ? PanelRightCloseIcon : PanelRightIcon;

  return (
    <SpaceContext.Provider value={space}>
      <AgentChat
        appId={appId}
        bot={bot}
        instructions={instructions}
        key={`${bot.agent}:${initialThreadId ?? "new"}:${appId ?? ""}`}
        onAppBuilt={onAppBuilt}
        onThreadCreated={setThreadId}
        panelToggle={
          <button
            aria-label={panelOpen ? "Close side panel" : "Open side panel"}
            className={roundButton}
            onClick={() => setPanelOpen((open) => !open)}
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
