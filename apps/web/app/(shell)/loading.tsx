import { Spinner } from "@/components/ui/spinner";

export default function ShellLoading() {
  return (
    <main className="flex min-w-0 flex-1 items-center justify-center">
      <Spinner className="size-5 text-muted-foreground" />
    </main>
  );
}
