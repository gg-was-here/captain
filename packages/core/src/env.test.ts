import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseUrl } from "./db-url";
import { MissingEnvError, missingProductionEnv, requireInProduction } from "./env";

describe("production configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("asks for nothing outside production", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    expect(missingProductionEnv()).toEqual([]);
    expect(() => requireInProduction("BLOB_READ_WRITE_TOKEN")).not.toThrow();
  });

  it("names what production is missing, counting blanks as unset", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("CAPTAIN_SIGNING_SECRET", "");
    vi.stubEnv("CRON_SECRET", "set");
    expect(missingProductionEnv()).toContain("CAPTAIN_SIGNING_SECRET");
    expect(missingProductionEnv()).not.toContain("CRON_SECRET");
    expect(() => requireInProduction("CAPTAIN_SIGNING_SECRET")).toThrow(MissingEnvError);
  });

  it("accepts DATABASE_URL in place of TURSO_DATABASE_URL", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("TURSO_DATABASE_URL", "");
    vi.stubEnv("DATABASE_URL", "libsql://example.turso.io");
    expect(missingProductionEnv()).not.toContain("TURSO_DATABASE_URL");
    expect(databaseUrl()).toBe("libsql://example.turso.io");
  });

  it("refuses a local database file in production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("TURSO_DATABASE_URL", "");
    vi.stubEnv("DATABASE_URL", "");
    expect(() => databaseUrl()).toThrow("TURSO_DATABASE_URL");
    vi.stubEnv("VERCEL_ENV", "");
    expect(databaseUrl()).toMatch(/^file:/);
  });
});
