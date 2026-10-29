import { defineHook } from "eve/hooks";
import { type ModelRole, serverModel } from "../models";
import { assertWithinBudget, recordCost, UsageLimitError } from "../usage";

/**
 * Charges each model call to the user it ran for (delegated Builder turns included: they run as the
 * forwarded user) at the price of the model `role` runs on, so the dollar budgets in `usage.ts` cover the
 * bots' real spend. The budget is also checked before each turn (channel auth), but one long turn could
 * otherwise run far past it, so the turn is stopped as soon as a step uses up what's left.
 */
export function usageMeter(role: ModelRole) {
  return defineHook({
    events: {
      async "step.completed"(event, ctx) {
        const user = ctx.session.auth.current;
        const usage = event.data.usage;
        if (user?.principalType !== "user" || !usage) return;
        await recordCost(user.principalId, serverModel(role), usage);
        try {
          await assertWithinBudget(user.principalId);
        } catch (error) {
          if (!(error instanceof UsageLimitError)) throw error;
          console.warn("[usage] stopping a turn at the AI budget", user.principalId);
          ctx.cancel();
        }
      },
    },
  });
}
