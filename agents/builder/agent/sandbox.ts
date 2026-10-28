import { defineSandbox } from "eve/sandbox";
import { VercelSandbox } from "eve/sandbox/vercel";
import { TEMPLATE_FILES } from "./lib/template-files";

export const TEMPLATE_DIR = "/home/vercel-sandbox/captain-template";

/**
 * The snapshot carries the app template with node_modules installed, so a new
 * app is a `cp -R` away from `npm run build`. The install follows the
 * template's lockfile and runs no install scripts.
 */
export const environment = VercelSandbox.environment({
  prepare: async (sandbox) => {
    for (const [path, content] of Object.entries(TEMPLATE_FILES)) {
      await sandbox.writeTextFile({ path: `${TEMPLATE_DIR}/${path}`, content });
    }
    const install = await sandbox.run({
      command: "npm ci --ignore-scripts --no-audit --no-fund",
      workingDirectory: TEMPLATE_DIR,
    });
    if (install.exitCode !== 0) throw new Error(install.stderr);
  },
});

/**
 * Builder reads the user's Slack and Gmail and runs shell commands, so a prompt injected through that
 * data could try to send it out. The sandbox can only download from the npm registry: anything that
 * writes to it (publish, login) gets an invalid token at the firewall, whatever token the sandbox sends.
 */
export const NETWORK_POLICY = {
  allow: {
    "registry.npmjs.org": [
      {
        match: { method: ["PUT", "POST", "PATCH", "DELETE"] },
        transform: [{ headers: { authorization: "Bearer blocked-by-bambii" } }],
      },
    ],
  },
};

/** The sandbox stops after 15 minutes of compute and resumes on the next command. */
export default defineSandbox(() =>
  environment.open({ resources: { vcpus: 2 }, timeout: 15 * 60 * 1000, networkPolicy: NETWORK_POLICY }),
);
