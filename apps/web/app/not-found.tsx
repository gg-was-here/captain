import Link from "next/link";
import { ErrorState } from "@/app/_components/error-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-dvh">
      <ErrorState
        actions={
          <Button asChild>
            <Link href="/">Back to Bambii</Link>
          </Button>
        }
        title="Page not found"
      >
        This page doesn't exist, or you don't have access to it.
      </ErrorState>
    </div>
  );
}
