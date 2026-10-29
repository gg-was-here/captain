"use client";

import { PanelLeftIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useDesktop } from "@/lib/client/desktop";
import { isMobileNow } from "@/lib/client/use-mobile";
import { SIDEBAR_COOKIE } from "@/lib/sidebar-cookie";
import { cn, roundButton } from "@/lib/utils";
import { NewThreadMenu } from "./new-thread-dialog";

type SidebarState = {
  /** The sidebar is hidden on a wide screen; remembered across visits. */
  readonly collapsed: boolean;
  /** The sidebar is showing as a drawer on a phone. */
  readonly drawerOpen: boolean;
  readonly toggle: () => void;
  readonly closeDrawer: () => void;
};

const SidebarContext = createContext<SidebarState | null>(null);

export function useSidebar(): SidebarState {
  const state = useContext(SidebarContext);
  if (!state) throw new Error("useSidebar must be used inside SidebarProvider");
  return state;
}

/** Who shows the sidebar: collapsed or not on wide screens, and the drawer on phones. */
export function SidebarProvider({
  defaultCollapsed,
  children,
}: {
  readonly defaultCollapsed: boolean;
  readonly children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggle = useCallback(() => {
    if (isMobileNow()) {
      setDrawerOpen((open) => !open);
      return;
    }
    setCollapsed((was) => {
      document.cookie = `${SIDEBAR_COOKIE}=${was ? 0 : 1}; path=/; max-age=31536000; samesite=lax`;
      return !was;
    });
  }, []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Opening a chat from the drawer takes you to it, so the drawer gets out of the way.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
      if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const state = useMemo(() => ({ collapsed, drawerOpen, toggle, closeDrawer }), [collapsed, drawerOpen, toggle, closeDrawer]);
  return <SidebarContext.Provider value={state}>{children}</SidebarContext.Provider>;
}

/**
 * The buttons that bring the sidebar back while it's hidden: always on phones, and on wide screens
 * once collapsed. Rendered after the page because Electron resolves drag regions in DOM order.
 */
export function SidebarControls() {
  const { collapsed, drawerOpen, toggle } = useSidebar();
  const desktop = useDesktop();
  // Breakpoints in CSS rather than JS, so the right buttons show from the first paint.
  if (drawerOpen && !collapsed) return null;
  return (
    <div
      className={cn(
        "fixed top-2.5 z-40 flex items-center gap-2 [-webkit-app-region:no-drag]",
        // Clears the macOS traffic lights in the frameless desktop window.
        desktop ? "left-20" : "left-3",
        !collapsed && "md:hidden",
        drawerOpen && "max-md:hidden",
      )}
    >
      <button
        aria-label="Show sidebar"
        className={roundButton}
        onClick={toggle}
        title="Show sidebar (⌘B)"
        type="button"
      >
        <PanelLeftIcon className="size-4" />
      </button>
      {/* Phones get New chat from the drawer, keeping the header clear for the chat's name. */}
      <NewThreadMenu align="start" className={cn(roundButton, "max-md:hidden")} />
    </div>
  );
}
