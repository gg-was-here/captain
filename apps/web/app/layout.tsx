import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"], weight: "variable", display: "swap" });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"], weight: "variable", display: "swap" });

export const metadata: Metadata = {
  title: "Bambii",
  description: "Chat with bots for Slack, Gmail and Notion — and build apps that run on your Mac.",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  const page = (
    <html className={cn(sans.variable, mono.variable)} lang="en">
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
  // Without Clerk keys (local dev) Captain runs as a single local user.
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">{page}</ClerkProvider>
  ) : (
    page
  );
}
