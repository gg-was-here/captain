import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type React from "react";

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

/** A well-mixed 32-bit hash (FNV-1a with a final avalanche), so ids that differ by one character land far apart. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 0x01000193);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  return hash >>> 0;
}

/**
 * A chat's own pastel for the `.fawn-avatar` class: a hue anywhere on the wheel, plus two shade offsets
 * (0–1) that vary saturation and lightness, so even neighbouring hues look different. Stable per seed.
 */
export function fawnStyle(seed: string): React.CSSProperties {
  const hash = hashSeed(seed);
  return {
    "--fawn-h": `${hash % 360}`,
    "--fawn-v1": `${((hash >>> 9) % 101) / 100}`,
    "--fawn-v2": `${((hash >>> 17) % 101) / 100}`,
  } as React.CSSProperties;
}

/** The round, bordered icon button used in the sidebar and panel headers. */
export const roundButton =
  "flex size-9 items-center justify-center rounded-full border bg-background text-foreground/80 shadow-xs transition-colors hover:bg-accent hover:text-foreground";
