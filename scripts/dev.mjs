// Starts the web app and every bot with `.env.development.local` (optional local
// overrides) and `.env.local` (from `vercel env pull`) loaded into the
// environment, so eve's child dev servers inherit them too.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

// eve's dev servers refuse to start on older Node, with an error that's easy to miss in the output.
if (Number(process.versions.node.split(".")[0]) < 24) {
  console.error(`Captain needs Node 24 or newer (you're on ${process.version}). Run \`nvm use\` (reads .nvmrc), then try again.`);
  process.exit(1);
}

// Earlier files win: loadEnvFile never overwrites a variable that is already set.
for (const file of [".env.development.local", ".env.local"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

// Node gives each IPv4/IPv6 connection attempt only 250ms. On a slow network with broken IPv6, every
// model call then fails with ETIMEDOUT even though the API is reachable. Give attempts 2s (inherited by bots).
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, "--network-family-autoselection-attempt-timeout=2000"]
  .filter(Boolean)
  .join(" ");
const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "apps/web", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});
next.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => next.kill(signal));
