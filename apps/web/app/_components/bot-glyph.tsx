import { SYSTEM_BOTS } from "@captain/core/bots";
import { BambiiLogo } from "@/components/bambii-logo";
import { avatarColor } from "@/lib/utils";

/** The Bambii bot's emoji in its settings; on screen it's drawn as the fawn logo instead. */
const BAMBII_ICON = SYSTEM_BOTS.find((bot) => bot.agent === "captain")?.icon;

export const isBambiiIcon = (icon: string) => icon === BAMBII_ICON;

/** A bot's or app's icon: its emoji, or the fawn for Bambii itself (sized to the surrounding text). */
export function BotGlyph({ icon }: { readonly icon: string }) {
  return isBambiiIcon(icon) ? <BambiiLogo className="size-[0.95em]" title="" /> : <>{icon}</>;
}

/** Avatar background: a quiet neutral for Bambii, so the fawn reads as the brand; a pastel for the rest. */
export function avatarBackground(icon: string, seed: string): string {
  return isBambiiIcon(icon) ? "bg-muted text-foreground" : avatarColor(seed);
}
