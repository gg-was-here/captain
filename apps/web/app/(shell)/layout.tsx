import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "@/app/_components/sidebar";
import { currentUser } from "@/lib/server/user";

export default async function ShellLayout({ children }: { readonly children: ReactNode }) {
  if (!(await currentUser())) redirect("/sign-in");
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      {children}
    </div>
  );
}
