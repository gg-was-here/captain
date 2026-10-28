"use client";

import type { EveDynamicToolPart } from "eve/react";
import { CheckCircle2Icon, PlayIcon } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { applyOnce } from "@/lib/client/app-data";
import type { AppDataChange } from "@/lib/client/desktop";
import { useSpace } from "./space";

type PackageResult = { ok: true; appId: string; version: number; name: string; icon: string } | { ok: false };
type DataResult = { appId: string; changes: AppDataChange[] };

const toolName = (part: EveDynamicToolPart) => part.toolName.split("__").pop();

/** The app an app-bot chat belongs to. Its tool results may change that app's data and no other's. */
export const ThreadAppContext = createContext<string | undefined>(undefined);

/** Rich renderings for Captain-specific tool results, shown under the tool card. */
export function CaptainToolResult({ part }: { readonly part: EveDynamicToolPart }) {
  if (part.state !== "output-available" || (part as { partial?: boolean }).partial) return null;
  switch (toolName(part)) {
    case "package_app": {
      const output = part.output as PackageResult;
      return output.ok ? <AppReadyCard output={output} /> : null;
    }
    case "update_app_data":
      return <AppliedChanges callId={part.toolCallId} output={part.output as DataResult} />;
    default:
      return null;
  }
}

/** "App ready" card with a Launch button that opens the app in the Space. */
export function AppReadyCard({ output }: { readonly output: Extract<PackageResult, { ok: true }> }) {
  const space = useSpace();
  return (
    <div className="my-2 flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs">
      <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-xl">{output.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{output.name}</p>
        <p className="text-muted-foreground text-xs">Version {output.version} is ready to run on your Mac</p>
      </div>
      <Button
        onClick={() =>
          space.open({ id: output.appId, name: output.name, icon: output.icon, description: "", currentVersion: output.version })
        }
        size="sm"
      >
        <PlayIcon className="size-3.5" />
        Launch
      </Button>
    </div>
  );
}

function AppliedChanges({ callId, output }: { readonly callId: string; readonly output: DataResult }) {
  const threadAppId = useContext(ThreadAppContext);
  const [state, setState] = useState<"applying" | "applied" | "failed">("applying");
  const [attempt, setAttempt] = useState(0);
  // The bot names the app in its tool call; anything other than this chat's own app is ignored.
  const ours = threadAppId !== undefined && output.appId === threadAppId;
  useEffect(() => {
    if (!ours) return;
    setState("applying");
    applyOnce(callId, output.appId, output.changes).then(
      () => setState("applied"),
      (error: unknown) => {
        console.error("[app data] couldn't apply changes", error);
        setState("failed");
      },
    );
  }, [ours, callId, output, attempt]);
  const count = `${output.changes.length} change${output.changes.length === 1 ? "" : "s"}`;
  if (!ours) {
    return <p className="my-1 text-muted-foreground text-xs">These changes were for a different app, so they weren't saved.</p>;
  }
  if (state === "failed") {
    return (
      <p className="my-1 flex items-center gap-1.5 text-destructive text-xs" role="alert">
        Couldn't save {count} to the app on this device.
        <button className="font-medium underline" onClick={() => setAttempt((n) => n + 1)} type="button">
          Try again
        </button>
      </p>
    );
  }
  if (state !== "applied") return null;
  return (
    <p className="my-1 flex items-center gap-1.5 text-muted-foreground text-xs">
      <CheckCircle2Icon className="size-3.5 text-emerald-600" />
      Saved {count} to the app on this device
    </p>
  );
}
