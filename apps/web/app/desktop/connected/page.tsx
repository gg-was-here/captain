import { CONNECTORS, type ConnectorName } from "@captain/core/connectors";

/** Where a connector's consent screen lands when it was started from the Mac app (it opens in the browser). */
export default async function DesktopConnectedPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ name?: string }>;
}) {
  const { name } = await searchParams;
  const label = name && name in CONNECTORS ? CONNECTORS[name as ConnectorName].label : "Your account";
  return (
    <main className="flex h-dvh items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="font-semibold text-lg">{label} is connected</h1>
        <p className="mt-2 text-muted-foreground text-sm">You can close this tab and go back to Bambii.</p>
      </div>
    </main>
  );
}
