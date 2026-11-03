import { SYSTEM_BOTS } from "@captain/core/bots";
import type { CSSProperties } from "react";
import { BambiiLogo } from "@/components/bambii-logo";
import { avatarColor, avatarColorName, fawnStyle } from "@/lib/utils";

/** The Bambii bot's emoji in its settings; on screen it's drawn as the fawn logo instead. */
const BAMBII_ICON = SYSTEM_BOTS.find((bot) => bot.agent === "captain")?.icon;

export const isBambiiIcon = (icon: string) => icon === BAMBII_ICON;

/** A bot's or app's icon: its emoji, or the fawn for Bambii itself (sized to the surrounding text). */
export function BotGlyph({ icon }: { readonly icon: string }) {
  return isBambiiIcon(icon) ? <BambiiLogo className="size-[0.95em]" title="" /> : <>{icon}</>;
}

/**
 * An avatar's colors. Each Bambii chat gets its own pastel fawn, seeded by the thread id so it matches
 * everywhere that chat appears; without an id yet, a neutral circle. Other bots and apps keep their pastel.
 */
export function avatarTint(icon: string, seed: string | null | undefined): { className: string; style?: CSSProperties } {
  if (!isBambiiIcon(icon)) return { className: avatarColor(seed ?? "") };
  return seed ? { className: "fawn-avatar", style: fawnStyle(seed) } : { className: "bg-muted text-foreground" };
}

/** The seed that colors a chat's avatar, as the sidebar picks it: the thread for Bambii, the bot (and app) otherwise. */
export function avatarSeedFor(icon: string, threadId: string | null | undefined, botSeed: string): string | undefined {
  return isBambiiIcon(icon) ? (threadId ?? undefined) : botSeed;
}

/**
 * Colors for the chat's message bubbles, matching its avatar (see `avatarTint`): the user's in the avatar's
 * colors, the bot's in a light tint of them. Set on the chat as `--user-bubble` / `--user-bubble-fg`, read
 * by `MessageContent`, and `--bot-bubble`, read by the bot's text bubbles.
 */
export function bubbleTint(icon: string, seed: string | null | undefined): { className?: string; style: CSSProperties } {
  if (isBambiiIcon(icon)) {
    if (seed) return { className: "fawn-bubble", style: fawnStyle(seed) };
    return {
      style: { "--user-bubble": "var(--muted)", "--user-bubble-fg": "var(--foreground)", "--bot-bubble": "var(--muted)" } as CSSProperties,
    };
  }
  // The avatar is the color at 15% over the page; the bubble is the same mix, made opaque.
  const color = avatarColorName(seed ?? "");
  return {
    style: {
      "--user-bubble": `color-mix(in oklab, var(--color-${color}-500) 15%, var(--background))`,
      "--user-bubble-fg": "var(--foreground)",
      "--bot-bubble": `color-mix(in oklab, var(--color-${color}-500) 6%, var(--muted))`,
    } as CSSProperties,
  };
}
