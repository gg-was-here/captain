"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Connection = { name: string; label: string; status: "connected" | "disconnected" | "unavailable" };

/** First-run nudge on the home screen: shown until every available connector is connected. */
export function ConnectPrompt() {
  const [missing, setMissing] = useState<Connection[]>([]);

  useEffect(() => {
    fetch("/api/connections")
      .then((response) => (response.ok ? response.json() : { connections: [] }))
      .then(({ connections }: { connections: Connection[] }) =>
        setMissing(connections.filter((c) => c.status === "disconnected")),
      )
      .catch(() => {});
  }, []);

  if (missing.length === 0) return null;
  const names = new Intl.ListFormat("en", { type: "conjunction" }).format(missing.map((c) => c.label));
  return (
    <Link
      className="mt-2 rounded-xl border bg-card px-4 py-3 text-left text-sm shadow-xs transition-colors hover:bg-accent"
      href="/settings"
    >
      <span className="font-medium">Connect {names}</span>
      <span className="mt-0.5 block text-muted-foreground">
        Captain's bots and your apps work with your accounts once they're connected. Open Settings →
      </span>
    </Link>
  );
}
