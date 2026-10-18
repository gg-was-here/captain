import { defineConfig } from "drizzle-kit";
import { databaseUrl } from "./src/db-url";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: { url: databaseUrl(), authToken: process.env.TURSO_AUTH_TOKEN },
});
