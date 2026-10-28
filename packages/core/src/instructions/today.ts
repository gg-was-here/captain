import { defineDynamic, defineInstructions } from "eve/instructions";

/** "Wednesday, October 28, 2026 (2026-10-28)" for `now` in `timeZone`. */
export function describeDay(now: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", year: "numeric", month: "long", day: "numeric" });
  // en-CA formats dates as YYYY-MM-DD, the form search filters take.
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return `${day.format(now)} (${iso.format(now)})`;
}

/**
 * Today's date where the user is, from the time zone the web app sends with each request (UTC without
 * one). Bots need it for "this week" questions and search filters such as `after:` and `newer_than:`.
 * It's resolved every turn so long-lived chats don't go stale. As a system instruction it stays out of the
 * conversation history, and it changes once a day, so prompt caching holds.
 */
export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const zone = ctx.session.auth.current?.attributes.timeZone;
      const now = new Date();
      let content: string;
      try {
        if (typeof zone !== "string" || !zone) throw new RangeError("no time zone");
        content = `Today is ${describeDay(now, zone)} in the user's time zone, ${zone}.`;
      } catch {
        content = `Today is ${describeDay(now, "UTC")} in UTC. The user's time zone isn't known.`;
      }
      return defineInstructions({ content });
    },
  },
});
