import { connectionsInstructions } from "@captain/core/instructions/connections";

// Builder only reads while building: it has no send tools and only reads Notion.
export default connectionsInstructions({ send: false, editNotion: false });
