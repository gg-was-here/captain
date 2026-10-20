import Link from "next/link";
import { ErrorState } from "@/app/_components/error-state";
import { Button } from "@/components/ui/button";

export default function ShellNotFound() {
  return (
    <ErrorState
      actions={
        <Button asChild>
          <Link href="/new">Start a new chat</Link>
        </Button>
      }
      title="Not found"
    >
      This thread or app doesn't exist, or it was deleted.
    </ErrorState>
  );
}
