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
 * Pages the main window may show. It has no address bar, so only Bambii itself and Clerk's sign-in API:
 * clerk.<bambii's host> and accounts.<bambii's host> for a production Clerk instance, and
 * <instance>.clerk.accounts.dev for a development one. Anything else opens in the browser, where the user
 * can see the address (Clerk's hosted pages for any development instance, <name>.accounts.dev, included).
 */
export function mayShowInWindow(url: string, origin: string): boolean {
  try {
    const target = new URL(url);
    if (target.origin === origin) return true;
    if (target.protocol !== "https:") return false;
    const host = new URL(origin).hostname;
    return (
      target.hostname === `clerk.${host}` ||
      target.hostname === `accounts.${host}` ||
      target.hostname.endsWith(".clerk.accounts.dev")
    );
  } catch {
    return false;
  }
}
