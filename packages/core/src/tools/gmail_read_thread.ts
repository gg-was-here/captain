import { defineTool } from "eve/tools";
import { gmail, inputs } from "../connectors/index";
import { googleAuth, withToken } from "../eve";

export default defineTool({
  description: "Read the full text of every message in a Gmail thread.",
  inputSchema: inputs.gmailReadThread,
  label: { start: () => "Read email thread" },
  execute: (input, ctx) => withToken(ctx, googleAuth, (token) => gmail.readThread(token, input)),
});
