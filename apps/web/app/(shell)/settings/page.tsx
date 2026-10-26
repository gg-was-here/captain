import { XIcon } from "lucide-react";
import Link from "next/link";
import { roundButton } from "@/lib/utils";
import { Account } from "./account";
import { Connections } from "./connections";
import { Models } from "./models";

export const metadata = { title: "Settings · Captain" };

export default function SettingsPage() {
  return (
    <main className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 pt-16 pb-12">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
          <Link aria-label="Close settings" className={roundButton} href="/" title="Close">
            <XIcon className="size-4" />
          </Link>
        </div>
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <Account /> : null}
        <Models />
        <Connections />
      </div>
    </main>
  );
}
