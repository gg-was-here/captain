"use client";

import { useEffect, useState } from "react";
import { Loader } from "@/components/ui/loader";
import { api, errorText } from "@/lib/client/api";

type Status = { usedToday: number; dailyLimit: number; usedThisMonth: number; monthlyLimit: number; monthResetsAt: string };

const usd = (amount: number) => `$${amount.toFixed(2)}`;

export function Usage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void api("/api/settings/usage", undefined, "Couldn't load your usage.")
      .then((response) => response.json())
      .then(setStatus)
      .catch((e: unknown) => setError(errorText(e, "Couldn't load your usage.")));
  }, []);

  const resets = status
    ? new Date(status.monthResetsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    : "";

  return (
    <section className="mt-8">
      <h2 className="font-medium text-lg">Usage</h2>
      <p className="mt-1 text-muted-foreground text-sm">
        Bambii is free with a daily and monthly AI allowance. The daily one resets at midnight UTC.
      </p>
      {error ? <p className="mt-3 text-destructive text-sm">{error}</p> : null}
      {status ? (
        <ul className="mt-4 divide-y rounded-xl border bg-card">
          <Meter label="Today" limit={status.dailyLimit} used={status.usedToday} />
          <Meter hint={`Resets ${resets}`} label="This month" limit={status.monthlyLimit} used={status.usedThisMonth} />
        </ul>
      ) : error ? null : (
        <Loader className="mt-4" size="sm" />
      )}
    </section>
  );
}

function Meter({ label, used, limit, hint }: { label: string; used: number; limit: number; hint?: string }) {
  const share = Math.min(1, used / limit);
  return (
    <li className="p-4">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {usd(Math.min(used, limit))} of {usd(limit)}
          {hint ? ` · ${hint}` : ""}
        </span>
      </div>
      <div
        aria-label={`${label}: ${usd(used)} of ${usd(limit)} used`}
        aria-valuemax={limit}
        aria-valuemin={0}
        aria-valuenow={Math.min(used, limit)}
        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        role="meter"
      >
        <div className={`h-full rounded-full ${share >= 1 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${share * 100}%` }} />
      </div>
    </li>
  );
}
