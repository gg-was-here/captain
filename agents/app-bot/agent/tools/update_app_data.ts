import { visible } from "@captain/core/tools/approval-prompts";
import { defineTool } from "eve/tools";
import { z } from "zod";

const change = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("put"),
    collection: z.string().min(1).max(100),
    record: z.record(z.string(), z.unknown()).describe("Include `id` to update an existing record; omit it to create one"),
  }),
  z.object({ op: z.literal("remove"), collection: z.string().min(1).max(100), id: z.string().min(1) }),
]);

/** Deleting this many records in one call waits for the user's approval. */
const BULK_REMOVE = 5;

const removals = (changes: readonly ({ op?: string; collection?: string } | undefined)[] | undefined) =>
  (changes ?? []).filter((c) => c?.op === "remove");

/**
 * App data lives on the user's device, not in the cloud. This tool only
 * validates and returns the change set; the Captain client applies it to the
 * app's local database when it sees the result, and the open app refreshes.
 * The client applies changes only to the app the chat belongs to.
 */
export default defineTool({
  description:
    "Create, update or delete records in the app's on-device database. Changes apply as soon as this call returns. Deleting 5 or more records in one call asks the user first.",
  inputSchema: z.object({
    appId: z.string().describe("The app this chat belongs to, from the app context"),
    changes: z.array(change).min(1).max(200),
  }),
  approval: {
    request: ({ toolInput }) => (removals(toolInput?.changes).length >= BULK_REMOVE ? "user-approval" : "not-applicable"),
    prompt: ({ input }) => {
      const removed = removals(input.changes);
      const collections = [...new Set(removed.map((c) => visible(c?.collection ?? "")))].join(", ");
      return `Delete ${removed.length} records from ${collections} in this app's data on your device? This can't be undone.`;
    },
  },
  label: {
    start: ({ changes }) => `Update ${changes.length} record${changes.length === 1 ? "" : "s"}`,
  },
  execute: ({ appId, changes }) => ({ appId, changes, applied: "on-device" as const }),
});
