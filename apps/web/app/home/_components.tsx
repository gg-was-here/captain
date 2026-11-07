import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A section's eyebrow, heading and lead, in the same type scale as the legal pages. */
export function SectionHeading({ eyebrow, title, lead }: { readonly eyebrow: string; readonly title: string; readonly lead?: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="font-medium text-muted-foreground text-xs uppercase tracking-widest">{eyebrow}</p>
      <h2 className="mt-3 text-balance font-semibold text-3xl tracking-tight sm:text-4xl">{title}</h2>
      {lead ? <p className="mt-4 text-pretty text-[15px] text-muted-foreground leading-7">{lead}</p> : null}
    </div>
  );
}

/** A white elevated surface, like the composer and cards in the app. */
export function Card({ className, children }: { readonly className?: string; readonly children: ReactNode }) {
  return <div className={cn("rounded-xl border bg-card text-card-foreground shadow-xs", className)}>{children}</div>;
}

/** The hero's picture: a screen recording of Bambii building a task tracker from one message, then using it. */
export function HeroDemo() {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-sidebar px-4 py-3">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
        </span>
        <span className="ml-2 font-medium text-sm">Bambii</span>
      </div>
      {/* A GIF can't be resized by the image optimizer without losing its animation. */}
      <Image
        alt="Bambii's home screen, then a new application named Task Tracker: Bambii is asked for a task tracker, builds it, and the finished app is used to add tasks and mark one done."
        className="h-auto w-full"
        height={600}
        priority
        src="/home/bambii-demo.gif"
        unoptimized
        width={960}
      />
    </Card>
  );
}
