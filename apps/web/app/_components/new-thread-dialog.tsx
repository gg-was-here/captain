"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlusIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { api, errorText } from "@/lib/client/api";
import { refreshSidebar } from "@/lib/client/events";

export type NewThreadKind = "message" | "application";

const KINDS: Record<NewThreadKind, { title: string; description: string; agent: string }> = {
  message: { title: "New message", description: "Give this thread a name.", agent: "captain" },
  application: { title: "New application", description: "Give this application a name.", agent: "builder" },
};

/** Common, familiar American first names; a new thread is prefilled with one at random. */
const NAMES = [
  "Emma", "Olivia", "Ava", "Sophia", "Charlotte", "Amelia", "Grace", "Lily", "Claire", "Hannah",
  "Jack", "Liam", "Noah", "James", "Henry", "Owen", "Luke", "Ben", "Ryan", "Wyatt",
];

function randomName() {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

/**
 * The + menu only starts a message or an app. Connectors are set up in Settings,
 * and Captain asks for authorization in-thread when a request needs one.
 */
const NEW_ITEMS: { label: string; kind: NewThreadKind }[] = [
  { label: "New message", kind: "message" },
  { label: "New application", kind: "application" },
];

/** A + button that offers New message / New application, then asks for a name. */
export function NewThreadMenu({
  className,
  iconClassName = "size-4",
  align = "end",
}: {
  readonly className: string;
  readonly iconClassName?: string;
  readonly align?: "start" | "center" | "end";
}) {
  const [kind, setKind] = useState<NewThreadKind | null>(null);
  return (
    <>
      {/* Non-modal so the menu's focus trap doesn't fight the dialog it opens. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger aria-label="New chat" className={className}>
          <PlusIcon className={iconClassName} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-48 rounded-xl p-1.5 shadow-lg" sideOffset={6}>
          {NEW_ITEMS.map((item) => (
            <DropdownMenuItem
              className="cursor-pointer rounded-lg px-2.5 py-2 font-medium"
              key={item.kind}
              onSelect={() => setKind(item.kind)}
            >
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <NewThreadDialog kind={kind} onOpenChange={(open) => !open && setKind(null)} />
    </>
  );
}

export function NewThreadDialog({
  kind,
  onOpenChange,
}: {
  readonly kind: NewThreadKind | null;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (kind) {
      setName(randomName());
      setError(undefined);
    }
  }, [kind]);

  const config = KINDS[kind ?? "message"];
  const trimmed = name.trim();

  const [creating, setCreating] = useState(false);

  // Save the thread up front so it shows in the sidebar before the first message.
  const create = async () => {
    if (!trimmed || creating) return;
    setCreating(true);
    setError(undefined);
    try {
      const res = await api(
        "/api/threads",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ agent: config.agent, title: trimmed }),
        },
        "Couldn't create the chat.",
      );
      const { thread } = await res.json();
      onOpenChange(false);
      refreshSidebar();
      router.push(`/t/${thread.id}`);
    } catch (e) {
      setError(errorText(e, "Couldn't create the chat."));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={kind !== null}>
      {/* Capped at every width; the base dialog only caps itself above the sm breakpoint. */}
      <DialogContent className="max-w-sm gap-5 rounded-xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <Input
            autoFocus
            className="h-10 rounded-lg"
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="Name"
            value={name}
          />
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button className="rounded-full" onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="rounded-full" disabled={!trimmed || creating} type="submit">
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
