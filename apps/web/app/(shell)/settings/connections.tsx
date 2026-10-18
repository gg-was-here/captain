"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDesktop } from "@/lib/client/desktop";

type Connection = { name: string; label: string; status: "connected" | "disconnected" | "unavailable" };

const DESCRIPTIONS: Record<string, string> = {
  slack: "Lets the Slack bot and your apps search, read and (with approval) post messages as you.",
  google: "Lets the Gmail bot and your apps search, read and draft email. Calendar, Drive and Docs come next.",
  notion: "Lets the Notion bot find, read and edit your pages and databases.",
};

export function Connections() {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const response = await fetch("/api/connections");
    const body = await response.json();
    if (!response.ok) setError(body.error);
    else setConnections(body.connections);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async (name: string) => {
    setBusy(name);
    setError(undefined);
    try {
      const response = await fetch(`/api/connections/${name}`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      // In the Mac app, provider sign-in happens in the default browser (Google blocks embedded sign-in).
      window.location.assign(body.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(undefined);
    }
  };

  const disconnect = async (name: string) => {
    setBusy(name);
    await fetch(`/api/connections/${name}`, { method: "DELETE" });
    setBusy(undefined);
    void load();
  };

  return (
    <>
      <section className="mt-8">
        <h2 className="font-medium text-lg">Connections</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Each connection is authorized as you and shared by its bot, by Captain, and by the apps you allow.
        </p>
        {error ? <p className="mt-3 text-destructive text-sm">{error}</p> : null}
        <ul className="mt-4 divide-y rounded-xl border bg-card">
          {(connections ?? []).map((c) => (
            <li className="flex items-center gap-4 p-4" key={c.name}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.label}</span>
                  {c.status === "connected" ? <Badge variant="secondary">Connected</Badge> : null}
                  {c.status === "unavailable" ? <Badge variant="outline">Not configured</Badge> : null}
                </div>
                <p className="mt-0.5 text-muted-foreground text-sm">{DESCRIPTIONS[c.name]}</p>
              </div>
              {c.status === "connected" ? (
                <Button disabled={busy === c.name} onClick={() => void disconnect(c.name)} size="sm" variant="outline">
                  Disconnect
                </Button>
              ) : (
                <Button
                  disabled={busy === c.name || c.status === "unavailable"}
                  onClick={() => void connect(c.name)}
                  size="sm"
                >
                  Connect
                </Button>
              )}
            </li>
          ))}
          {connections === null ? <li className="p-4 text-muted-foreground text-sm">Loading…</li> : null}
        </ul>
      </section>
      <InstalledApps />
    </>
  );
}

function InstalledApps() {
  const desktop = getDesktop();
  const [apps, setApps] = useState<{ appId: string; version: number; sizeBytes: number }[]>([]);
  useEffect(() => {
    void desktop?.installedApps().then(setApps);
  }, [desktop]);
  if (!desktop) return null;
  return (
    <section className="mt-10">
      <h2 className="font-medium text-lg">Apps on this Mac</h2>
      <p className="mt-1 text-muted-foreground text-sm">
        Built apps and their data live in ~/Library/Application Support/Captain/apps.
      </p>
      <ul className="mt-4 divide-y rounded-xl border bg-card">
        {apps.map((app) => (
          <li className="flex items-center gap-4 p-4 text-sm" key={app.appId}>
            <span className="flex-1 font-mono text-xs">{app.appId}</span>
            <span className="text-muted-foreground">
              v{app.version} · {(app.sizeBytes / 1024).toFixed(0)} KB
            </span>
            <Button onClick={() => desktop.revealApp(app.appId)} size="sm" variant="ghost">
              Show in Finder
            </Button>
          </li>
        ))}
        {apps.length === 0 ? <li className="p-4 text-muted-foreground text-sm">No apps installed yet.</li> : null}
      </ul>
    </section>
  );
}
