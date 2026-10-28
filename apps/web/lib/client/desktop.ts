/**
 * Contract between the web UI and the Captain Mac app. The Electron preload
 * exposes `window.captainDesktop`; in a plain browser it is undefined and the
 * UI falls back to web previews and localStorage.
 *
 * Keep in sync with apps/desktop/src/preload/index.ts.
 */
import { useSyncExternalStore } from "react";

export type AppRecord = { id: string; createdAt: string; updatedAt: string; [field: string]: unknown };

export type AppDataChange =
  | { op: "put"; collection: string; record: Record<string, unknown> }
  | { op: "remove"; collection: string; id: string };

export interface SpaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptainDesktop {
  readonly platform: string;
  readonly version: string;
  /** Open sign-in in the default browser (where passkeys work); the session comes back to this window. */
  signInWithBrowser(): Promise<void>;
  /** Download the app version onto the Mac if needed, then show it in the Space view. */
  openSpace(options: { appId: string; version: number; bounds: SpaceBounds }): Promise<void>;
  setSpaceBounds(bounds: SpaceBounds): void;
  reloadSpace(): void;
  closeSpace(): void;
  readAppData(appId: string): Promise<Record<string, AppRecord[]>>;
  applyAppChanges(appId: string, changes: AppDataChange[]): Promise<void>;
  installedApps(): Promise<{ appId: string; version: number; sizeBytes: number }[]>;
  revealApp(appId: string): void;
  /** Delete an app and its on-device data from this Mac. Missing in Mac app versions before it existed. */
  removeApp?(appId: string): Promise<void>;
}

declare global {
  interface Window {
    captainDesktop?: CaptainDesktop;
  }
}

/** The message of an error from the Mac app, without the "Error invoking remote method …" prefix Electron adds. */
export function desktopErrorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, "");
}

export const getDesktop = (): CaptainDesktop | undefined =>
  typeof window === "undefined" ? undefined : window.captainDesktop;

const subscribeNever = () => () => {};

/**
 * `getDesktop()` for rendering. `undefined` while hydrating (the server can't know, so this
 * matches its HTML), then the Mac app bridge, or `null` in a plain browser.
 */
export function useDesktop(): CaptainDesktop | null | undefined {
  return useSyncExternalStore(subscribeNever, () => window.captainDesktop ?? null, () => undefined);
}
