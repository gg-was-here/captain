import { chatBot } from "@/app/_components/bots";
import { ThreadView } from "@/app/_components/thread-view";
import { findBuildThread, getApp } from "@/lib/server/data";
import { currentUser } from "@/lib/server/user";

export default async function NewThreadPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ bot?: string; app?: string }>;
}) {
  const { bot = "captain", app: appId } = await searchParams;
  const user = await currentUser();
  const app = user && appId ? await getApp(user.id, appId) : null;
  const buildThread = user && app ? await findBuildThread(user.id, app.threadId) : null;
  return (
    <ThreadView
      appId={bot === "app-bot" ? app?.id : undefined}
      bot={chatBot(bot, app)}
      buildThreadId={buildThread?.id}
      spaceApp={app}
    />
  );
}
