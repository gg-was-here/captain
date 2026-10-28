import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { getPath: () => "/tmp/bambii-test-user-data" } }));

const store = await import("./store");

describe("on-device app paths", () => {
  it("rejects app ids that aren't plain identifiers", () => {
    for (const appId of ["", "../app", "a/b", "a\\b", "app id"]) {
      expect(() => store.appDir(appId)).toThrow("Invalid app id");
    }
  });

  it("resolves files inside the version's dist folder", () => {
    expect(store.distFile("app_abc", 2, "assets/index.js")).toBe(
      join(store.appsDir(), "app_abc", "v2", "dist", "assets", "index.js"),
    );
  });

  it("refuses paths that escape the dist folder", () => {
    for (const path of ["../manifest.json", "../../other_app/data.db", "assets/../../v1/source/App.tsx"]) {
      expect(() => store.distFile("app_abc", 2, path)).toThrow("Path outside app");
    }
  });
});
