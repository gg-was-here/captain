"use client";

import type { App } from "@captain/core/schema";
import { useCallback, useMemo, useState } from "react";
import { AgentChat, type BuiltApp, type ChatBot } from "./agent-chat";
import { Space, SpaceContext } from "./space";

type SpaceApp = Pick<App, "id" | "name" | "icon" | "currentVersion">;

/** A thread: the chat, plus the Space panel whenever the thread has an app. */
export function ThreadView({
  bot,
  threadId,
  sessionId,
  appId,
  spaceApp: initialSpaceApp,
  buildThreadId,
}: {
  readonly bot: ChatBot;
  readonly threadId?: string;
  readonly sessionId?: string;
  readonly appId?: string;
  readonly spaceApp?: SpaceApp | null;
  readonly buildThreadId?: string | null;
}) {
  const [spaceApp, setSpaceApp] = useState<SpaceApp | null>(
    initialSpaceApp && initialSpaceApp.currentVersion > 0 ? initialSpaceApp : null,
  );
  const [editThreadId, setEditThreadId] = useState(buildThreadId ?? threadId ?? null);

  const onAppBuilt = useCallback(
    (app: BuiltApp) => {
      setSpaceApp({ id: app.appId, name: app.name, icon: app.icon, currentVersion: app.version });
      if (bot.agent === "builder" && threadId) setEditThreadId(threadId);
    },
    [bot.agent, threadId],
  );
  const space = useMemo(() => ({ open: setSpaceApp }), []);

  return (
    <SpaceContext.Provider value={space}>
      <AgentChat
        appId={appId}
        bot={bot}
        key={`${bot.agent}:${threadId ?? "new"}:${appId ?? ""}`}
        onAppBuilt={onAppBuilt}
        sessionId={sessionId}
        threadId={threadId}
      />
      {spaceApp ? (
        <Space
          app={spaceApp}
          buildThreadId={bot.agent === "builder" ? null : editThreadId}
          key={`${spaceApp.id}@${spaceApp.currentVersion}`}
          onClose={() => setSpaceApp(null)}
        />
      ) : null}
    </SpaceContext.Provider>
  );
}
