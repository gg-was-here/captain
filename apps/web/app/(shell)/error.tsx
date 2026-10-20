"use client";

import { useEffect } from "react";
import { ErrorState } from "@/app/_components/error-state";
import { Button } from "@/components/ui/button";

/** Keeps the sidebar usable when a thread, app or settings page fails to render. */
export default function ShellError({ error, retry }: { readonly error: Error & { digest?: string }; readonly retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <ErrorState actions={<Button onClick={() => retry()}>Try again</Button>} title="Something went wrong">
      Captain couldn't load this page. Try again, or pick another thread from the sidebar.
    </ErrorState>
  );
}
