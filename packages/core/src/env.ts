/**
 * Configuration production can't run without. Locally (and on previews) each of these has a fallback: a
 * SQLite file instead of Turso, files on disk instead of Blob, a signed-in "local user" instead of Clerk.
 * In production those fallbacks would quietly lose data or lock everyone out, so code that has one calls
 * `requireInProduction` first.
 */
export const PRODUCTION_ENV = [
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "ANTHROPIC_API_KEY",
  "CRON_SECRET",
  "CLERK_WEBHOOK_SIGNING_SECRET",
  "CAPTAIN_SIGNING_SECRET",
] as const;

export type ProductionEnv = (typeof PRODUCTION_ENV)[number];

/** True on Vercel's production deployment, not on previews or in local dev. */
export const isProduction = () => process.env.VERCEL_ENV === "production";

/** The production variables that aren't set (blank counts as unset). Empty outside production. */
export function missingProductionEnv(): ProductionEnv[] {
  if (!isProduction()) return [];
  // DATABASE_URL may stand in for TURSO_DATABASE_URL (see `db-url.ts`).
  return PRODUCTION_ENV.filter((name) => !process.env[name] && !(name === "TURSO_DATABASE_URL" && process.env.DATABASE_URL));
}

export class MissingEnvError extends Error {
  constructor(readonly names: string[]) {
    super(`Production is missing ${names.join(", ")}. Set ${names.length === 1 ? "it" : "them"} in Vercel's Production environment and redeploy.`);
    this.name = "MissingEnvError";
  }
}

/** Throws `MissingEnvError` in production when any of `names` is unset. A no-op everywhere else. */
export function requireInProduction(...names: string[]): void {
  if (!isProduction()) return;
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) throw new MissingEnvError(missing);
}
