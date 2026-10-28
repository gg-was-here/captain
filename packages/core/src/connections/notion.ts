import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";
import { CONNECTORS } from "../connectors/index";

/**
 * The user's Notion, through Notion's MCP server. Tools the server marks read-only run directly. Any
 * other tool (create, update, move) waits for the user's approval, or is refused for bots that should
 * only read, so a prompt injected through a message or page can't silently rewrite the workspace.
 */
export function notionConnection({ writes }: { writes: "approve" | "refuse" }) {
  return defineMcpClientConnection({
    url: "https://mcp.notion.com/mcp",
    description:
      writes === "refuse"
        ? "Notion workspace: search and read pages and databases."
        : "Notion workspace: search and edit pages and databases.",
    auth: connect(CONNECTORS.notion.uid),
    // Annotations are the server's own hints; a tool without them is treated as a write.
    approval: ({ toolAnnotations }) => {
      if (toolAnnotations?.readOnlyHint === true) return "not-applicable";
      return writes === "refuse" ? { type: "denied", reason: "This bot can only read Notion." } : "user-approval";
    },
  });
}

/** Bambii: reads directly, asks before every write. */
export default notionConnection({ writes: "approve" });
