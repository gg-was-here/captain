import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "@/app/_components/sidebar";
import { SidebarControls, SidebarProvider } from "@/app/_components/sidebar-state";
import { currentUser } from "@/lib/server/user";
import { SIDEBAR_COOKIE } from "@/lib/sidebar-cookie";

export default async function ShellLayout({ children }: { readonly children: ReactNode }) {
  if (!(await currentUser())) redirect("/sign-in");
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";
  return (
    <SidebarProvider defaultCollapsed={collapsed}>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar />
        {children}
        <SidebarControls />
      </div>
    </SidebarProvider>
  );
}
