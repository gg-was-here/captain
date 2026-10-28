/** Which URLs the Mac app opens, follows in its window, or hands to the default browser. */

/** `captain://t/<threadId>` opens that thread. Anything else is ignored: any website can send a deep link. */
export function deepLinkPath(url: string): string | undefined {
  try {
    const target = new URL(url);
    if (target.protocol !== "captain:" || target.host !== "t") return undefined;
    const id = target.pathname.replace(/^\/|\/$/g, "");
    return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? `/t/${id}` : undefined;
  } catch {
    return undefined;
  }
}

const EXTERNAL_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

/** Links the default browser may open: web and email only, never file://, smb:// or another app's scheme. */
export function isExternalUrl(url: string): boolean {
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * Pages the main window may show. It has no address bar, so only Bambii and the sign-in pages Clerk serves
 * from Bambii's own subdomains (clerk.bambii.ai, accounts.bambii.ai) or Clerk's development domains.
 * Anything else opens in the browser, where the user can see the address.
 */
export function mayShowInWindow(url: string, origin: string): boolean {
  try {
    const target = new URL(url);
    if (target.origin === origin) return true;
    if (target.protocol !== "https:") return false;
    const site = new URL(origin).hostname.split(".").slice(-2).join(".");
    return target.hostname.endsWith(`.${site}`) || target.hostname.endsWith(".accounts.dev");
  } catch {
    return false;
  }
}
