"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/** The engine touches `document` on load, so it only renders in the browser. */
const LottieSvg = dynamic(() => import("lottie-react").then((m) => m.LottieSvg), { ssr: false });

/** The intro's last frame (op = 140): the finished logo. */
const FINAL_FRAMES = [139, 140] as const;

/** The hero's mark: the Bambii deer drawing itself in, on a loop. */
export function HeroLottie() {
  // null until known: `segment` is read once at load, so the player waits for it.
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  useEffect(() => setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);

  // The box sets the size: lottie-react's own width/height rules sit in a cascade layer that outranks Tailwind's utilities.
  // The deer is drawn in black, so dark mode inverts it to white.
  return (
    <div aria-hidden className="mx-auto size-24 sm:size-28 dark:invert">
      {reducedMotion === null ? null : (
        <LottieSvg
          autoplay
          loop
          // lottie-react won't autoplay under reduced motion and frame 0 is transparent, so start those visitors on the finished logo.
          segment={reducedMotion ? FINAL_FRAMES : undefined}
          src="/home/deer-logo-intro.json"
        />
      )}
    </div>
  );
}
