import { defineHook } from "eve/hooks";
import { recordSessionOwner } from "../session-owners";

/** Records the user who started each session, so the channel can refuse everyone else (see `session-owners.ts`). */
export default defineHook({
  events: {
    async "session.started"(_event, ctx) {
      const initiator = ctx.session.auth.initiator;
      if (initiator?.principalType !== "user") return;
      // eve doesn't retry a failed hook, and a missing owner leaves the session unprotected.
      for (let attempt = 1; ; attempt++) {
        try {
          return await recordSessionOwner(ctx.session.id, initiator.principalId, ctx.agent.name);
        } catch (error) {
          if (attempt === 3) throw error;
          await new Promise((resolve) => setTimeout(resolve, attempt * 250));
        }
      }
    },
  },
});
