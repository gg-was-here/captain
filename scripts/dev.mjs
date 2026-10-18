// Starts the web app and every bot with `.env.local` (from `vercel env pull`)
// loaded into the environment, so eve's child dev servers inherit it too.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "apps/web", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});
next.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => next.kill(signal));
