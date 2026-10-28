import { defineHook } from "eve/hooks";
import { recordTokens } from "../usage";

/**
 * Counts each model call's tokens against the user it ran for (delegated Builder turns included: they
 * run as the forwarded user), so the daily token budget in `usage.ts` covers the bots' real spend.
 */
export default defineHook({
  events: {
    async "step.completed"(event, ctx) {
      const user = ctx.session.auth.current;
      const usage = event.data.usage;
      if (user?.principalType !== "user" || !usage) return;
      await recordTokens(user.principalId, usage);
    },
  },
});
