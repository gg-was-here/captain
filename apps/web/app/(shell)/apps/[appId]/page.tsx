import { notFound } from "next/navigation";
import { chatBot } from "@/app/_components/bots";
import { ThreadView } from "@/app/_components/thread-view";
import { findBuildThread, getApp } from "@/lib/server/data";
import { currentUser } from "@/lib/server/user";

/** An app's home: the app open in the Space, next to a fresh chat with its bot. */
export default async function AppPage({ params }: { readonly params: Promise<{ appId: string }> }) {
  const user = await currentUser();
  const app = user ? await getApp(user.id, (await params).appId) : null;
  if (!app) notFound();
  const buildThread = await findBuildThread(user!.id, app.threadId);
  return <ThreadView appId={app.id} bot={chatBot("app-bot", app)} buildThreadId={buildThread?.id} spaceApp={app} />;
}
