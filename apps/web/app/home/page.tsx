import { ArrowRight, ChevronDown, Hammer, Laptop, MessageSquare, MonitorPlay } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BambiiLogo } from "@/components/bambii-logo";
import { Button } from "@/components/ui/button";
import { Card, SectionHeading } from "./_components";
import { HeroLottie } from "./hero-lottie";
import { HeroMock } from "./hero-mock";

/** The app lives on bambii.ai; this page is served on home.bambii.ai (see proxy.ts). */
const APP_URL = "https://bambii.ai";

export const metadata: Metadata = {
  title: "Bambii — an agent that builds the apps you need",
  description:
    "Bambii isn't just a chat. Ask for what you need and it builds a working app for it, wired to your Slack, Gmail and Notion, running on your Mac.",
  openGraph: {
    title: "Bambii — an agent that builds the apps you need",
    description: "Ask for what you need. Bambii builds the app, connects your tools, and runs it on your Mac.",
    url: "https://home.bambii.ai",
    siteName: "Bambii",
    type: "website",
    // Setting openGraph here replaces the root layout's, so the shared preview (app/opengraph-image.png) is named again.
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Meet Bambii — your AI agent that builds" }],
  },
};

const PILLARS = [
  {
    icon: MessageSquare,
    title: "Ask",
    body: "Talk to Bambii any time. It searches the web and works inside Slack, Gmail and Notion: finding threads, drafting replies, pulling notes together.",
  },
  {
    icon: Hammer,
    title: "Build",
    body: "When an answer isn't enough, Builder writes a real React app for it in a sandbox, using your actual data, then type-checks and packages it.",
  },
  {
    icon: MonitorPlay,
    title: "Run",
    body: "Launch it in one click. Each app runs from your Mac with its own local data and its own bot you can ask about it or ask to change it.",
  },
];

const FAQ = [
  {
    question: "What is Bambii?",
    answer: "An assistant that chats and builds with you. Ask it anything, and when an answer is better seen than read, it builds a working React app for it.",
  },
  {
    question: "Which tools does it work with?",
    answer: "Slack, Gmail and Notion. Connect them once in Settings; Bambii and the apps it builds use your own accounts, never a shared one.",
  },
  {
    question: "Can it send or edit things without asking?",
    answer: "No. Sending, posting or editing always asks you to confirm first, every time.",
  },
  {
    question: "What can an app it builds access?",
    answer: "Only the connectors you approved for that app, nothing else.",
  },
  {
    question: "Where does my app data live?",
    answer: "In SQLite on your Mac, not in someone's cloud.",
  },
];

function CallToAction({ macUrl }: { readonly macUrl?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button asChild size="lg">
        <a href={`${APP_URL}/sign-up`}>
          Start building
          <ArrowRight />
        </a>
      </Button>
      {macUrl ? (
        <Button asChild size="lg" variant="outline">
          <a href={macUrl}>
            <Laptop />
            Download for Mac
          </a>
        </Button>
      ) : null}
    </div>
  );
}

export default function HomePage() {
  const macUrl = process.env.BAMBII_MAC_DOWNLOAD_URL || undefined;
  return (
    <div className="h-dvh overflow-y-auto scroll-smooth bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5 sm:px-6">
          <a className="flex items-center gap-2 font-semibold tracking-tight" href="#top">
            <BambiiLogo className="size-6" title="" />
            Bambii
          </a>
          <nav className="hidden items-center gap-5 text-muted-foreground text-sm md:flex">
            <a className="transition-colors hover:text-foreground" href="#faq">FAQ</a>
          </nav>
          <Button asChild className="ml-auto" size="sm" variant="outline">
            <a href={APP_URL}>Open app</a>
          </Button>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto max-w-6xl px-5 pt-16 pb-20 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <HeroLottie />
            <h1 className="mt-6 text-balance font-semibold text-4xl tracking-tight sm:text-6xl">
              Meet Bambii
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground leading-8">
              She chats and builds with you. Bambii doesn't stop at a reply: when an answer is better seen than read, she
              turns it into a working app you can use.
            </p>
            <div className="mt-8">
              <CallToAction macUrl={macUrl} />
            </div>
          </div>
          <div className="mt-14 sm:mt-16">
            <HeroMock />
          </div>
        </section>

        <section className="border-t bg-sidebar py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <SectionHeading
              eyebrow="Chat is just the start"
              lead="Most assistants stop at an answer. Bambii keeps going until there's a tool you can use every day."
              title="Ask it, build with it, run what it makes"
            />
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {PILLARS.map(({ icon: Icon, title, body }) => (
                <Card className="p-6" key={title}>
                  <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-4" />
                  </span>
                  <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-[15px] text-muted-foreground leading-7">{body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="scroll-mt-14 py-20" id="faq">
          <div className="mx-auto max-w-3xl px-5 sm:px-6">
            <SectionHeading eyebrow="FAQ" title="Questions, answered" />
            <div className="mt-12 space-y-3">
              {FAQ.map(({ question, answer }) => (
                <Card key={question}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
                      {question}
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="px-5 pb-5 text-[15px] text-muted-foreground leading-7">{answer}</p>
                  </details>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 border-t px-5 py-6 text-muted-foreground text-xs sm:px-6">
        <span>© 2026 Bambii</span>
        <Link className="transition-colors hover:text-foreground" href={`${APP_URL}/privacy-policy`}>
          Privacy Policy
        </Link>
        <Link className="transition-colors hover:text-foreground" href={`${APP_URL}/terms`}>
          Terms of Service
        </Link>
        <a className="ml-auto transition-colors hover:text-foreground" href={APP_URL}>
          bambii.ai
        </a>
      </footer>
    </div>
  );
}
