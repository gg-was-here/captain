import { defineState } from "eve/context";
import { defineHook } from "eve/hooks";
import { environment, NETWORK_POLICY } from "../sandbox";

/** Bump when NETWORK_POLICY changes, so every session's sandbox gets the new one. */
const POLICY_VERSION = 1;
const appliedVersion = defineState<number>("builder.networkPolicyVersion", () => 0);

/**
 * eve applies a sandbox's network policy only when it creates the sandbox, so a Builder session whose
 * sandbox predates the policy (reopened through "Edit app") would keep open internet. Apply it once,
 * at the start of the session's next turn. If it fails, the next turn tries again.
 */
export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      if (appliedVersion.get() >= POLICY_VERSION) return;
      const sandbox = await ctx.getSandbox(environment);
      await sandbox.setNetworkPolicy(NETWORK_POLICY);
      appliedVersion.update(() => POLICY_VERSION);
    },
  },
});
