import { alert } from "@captain/core/alerts";
import { getDb } from "@captain/core/db";
import { missingProductionEnv } from "@captain/core/env";
import { list } from "@vercel/blob";
import { sql } from "drizzle-orm";

const TIMEOUT_MS = 5000;

/** Resolves if `check` finishes within the timeout, so a hung dependency reads as down rather than hanging the probe. */
async function probe(check: () => Promise<unknown>): Promise<"ok" | "down"> {
  try {
    await Promise.race([
      check(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), TIMEOUT_MS)),
    ]);
    return "ok";
  } catch (error) {
    console.error("[health]", error);
    return "down";
  }
}

/**
 * For uptime monitors: 200 when the database and app storage answer, 503 when either doesn't. Public, so
 * it says only up or down; `config` is "incomplete" when production is missing settings, which are named
 * only in the alert.
 */
export async function GET() {
  const missing = missingProductionEnv();
  if (missing.length > 0) await alert("config", "Production is missing settings", { missing: missing.join(", ") });
  const [database, storage] = await Promise.all([
    probe(async () => (await getDb()).run(sql`SELECT 1`)),
    probe(async () => (process.env.BLOB_READ_WRITE_TOKEN ? list({ limit: 1 }) : undefined)),
  ]);
  const ok = database === "ok" && storage === "ok";
  const config = missing.length > 0 ? "incomplete" : "ok";
  return Response.json({ ok, database, storage, config }, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
