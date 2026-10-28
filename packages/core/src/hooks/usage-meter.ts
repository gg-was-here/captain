import { defineHook } from "eve/hooks";
import { assertWithinLimit, recordTokens, UsageLimitError } from "../usage";

/**
 * Counts each model call's tokens against the user it ran for (delegated Builder turns included: they
 * run as the forwarded user), so the daily token budget in `usage.ts` covers the bots' real spend. The
 * budget is also checked before each turn (channel auth), but one long turn could otherwise run far past
 * it, so the turn is stopped as soon as a step uses up what's left.
 */
export default defineHook({
  events: {
    async "step.completed"(event, ctx) {
      const user = ctx.session.auth.current;
      const usage = event.data.usage;
      if (user?.principalType !== "user" || !usage) return;
      await recordTokens(user.principalId, usage);
      try {
        await assertWithinLimit(user.principalId, "tokens");
      } catch (error) {
        if (!(error instanceof UsageLimitError)) throw error;
        console.warn("[usage] stopping a turn at the daily token limit", user.principalId);
        ctx.cancel();
      }
    },
  },
});
