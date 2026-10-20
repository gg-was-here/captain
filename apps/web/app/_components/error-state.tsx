import type { ReactNode } from "react";

/** Centered message for error, not-found and empty pages. */
export function ErrorState({
  title,
  children,
  actions,
}: {
  readonly title: string;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <main className="flex min-w-0 flex-1 items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="font-semibold text-lg">{title}</h1>
        {children ? <p className="mt-2 text-muted-foreground text-sm">{children}</p> : null}
        {actions ? <div className="mt-5 flex justify-center gap-2">{actions}</div> : null}
      </div>
    </main>
  );
}
