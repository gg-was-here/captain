import { SYSTEM_BOTS } from "@captain/core/bots";
import type { CSSProperties } from "react";
import { BambiiLogo } from "@/components/bambii-logo";
import { avatarColor, fawnStyle } from "@/lib/utils";

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
