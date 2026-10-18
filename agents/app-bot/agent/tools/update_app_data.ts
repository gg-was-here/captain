import { defineTool } from "eve/tools";
import { z } from "zod";

const change = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("put"),
    collection: z.string(),
    record: z.record(z.string(), z.unknown()).describe("Include `id` to update an existing record; omit it to create one"),
  }),
  z.object({ op: z.literal("remove"), collection: z.string(), id: z.string() }),
]);

/**
 * App data lives on the user's device, not in the cloud. This tool only
 * validates and returns the change set; the Captain client applies it to the
 * app's local database when it sees the result, and the open app refreshes.
 */
export default defineTool({
  description:
    "Create, update or delete records in the app's on-device database. Changes apply as soon as this call returns.",
  inputSchema: z.object({ appId: z.string(), changes: z.array(change).min(1).max(200) }),
  label: {
    start: ({ changes }) => `Update ${changes.length} record${changes.length === 1 ? "" : "s"}`,
  },
  execute: ({ appId, changes }) => ({ appId, changes, applied: "on-device" as const }),
});
