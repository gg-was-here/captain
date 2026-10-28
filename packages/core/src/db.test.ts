import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

process.env.CAPTAIN_DATA_DIR = mkdtempSync(join(tmpdir(), "captain-db-"));
delete process.env.DATABASE_URL;
delete process.env.TURSO_DATABASE_URL;

const { getDb, schema } = await import("./db");

describe("database", () => {
  it("allows one row per app version, with the SQLite error on the cause package_app checks", async () => {
    const db = await getDb();
    const row = (id: string) => ({ id, appId: "app_1", version: 1, bundleKey: "apps/app_1/v1.json" });
    await db.insert(schema.appVersions).values(row("v_a"));
    const error = await db
      .insert(schema.appVersions)
      .values(row("v_b"))
      .catch((e: unknown) => e);
    const chain: string[] = [];
    for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) chain.push(`${String(e)} ${(e as { code?: unknown }).code ?? ""}`);
    expect(chain.join("\n")).toMatch(/UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/);
  });
});
