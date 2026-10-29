"use client";

import { useAuth, useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader } from "@/components/ui/loader";

/** Loaded in the Mac app window with the one-time token from the browser handoff. */
export default function DesktopCompletePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!isLoaded || started.current) return;
    started.current = true;
    if (isSignedIn) {
      router.replace("/");
      return;
    }
    // Only the Mac app redeems tickets. A website could otherwise send a signed-out browser here with a
    // ticket for the attacker's own account (and later capture the Gmail or Slack it connects).
    if (!window.captainDesktop) {
      history.replaceState(null, "", window.location.pathname);
      setError("Open this from the Bambii Mac app.");
      return;
    }
    // The desktop app puts the ticket in the fragment, which links into the Mac app (captain://…) can't carry.
    const ticket = new URLSearchParams(window.location.hash.slice(1)).get("ticket");
    history.replaceState(null, "", window.location.pathname);
    if (!ticket) {
      setError("Missing sign-in token.");
      return;
    }
    void (async () => {
      const result = await signIn.ticket({ ticket });
      if (result.error) return setError(result.error.message);
      if (signIn.status !== "complete") return setError(`Sign-in needs another step (${signIn.status}).`);
      const done = await signIn.finalize({ navigate: () => router.replace("/") });
      if (done.error) setError(done.error.message);
    })();
  }, [isLoaded, isSignedIn, router, signIn]);

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-3 p-6 [-webkit-app-region:drag]">
      {error ? (
        <p className="text-muted-foreground text-sm">{`Couldn't sign in: ${error}`}</p>
      ) : (
        <Loader label="Signing you in…" />
      )}
      {error ? (
        <a className="text-sm underline [-webkit-app-region:no-drag]" href="/sign-in">
          Try again
        </a>
      ) : null}
    </main>
  );
}
