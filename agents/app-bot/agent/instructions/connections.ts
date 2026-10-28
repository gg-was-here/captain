import { connectionsInstructions } from "@captain/core/instructions/connections";

// App bots can post and send (with approval) but only read Notion.
export default connectionsInstructions({ send: true, editNotion: false });
