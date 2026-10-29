import Link from "next/link";
import type { ReactNode } from "react";

/** Where privacy and legal questions go; shown in both legal pages and their footer. */
export const LEGAL_CONTACT = "privacy@bambii.ai";

/** Bambii's public legal pages (privacy policy, terms): a plain, readable column of text. */
export function LegalPage({
  title,
  lastUpdated,
  intro,
  children,
}: {
  readonly title: string;
  readonly lastUpdated: string;
  readonly intro: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="h-dvh overflow-y-auto bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 pt-10 pb-16 sm:px-6 sm:pt-14">
        <Link className="text-muted-foreground text-sm transition-colors hover:text-foreground" href="/">
          ← Bambii
        </Link>

        <h1 className="mt-8 font-semibold text-3xl tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-muted-foreground text-sm">Last updated {lastUpdated}</p>

        <div className="mt-8 space-y-4 text-[15px] text-foreground/85 leading-7">{intro}</div>

        {children}

        <footer className="mt-14 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-6 text-muted-foreground text-xs">
          <span>© 2026 Bambii</span>
          <Link className="transition-colors hover:text-foreground" href="/privacy-policy">
            Privacy Policy
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/terms">
            Terms of Service
          </Link>
          <A href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</A>
        </footer>
      </div>
    </div>
  );
}

export function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section>
      <hr className="my-10" />
      <h2 className="font-semibold text-xl tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] text-foreground/85 leading-7">{children}</div>
    </section>
  );
}

export function Sub({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="space-y-3 pt-2">
      <h3 className="font-semibold text-base text-foreground">{title}</h3>
      {children}
    </div>
  );
}

export function List({ children }: { readonly children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-muted-foreground [&_ul]:mt-2">{children}</ul>;
}

export function A({ href, children }: { readonly href: string; readonly children: ReactNode }) {
  const external = href.startsWith("http");
  return (
    <a
      className="text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground"
      href={href}
      {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
    >
      {children}
    </a>
  );
}

/** The small "Privacy Policy · Terms of Service" line under sign-in forms and in Settings. */
export function LegalLinks({ className }: { readonly className?: string }) {
  const link = "underline-offset-4 transition-colors hover:text-foreground hover:underline";
  return (
    <p className={`text-center text-muted-foreground text-xs ${className ?? ""}`}>
      <Link className={link} href="/privacy-policy">
        Privacy Policy
      </Link>
      <span aria-hidden className="mx-2">
        ·
      </span>
      <Link className={link} href="/terms">
        Terms of Service
      </Link>
    </p>
  );
}
