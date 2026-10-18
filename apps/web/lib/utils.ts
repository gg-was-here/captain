import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Soft, stable avatar colors so each thread is recognizable at a glance. */
const AVATAR_COLORS = [
  "bg-violet-500/15",
  "bg-sky-500/15",
  "bg-emerald-500/15",
  "bg-rose-500/15",
  "bg-amber-500/15",
  "bg-teal-500/15",
  "bg-indigo-500/15",
  "bg-lime-500/15",
];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** The round, bordered icon button used in the sidebar and panel headers. */
export const roundButton =
  "flex size-9 items-center justify-center rounded-full border bg-background text-foreground/80 shadow-xs transition-colors hover:bg-accent hover:text-foreground";
