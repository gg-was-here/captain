"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

/** Shown only when Clerk is configured. "_blank" opens in the default browser from the Mac app. */
export function Account() {
  const { user } = useUser();
  const { signOut } = useClerk();
  return (
    <section className="mt-8">
      <h2 className="font-medium text-lg">Account</h2>
      <div className="mt-4 flex items-center gap-4 rounded-xl border bg-card p-4">
        <div className="min-w-0 flex-1">
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
    </section>
  );
}
