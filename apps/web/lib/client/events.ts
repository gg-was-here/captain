/** Tiny pub/sub so the sidebar refreshes when threads or apps change. */
const EVENT = "captain:refresh";

export const refreshSidebar = () => window.dispatchEvent(new Event(EVENT));

export function onRefreshSidebar(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
