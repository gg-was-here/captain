"use client";

import { SignIn, useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Signs the user in here in the browser (passkeys work natively), then — on an
 * explicit click — sends a one-time sign-in token to the Mac app's loopback port.
 */
export function HandoffToDesktop({ port, state }: { port: number; state: string }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string>();

  if (!isLoaded) return null;
  if (!isSignedIn) {
    // Without Clerk's hash route (#/factor-one…), so finishing sign-in lands back on this page cleanly.
    const here = typeof window === "undefined" ? undefined : window.location.origin + window.location.pathname + window.location.search;
    return <SignIn forceRedirectUrl={here} routing="hash" signUpForceRedirectUrl={here} />;
  }

  const openApp = async () => {
    setStatus("sending");
    setError(undefined);
    try {
      const response = await fetch("/api/desktop/handoff", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const callback = new URL(`http://127.0.0.1:${port}/callback`);
      callback.searchParams.set("state", state);
      callback.searchParams.set("ticket", body.ticket);
      setStatus("sent");
      window.location.assign(callback.toString());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("idle");
    }
  };

  return (
    <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center">
      <h1 className="font-semibold text-lg">Sign in to Bambii for Mac</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Continue as {user?.primaryEmailAddress?.emailAddress ?? user?.fullName ?? "you"}?
      </p>
      {error ? <p className="mt-3 text-destructive text-sm">{error}</p> : null}
      <Button className="mt-5 w-full" disabled={status !== "idle"} onClick={() => void openApp()}>
        {status === "sent" ? "Returning to Bambii…" : "Open Bambii"}
      </Button>
      <button
        className="mt-3 text-muted-foreground text-sm underline-offset-4 hover:underline"
        disabled={status !== "idle"}
        onClick={() => void signOut()}
        type="button"
      >
        Use a different account
      </button>
    </div>
  );
}
