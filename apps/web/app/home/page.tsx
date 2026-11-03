import { ArrowRight, Laptop, Bot, Hammer, Lock, MessageSquare, MonitorPlay, ShieldCheck, HardDrive } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BambiiLogo } from "@/components/bambii-logo";
import { Button } from "@/components/ui/button";
import { AppAvatar, Card, HeroDemo, SectionHeading } from "./_components";

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

const STEPS = [
  { title: "Describe it", body: "“Build a task tracker from my Slack messages.” Plain words, no spec." },
  { title: "Bambii looks at real data", body: "It reads the Slack, Gmail or Notion you've connected, so the app fits how you already work." },
  { title: "It builds and ships", body: "A new version appears as a Launch card in the chat, and the app opens beside it." },
  { title: "Keep shaping it", body: "Ask app to query its data, or Edit app to go back to Builder and change anything." },
];

const APPS = [
  { icon: "✅", name: "Slack Tasks", body: "Every ask from Slack, in one list that stays in sync." },
  { icon: "📬", name: "Reply Radar", body: "A dashboard of emails waiting on your reply, oldest first." },
  { icon: "🌱", name: "Habit Tracker", body: "Streaks, check-ins and a weekly review, all on your Mac." },
  { icon: "📝", name: "Meeting Digest", body: "Notion meeting notes turned into decisions and follow-ups." },
  { icon: "🤝", name: "Inbox CRM", body: "Contacts and deals pulled from your Gmail threads." },
  { icon: "📚", name: "Reading Queue", body: "Links from Slack and Notion, sorted into what to read next." },
];

const TRUST = [
  { icon: Lock, title: "Only what you approve", body: "Each app reaches only the connectors you allowed for it." },
  { icon: ShieldCheck, title: "You confirm every write", body: "Sending, posting or editing asks you first, every time." },
  { icon: HardDrive, title: "Your data stays local", body: "App data lives in SQLite on your Mac, not in someone's cloud." },
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
            <a className="transition-colors hover:text-foreground" href="#how">How it works</a>
            <a className="transition-colors hover:text-foreground" href="#apps">Apps</a>
            <a className="transition-colors hover:text-foreground" href="#trust">Connectors</a>
          </nav>
          <Button asChild className="ml-auto" size="sm" variant="outline">
            <a href={APP_URL}>Open app</a>
          </Button>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto max-w-6xl px-5 pt-16 pb-20 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-muted-foreground text-xs shadow-xs">
              <Bot className="size-3.5" />
              Not just a chat
            </span>
            <h1 className="mt-6 text-balance font-semibold text-4xl tracking-tight sm:text-6xl">
              An agent that builds the app you need
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground leading-8">
              Ask Bambii for anything. When an answer isn't enough, it builds a working app for it, wired to your Slack, Gmail
              and Notion and running on your Mac.
            </p>
            <div className="mt-8">
              <CallToAction macUrl={macUrl} />
            </div>
          </div>
          <div className="mt-14 sm:mt-16">
            <HeroDemo />
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

        <section className="scroll-mt-14 py-20" id="how">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <SectionHeading eyebrow="How it works" title="From a sentence to a running app" />
            <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li className="rounded-xl border p-6" key={step.title}>
                  <span className="font-mono text-muted-foreground text-xs">0{index + 1}</span>
                  <h3 className="mt-3 font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-[15px] text-muted-foreground leading-7">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="scroll-mt-14 border-t bg-sidebar py-20" id="apps">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <SectionHeading
              eyebrow="A UI for every need"
              lead="A few things people ask Bambii to build. Yours will look like however you work."
              title="Apps made to fit you"
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {APPS.map((app) => (
                <Card className="flex items-start gap-4 p-5" key={app.name}>
                  <AppAvatar icon={app.icon} seed={app.name} />
                  <div>
                    <h3 className="font-medium">{app.name}</h3>
                    <p className="mt-1 text-muted-foreground text-sm leading-6">{app.body}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="scroll-mt-14 py-20" id="trust">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <SectionHeading
              eyebrow="Connectors"
              lead="Connect once in Settings. Bambii and the apps it builds use your accounts, never a shared one."
              title="Works with Slack, Gmail and Notion"
            />
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {TRUST.map(({ icon: Icon, title, body }) => (
                <div className="flex items-start gap-3" key={title}>
                  <Icon className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <h3 className="font-medium">{title}</h3>
                    <p className="mt-1 text-muted-foreground text-sm leading-6">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-6">
          <div className="mx-auto max-w-6xl rounded-2xl bg-primary px-6 py-14 text-center text-primary-foreground sm:py-16">
            <BambiiLogo className="mx-auto size-10" title="" />
            <h2 className="mt-5 text-balance font-semibold text-3xl tracking-tight sm:text-4xl">What do you need today?</h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/70">Tell Bambii. It'll build it.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" variant="secondary">
                <a href={`${APP_URL}/sign-up`}>
                  Start building
                  <ArrowRight />
                </a>
              </Button>
              {macUrl ? (
                <Button asChild className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" size="lg" variant="ghost">
                  <a href={macUrl}>
                    <Laptop />
                    Download for Mac
                  </a>
                </Button>
              ) : null}
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
