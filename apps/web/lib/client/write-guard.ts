/**
 * Stops a built app from wearing the user down with send/post requests. After the user cancels one, the
 * app can't ask again for a short while; after several cancels in a row, for longer. Allowing one starts
 * the count over. Keyed by app id and kept for the life of the Bambii page, so an app reloading itself
 * (which gives it a fresh frame and bridge) doesn't reset it.
 *
 * Keep in sync with `apps/desktop/src/main/write-guard.ts`.
 */
export const COOLDOWN_MS = 30_000;
export const BLOCK_AFTER_CANCELS = 3;
export const BLOCK_MS = 10 * 60_000;

export class WriteGuard {
  private readonly apps = new Map<string, { cancels: number; until: number }>();

  constructor(private readonly now = () => Date.now()) {}

  /** Why `appId` may not ask the user right now, or undefined if it may. */
  refusal(appId: string, appName: string): string | undefined {
    const state = this.apps.get(appId);
    if (!state || state.until <= this.now()) return undefined;
    const seconds = Math.ceil((state.until - this.now()) / 1000);
    const minutes = Math.ceil(seconds / 60);
    const wait = seconds > 90 ? `${minutes} minutes` : seconds === 1 ? "1 second" : `${seconds} seconds`;
    return state.cancels >= BLOCK_AFTER_CANCELS
      ? `You cancelled ${appName}'s last ${state.cancels} requests, so Bambii won't ask again for ${wait}.`
      : `You just cancelled a request from ${appName}. It can ask again in ${wait}.`;
  }

  /** Records the user's answer to a request from `appId`. */
  answered(appId: string, allowed: boolean): void {
    if (allowed) {
      this.apps.delete(appId);
      return;
    }
    const cancels = (this.apps.get(appId)?.cancels ?? 0) + 1;
    this.apps.set(appId, { cancels, until: this.now() + (cancels >= BLOCK_AFTER_CANCELS ? BLOCK_MS : COOLDOWN_MS) });
  }
}
