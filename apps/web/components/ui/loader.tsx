import { cn } from "@/lib/utils";

const DOT_SIZES = { sm: "size-1.5", md: "size-2", lg: "size-2.5" } as const;

/**
 * Bambii's loader: three dots that swell in turn. It fades in after a beat, so quick loads never
 * flash it. With `fill` it centers itself in the space it's given, for a page, panel or list.
 */
export function Loader({
  label,
  size = "md",
  fill = false,
  className,
}: {
  /** Says what's loading, under the dots; screen readers hear it either way. */
  readonly label?: string;
  readonly size?: keyof typeof DOT_SIZES;
  readonly fill?: boolean;
  readonly className?: string;
}) {
  return (
    <div
      aria-label={label ?? "Loading"}
      className={cn(
        "flex animate-loader-in flex-col items-center justify-center gap-3 text-foreground/70",
        fill && "size-full min-h-0 flex-1",
        className,
      )}
      role="status"
    >
      <span aria-hidden className="flex items-center gap-1.5">
        {[0, 160, 320].map((delay) => (
          <span
            className={cn("animate-loader-dot rounded-full bg-current motion-reduce:animate-none", DOT_SIZES[size])}
            key={delay}
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      {label ? <span className="text-muted-foreground text-xs">{label}</span> : null}
    </div>
  );
}
