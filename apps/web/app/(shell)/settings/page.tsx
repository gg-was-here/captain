import { Connections } from "./connections";

export const metadata = { title: "Settings · Captain" };

export default function SettingsPage() {
  return (
    <main className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 pt-16 pb-12">
        <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
        <Connections />
      </div>
    </main>
  );
}
