"use client";

import { useEffect } from "react";
import { ErrorState } from "@/app/_components/error-state";
import { Button } from "@/components/ui/button";

export default function RootError({ error, retry }: { readonly error: Error & { digest?: string }; readonly retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex h-dvh">
      <ErrorState actions={<Button onClick={() => retry()}>Try again</Button>} title="Something went wrong">
        Captain couldn't load this page.
      </ErrorState>
    </div>
  );
}
