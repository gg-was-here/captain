"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api, errorText } from "@/lib/client/api";
import { getDesktop } from "@/lib/client/desktop";

/** Shown only when Clerk is configured. "_blank" opens in the default browser from the Mac app. */
export function Account() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();

  const deleteAccount = async () => {
    const confirmed = window.confirm(
      "Delete your Bambii account? This removes your threads, apps and connections and can't be undone. Apps downloaded to other Macs keep their data there until you remove them in Settings.",
    );
    if (!confirmed) return;
    setDeleting(true);
    setError(undefined);
    try {
      await api("/api/me", { method: "DELETE" }, "Couldn't delete your account.");
    } catch (e) {
      setError(errorText(e, "Couldn't delete your account."));
      setDeleting(false);
      return;
    }
    // The apps are gone from the account, so remove them and their data from this Mac too.
    const desktop = getDesktop();
    if (desktop?.removeApp) {
      const installed = await desktop.installedApps().catch(() => []);
      await Promise.allSettled(installed.map((app) => desktop.removeApp?.(app.appId)));
    }
    // The account is gone; if signing out fails, a reload lands on sign-in anyway.
    await signOut({ redirectUrl: "/sign-in" }).catch(() => window.location.assign("/sign-in"));
  };

  return (
    <section className="mt-8">
      <h2 className="font-medium text-lg">Account</h2>
      {/* On a phone the buttons wrap below the text. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border bg-card p-4">
        <div className="min-w-48 flex-1">
          <div className="truncate font-medium">{user?.fullName ?? user?.primaryEmailAddress?.emailAddress}</div>
          <p className="mt-0.5 text-muted-foreground text-sm">Manage your profile and add a passkey to sign in with Touch ID.</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href="/account/security" rel="noopener" target="_blank">
            Passkeys & security
          </a>
        </Button>
        <Button onClick={() => void signOut({ redirectUrl: "/sign-in" })} size="sm" variant="ghost">
          Sign out
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
        <div className="min-w-0 flex-1">
          <div className="font-medium">Delete account</div>
          <p className="mt-0.5 text-muted-foreground text-sm">Permanently remove your account and everything Bambii stores for you.</p>
          {error ? <p className="mt-1 text-destructive text-sm">{error}</p> : null}
        </div>
        <Button disabled={deleting} onClick={() => void deleteAccount()} size="sm" variant="destructive">
          {deleting ? (
            <>
              <Spinner className="size-3.5" />
              Deleting…
            </>
          ) : (
            "Delete account"
          )}
        </Button>
      </div>
    </section>
  );
}
