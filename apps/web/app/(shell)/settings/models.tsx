"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Model = { id: string; label: string; description: string };
type Role = "default" | "builder";
type Settings = Record<Role, string>;

const ROLES: { role: Role; label: string; description: string }[] = [
  { role: "default", label: "Default model", description: "Used by Captain, each app's bot, and AI calls from your apps." },
  { role: "builder", label: "App building model", description: "Used by Builder to write and fix your apps' code." },
];

export function Models() {
  const [models, setModels] = useState<Model[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [defaults, setDefaults] = useState<Settings | null>(null);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<Role>();

  useEffect(() => {
    void fetch("/api/settings/models")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setModels(body.models);
        setDefaults(body.defaults);
        setSettings(body.settings);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load your model settings."));
  }, []);

  const save = async (next: Settings, savedRole?: Role) => {
    if (!settings) return;
    const previous = settings;
    setSettings(next);
    setError(undefined);
    setSaved(undefined);
    try {
      const response = await fetch("/api/settings/models", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Couldn't save.");
      setSaved(savedRole);
    } catch (e) {
      setSettings(previous);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const isDefault = !settings || !defaults || (settings.default === defaults.default && settings.builder === defaults.builder);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-medium text-lg">Models</h2>
        {isDefault ? null : (
          <Button onClick={() => defaults && void save(defaults)} size="sm" variant="ghost">
            Reset to defaults
          </Button>
        )}
      </div>
      <p className="mt-1 text-muted-foreground text-sm">Changes apply to new messages, including in open threads.</p>
      {error ? <p className="mt-3 text-destructive text-sm">{error}</p> : null}
      <ul className="mt-4 divide-y rounded-xl border bg-card">
        {ROLES.map(({ role, label, description }) => (
          <li className="flex items-center gap-4 p-4" key={role}>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{label}</div>
              <p className="mt-0.5 text-muted-foreground text-sm">
                {saved === role ? "Saved." : description}
              </p>
            </div>
            {settings ? (
              <Select onValueChange={(id) => void save({ ...settings, [role]: id }, role)} value={settings[role]}>
                <SelectTrigger aria-label={label} className="w-52" size="sm">
                  {/* Just the name here; descriptions only show in the open menu. */}
                  <SelectValue>{models.find((m) => m.id === settings[role])?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span>{m.label}</span>
                      <span className="text-muted-foreground text-xs">{m.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-muted-foreground text-sm">{error ? null : "Loading…"}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
