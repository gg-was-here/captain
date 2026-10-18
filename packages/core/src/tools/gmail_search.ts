import { defineTool } from "eve/tools";
import { z } from "zod";
import { gmail } from "../connectors/index";
import { googleAuth, withToken } from "../eve";

export default defineTool({
  description:
    "Search the user's Gmail. Uses Gmail search syntax: `from:`, `to:`, `subject:`, `is:unread`, `newer_than:7d`, `label:`, `has:attachment`.",
  inputSchema: z.object({
    query: z.string().min(1),
    maxResults: z.number().int().min(1).max(50).optional(),
  }),
  label: { start: ({ query }) => `Search Gmail for “${query}”` },
  execute: (input, ctx) => withToken(ctx, googleAuth, (token) => gmail.searchEmail(token, input)),
});
