import { redirect } from "next/navigation";
import { LegalFooter } from "@/app/_components/legal";
import { BambiiLogo } from "@/components/bambii-logo";
import { currentUser, isWaitlisted } from "@/lib/server/user";
import { SignOut } from "./sign-out";

/** For people signed in past the user cap (`CAPTAIN_MAX_USERS`). Anyone else goes where they belong. */
export default async function WaitlistPage() {
  if (await currentUser()) redirect("/");
  if (!(await isWaitlisted())) redirect("/sign-in");
  return (
    <main className="flex h-dvh flex-col overflow-y-auto [-webkit-app-region:drag]">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
        <BambiiLogo className="size-12" />
        <h1 className="font-semibold text-lg">Bambii is full right now</h1>
        <p className="max-w-sm text-muted-foreground text-sm">
          We're letting people in a few at a time. Your account is on the waitlist, and you'll be able to use Bambii once a
          place opens up.
        </p>
        <div className="[-webkit-app-region:no-drag]">
          <SignOut />
        </div>
      </div>
      <LegalFooter className="pb-6" />
    </main>
  );
}
