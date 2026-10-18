import { notFound } from "next/navigation";
import { chatBot } from "@/app/_components/bots";
import { ThreadView } from "@/app/_components/thread-view";
import { findBuildThread, getApp, getThread } from "@/lib/server/data";
import { currentUser } from "@/lib/server/user";

export default async function ThreadPage({ params }: { readonly params: Promise<{ threadId: string }> }) {
  const user = await currentUser();
  const thread = user ? await getThread(user.id, (await params).threadId) : null;
  if (!thread) notFound();
  const app = thread.appId ? await getApp(user!.id, thread.appId) : null;
  const buildThread = app ? await findBuildThread(user!.id, app.threadId) : null;
  return (
    <ThreadView
      appId={thread.agent === "app-bot" ? (thread.appId ?? undefined) : undefined}
      bot={chatBot(thread.agent, app)}
      buildThreadId={buildThread?.id}
      instructions={thread.instructions}
      sessionId={thread.sessionId ?? undefined}
      spaceApp={app}
      threadId={thread.id}
      title={thread.title}
    />
  );
}
