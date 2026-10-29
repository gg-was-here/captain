"use client";

import { ClerkLoaded, ClerkLoading, SignIn, SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { type CaptainDesktop, desktopErrorText, getDesktop } from "@/lib/client/desktop";
import { cn } from "@/lib/utils";

/**
 * In the Mac app, sign-in (and sign-up, which Clerk's hosted page links to)
 * happens in the default browser so passkeys work; elsewhere, Clerk's form.
 */
export function SignInOrDesktop({ mode = "sign-in" }: { readonly mode?: "sign-in" | "sign-up" }) {
  const [desktop, setDesktop] = useState<CaptainDesktop | null>();
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => setDesktop(getDesktop() ?? null), []);

  if (desktop === undefined) return <Loader />;
  if (!desktop?.signInWithBrowser) {
    return (
      <>
        <ClerkLoading>
          <Loader />
        </ClerkLoading>
        <ClerkLoaded>
          {mode === "sign-up" ? <SignUp /> : <SignIn />}
          <PrivacyLink className="mt-4" />
        </ClerkLoaded>
      </>
    );
  }

  const start = async () => {
    setError(undefined);
    try {
      await desktop.signInWithBrowser();
      setWaiting(true);
    } catch (e) {
      setError(desktopErrorText(e));
    }
  };

  return (
    <div className="w-80 rounded-xl border bg-card p-6 text-center">
      <h1 className="font-semibold text-lg">{mode === "sign-up" ? "Create your Bambii account" : "Sign in to Bambii"}</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        {waiting
          ? "Finish signing in in your browser. Bambii will continue automatically."
          : mode === "sign-up"
            ? "You'll sign up in your browser, where you can add a passkey."
            : "You'll sign in with your browser, where you can use a passkey."}
      </p>
      {error ? <p className="mt-3 text-destructive text-sm">{error}</p> : null}
      <Button className="mt-5 w-full" onClick={() => void start()} variant={waiting ? "outline" : "default"}>
        {waiting ? "Open browser again" : mode === "sign-up" ? "Sign up with browser" : "Sign in with browser"}
      </Button>
      <PrivacyLink className="mt-4" />
    </div>
  );
}

function PrivacyLink({ className }: { readonly className?: string }) {
  return (
    <p className={cn("text-center text-muted-foreground text-xs", className)}>
      <Link className="underline-offset-4 transition-colors hover:text-foreground hover:underline" href="/privacy-policy">
        Privacy Policy
      </Link>
    </p>
  );
}
