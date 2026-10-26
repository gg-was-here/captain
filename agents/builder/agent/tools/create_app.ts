import { getDb, schema } from "@captain/core/db";
import { consumeUsage } from "@captain/core/usage";
import { defineTool } from "eve/tools";
import { nanoid } from "nanoid";
import { z } from "zod";
import { TEMPLATE_DIR } from "../sandbox";

export default defineTool({
  description:
    "Start a new Captain app: registers it and copies the starter template into /workspace/apps/<appId>. Call once per app, before writing any code.",
  inputSchema: z.object({
    name: z.string().min(1).max(40),
    description: z.string().max(300),
    icon: z.string().max(4).describe("A single emoji"),
    connectors: z
      .array(z.enum(["slack", "google"]))
      .describe("Connectors the app calls at runtime through the captain SDK"),
    dataSchema: z
      .record(z.string(), z.string())
      .describe("Local collections the app stores, e.g. { tasks: 'title, status, due, sourceUrl' }"),
  }),
  label: { start: ({ name }) => `Create app “${name}”` },
  async execute(input, ctx) {
    const userId = ctx.session.auth.current?.principalId;
    if (!userId) throw new Error("Sign in to Captain to build apps.");
    await consumeUsage(userId, "builds");
    const appId = `app_${nanoid(10)}`;
    const db = await getDb();
    // When Captain delegates, this is a hidden child session: link the app to the user's Captain
    // thread (the root session) so "Edit app" can find it.
    const threadId = ctx.session.parent?.rootSessionId ?? ctx.session.id;
    await db.insert(schema.apps).values({ id: appId, userId, threadId, ...input });

    const sandbox = await ctx.getSandbox();
    const dir = `/workspace/apps/${appId}`;
    const copy = await sandbox.run({ command: `mkdir -p /workspace/apps && cp -R ${TEMPLATE_DIR} ${dir}` });
    if (copy.exitCode !== 0) throw new Error(copy.stderr);
    await sandbox.run({
      command: `sed -i 's#<title>.*</title>#<title>${input.name.replace(/[#&/\\]/g, "")}</title>#' index.html`,
      workingDirectory: dir,
    });
    return {
      appId,
      dir,
      next:
        "Read src/App.tsx (file tools refuse to overwrite a file you haven't read), replace it with the app, add any components in src/, then call package_app once the code is written.",
    };
  },
});
