import { defineSandbox } from "eve/sandbox";
import { VercelSandbox } from "eve/sandbox/vercel";
import { TEMPLATE_FILES } from "./lib/template-files";

export const TEMPLATE_DIR = "/home/vercel-sandbox/captain-template";

/**
 * The snapshot carries the app template with node_modules installed, so a new
 * app is a `cp -R` away from `npm run build`.
 */
export const environment = VercelSandbox.environment({
  prepare: async (sandbox) => {
    for (const [path, content] of Object.entries(TEMPLATE_FILES)) {
      await sandbox.writeTextFile({ path: `${TEMPLATE_DIR}/${path}`, content });
    }
    const install = await sandbox.run({
      command: "npm install --no-audit --no-fund",
      workingDirectory: TEMPLATE_DIR,
    });
    if (install.exitCode !== 0) throw new Error(install.stderr);
  },
});

export default defineSandbox(() => environment.open({ resources: { vcpus: 2 } }));
