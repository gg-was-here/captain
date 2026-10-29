import { cn } from "@/lib/utils";

/** A thin ring for buttons and other inline spots; the Loader's dots are for pages, panels and lists. */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      aria-label="Loading"
      className={cn("size-4 animate-spin [animation-duration:0.8s]", className)}
      fill="none"
      role="status"
      viewBox="0 0 24 24"
      {...props}
    >
      <circle cx="12" cy="12" opacity="0.2" r="9" stroke="currentColor" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  );
}

export { Spinner };
