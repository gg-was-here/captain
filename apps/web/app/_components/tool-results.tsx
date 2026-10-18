"use client";

import type { EveDynamicToolPart } from "eve/react";
import { CheckCircle2Icon, PlayIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { applyOnce } from "@/lib/client/app-data";
import type { AppDataChange } from "@/lib/client/desktop";
import { useSpace } from "./space";

type PackageResult = { ok: true; appId: string; version: number; name: string; icon: string } | { ok: false };
type DataResult = { appId: string; changes: AppDataChange[] };

const toolName = (part: EveDynamicToolPart) => part.toolName.split("__").pop();

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

function AppReadyCard({ output }: { readonly output: Extract<PackageResult, { ok: true }> }) {
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
          space.open({ id: output.appId, name: output.name, icon: output.icon, currentVersion: output.version })
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
  const [applied, setApplied] = useState(false);
  useEffect(() => {
    void applyOnce(callId, output.appId, output.changes).then(() => setApplied(true));
  }, [callId, output]);
  if (!applied) return null;
  return (
    <p className="my-1 flex items-center gap-1.5 text-muted-foreground text-xs">
      <CheckCircle2Icon className="size-3.5 text-emerald-600" />
      Saved {output.changes.length} change{output.changes.length === 1 ? "" : "s"} to the app on this device
    </p>
  );
}
