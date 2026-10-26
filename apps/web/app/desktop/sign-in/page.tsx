import { HandoffToDesktop } from "./handoff";

export const metadata = { title: "Sign in to Bambii for Mac" };

/** Opened in the default browser by the Mac app; see apps/desktop/src/main/auth.ts. */
export default async function DesktopSignInPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { port, state } = await searchParams;
  const portNumber = Number(port);
  const valid = Number.isInteger(portNumber) && portNumber >= 1024 && portNumber <= 65535 && /^[\w-]{16,}$/.test(state ?? "");
  return (
    <main className="flex h-dvh items-center justify-center p-6">
      {valid ? (
        <HandoffToDesktop port={portNumber} state={state} />
      ) : (
        <p className="text-muted-foreground text-sm">This sign-in link is invalid. Start again from the Bambii app.</p>
      )}
    </main>
  );
}
